import { Agent } from "agents";
import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { SkillGroup } from "@/server/skills/base/skill-group";
import { SkillContext } from "@/server/skills/base/skill-context";
import { ChatState, SkillExecutionRequest } from "@/types/chat-types";
import { WsResponseFormatter } from "@/server/utils/ws-response-formatter";
import { SkillManager } from "@/server/core/skill-manager";
import {
  AgentInitializer,
  getDomainNames,
} from "@/server/core/agent-initializer";
import { IntentRouter } from "@/server/core/intent-router";
import { StateManager } from "@/server/core/state-manager";

export class ChatAgent extends Agent {
  private registry = new SkillRegistry();
  private domainGroups = new Map<string, SkillGroup>();
  private skillManager!: SkillManager;
  private intentRouter!: IntentRouter;
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    let state = await (this.state as Promise<ChatState>);

    if (!state?.sessionId) {
      state = await StateManager.initializeState(state);
      await this.setState(state);
    }

    AgentInitializer.setupSharedSkills(this.registry);
    this.domainGroups = await AgentInitializer.setupDomainGroups(
      state,
      (this as any).env
    );

    this.skillManager = new SkillManager(this.registry, this.domainGroups);
    this.intentRouter = new IntentRouter(this.registry, this.domainGroups);
    this.initialized = true;
  }

  async onConnect(ws: any): Promise<void> {
    try {
      await this.ensureInitialized();
      const state = await (this.state as Promise<ChatState>);

      WsResponseFormatter.sendWelcome(
        ws,
        state.sessionId,
        getDomainNames(),
        this.registry.listSkills(),
        crypto.randomUUID().substring(0, 8)
      );
    } catch (error: any) {
      WsResponseFormatter.sendError(ws, "Failed to initialize connection");
    }
  }

  async onMessage(ws: any, message: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      const data: SkillExecutionRequest = JSON.parse(message);
      const userMessage = data.content || data.message || "";

      if (!userMessage)
        return WsResponseFormatter.sendError(ws, "Empty message");

      const state = await (this.state as Promise<ChatState>);
      const context: SkillContext = {
        sessionId: state.sessionId,
        userId: state.userId,
        env: (this as any).env,
        ws,
        state,
        messageHistory: state.messages || [],
        sharedData: state.context || {},
      };

      StateManager.addMessage(state, "user", userMessage);
      WsResponseFormatter.sendUserMessage(ws, userMessage);

      await (data.skillId
        ? this.executeSkill(ws, data, context)
        : this.routeMessage(ws, data, state, context, userMessage));

      await this.setState(state);
      WsResponseFormatter.sendProgress(ws, "complete", {
        duration: Date.now() - startTime,
      });
    } catch (error: any) {
      WsResponseFormatter.sendError(ws, error.message || "Processing failed");
    }
  }

  private async executeSkill(
    ws: any,
    data: SkillExecutionRequest,
    context: SkillContext
  ): Promise<void> {
    WsResponseFormatter.sendProgress(ws, "executing_skill", {
      skillId: data.skillId,
    });
    await this.skillManager.executeSkill(
      ws,
      { skillId: data.skillId!, input: data, context },
      (result, domain) =>
        WsResponseFormatter.sendSkillResult(
          ws,
          data.skillId!,
          domain,
          result.data,
          result.nextSkill
        )
    );
  }

  private async routeMessage(
    ws: any,
    data: SkillExecutionRequest,
    state: ChatState,
    context: SkillContext,
    message: string
  ): Promise<void> {
    WsResponseFormatter.sendProgress(ws, "detecting_intent", {
      messageLen: message.length,
    });

    const intent = await this.intentRouter.detect(message, context);

    if (intent && this.intentRouter.canRoute(intent.domain, intent.intent)) {
      WsResponseFormatter.sendProgress(ws, "executing_workflow", {
        domain: intent.domain,
        intent: intent.intent,
      });
      const result = await this.intentRouter.executeWorkflow(
        intent.domain,
        intent.intent,
        context
      );

      if (result.success) {
        return WsResponseFormatter.sendSkillResult(
          ws,
          intent.intent,
          intent.domain,
          result.data
        );
      }
    }

    await this.handleConversation(ws, data, state, context);
  }

  private handleConversation(
    ws: any,
    data: SkillExecutionRequest,
    state: ChatState,
    context: SkillContext
  ): Promise<void> {
    WsResponseFormatter.sendProgress(ws, "executing_conversation", {
      stage: "start",
    });

    return new Promise<void>((resolve) => {
      this.skillManager.executeSkill(
        ws,
        {
          skillId: "conversation",
          input: { message: data.content || data.message },
          context,
        },
        (result) => {
          const response =
            result.data?.response || "I'm not sure how to respond to that.";
          StateManager.addMessage(state, "assistant", response);
          WsResponseFormatter.sendAgentMessage(ws, response);
          resolve();
        },
        (error) => {
          const errorMsg = this.getErrorMessage(error);
          StateManager.addMessage(state, "assistant", errorMsg);
          WsResponseFormatter.sendAgentMessage(ws, errorMsg);
          resolve();
        }
      );
    });
  }

  private getErrorMessage(error: any): string {
    const errorStr = String(error?.message || error);
    if (errorStr.includes("3040") || errorStr.includes("capacity")) {
      return "The AI service is temporarily at capacity. Please try again in a moment.";
    }
    if (errorStr.includes("timeout"))
      return "The request timed out. Please try again.";
    return "I encountered an issue. Please try again.";
  }

  async onClose(_ws: any): Promise<void> {}
}
