/**
 * [CORE - AGENT] ChatAgent
 *
 * Main WebSocket handler and message router.
 * Orchestrates skills, domains, and message processing.
 * Part of core agent infrastructure.
 *
 * EXTENDS: Agent (Cloudflare Workers Agent)
 * USED BY: entry.cloudflare.ts
 * DEPENDS ON: SkillRegistry, SkillGroup, SkillManager, IntentRouter, StateManager
 */

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
  private sharedRegistry: SkillRegistry = new SkillRegistry();
  private domainGroups: Map<string, SkillGroup> = new Map();
  private skillManager!: SkillManager;
  private intentRouter!: IntentRouter;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    const state = (await this.state) as ChatState;
    // Initialize state if needed
    if (!state?.sessionId) {
      const initialized: ChatState = {
        sessionId: crypto.randomUUID(),
        userId: "",
        messages: [],
        context: {},
        lastUpdated: Date.now(),
      };
      await this.setState(initialized);
    }
  }

  async onConnect(ws: any): Promise<void> {
    try {
      await this.initialize();
      AgentInitializer.setupSharedSkills(this.sharedRegistry);
      this.domainGroups = await AgentInitializer.setupDomainGroups(
        await this.state,
        (this as any).env
      );
      AgentInitializer.registerCoordinatorSkill(this.sharedRegistry);

      this.skillManager = new SkillManager(
        this.sharedRegistry,
        this.domainGroups
      );
      this.intentRouter = new IntentRouter(
        this.sharedRegistry,
        this.domainGroups
      );

      this.isInitialized = true;

      const state = (await this.state) as ChatState;
      WsResponseFormatter.sendWelcome(
        ws,
        state.sessionId,
        getDomainNames(),
        this.sharedRegistry.listSkills()
      );
    } catch (error: any) {
      WsResponseFormatter.sendError(ws, "Failed to initialize agent");
    }
  }

  async onMessage(ws: any, message: string): Promise<void> {
    const msgId = crypto.randomUUID().substring(0, 8);
    const startTime = Date.now();

    console.log(`[Server:${msgId}] 📨 MESSAGE RECEIVED`, {
      timestamp: new Date().toISOString(),
      dataSize: message.length,
    });

    try {
      // Ensure initialization is complete before processing messages
      if (!this.isInitialized) {
        console.log(`[Server:${msgId}] ⏳ WAITING FOR AGENT INITIALIZATION`);
        // Initialize on first message if not already done via onConnect
        this.initializationPromise = this.initializeAgent(ws);
        await this.initializationPromise;
      }

      const data: SkillExecutionRequest = JSON.parse(message);
      const state = (await this.state) as ChatState;

      console.log(`[Server:${msgId}] 🔍 PARSED MESSAGE`, {
        type: data.type,
        contentLen: (data.content || data.message || "").length,
        sessionId: state.sessionId,
      });

      // Build context inline
      const context: SkillContext = {
        sessionId: state.sessionId,
        userId: state.userId,
        env: (this as any).env,
        ws,
        state,
        messageHistory: state.messages || [],
        sharedData: state.context || {},
      };

      const userMessage = data.content || data.message || "";

      if (!userMessage) {
        console.warn(`[Server:${msgId}] ⚠️ Empty message`);
        WsResponseFormatter.sendError(ws, "Empty message");
        return;
      }

      // Add message to state inline
      state.messages.push({
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      });
      state.lastUpdated = Date.now();

      console.log(`[Server:${msgId}] 💾 MESSAGE STORED`, {
        messageCount: state.messages.length,
      });

      // Send user message back to chat UI immediately
      WsResponseFormatter.sendUserMessage(ws, userMessage);

      if (data.skillId) {
        console.log(`[Server:${msgId}] 🎯 EXECUTING SKILL`, {
          skillId: data.skillId,
        });
        WsResponseFormatter.sendProgress(ws, "executing_skill", {
          skillId: data.skillId,
        });
        await this.skillManager.executeSkill(
          ws,
          { skillId: data.skillId, input: data, context },
          (result, domain) => {
            const processingTime = Date.now() - startTime;
            console.log(`[Server:${msgId}] ✅ SKILL RESULT`, {
              skillId: data.skillId,
              domain,
              processingTime,
              success: result.success,
            });
            WsResponseFormatter.sendSkillResult(
              ws,
              data.skillId!,
              domain,
              result.data,
              result.nextSkill
            );
          }
        );
      } else {
        console.log(`[Server:${msgId}] 🔄 HANDLING MESSAGE`);
        WsResponseFormatter.sendProgress(ws, "processing_message", {
          messageLen: userMessage.length,
        });
        await this.handleMessage(ws, data, state, context, userMessage);
      }

      await this.setState(state);

      WsResponseFormatter.sendProgress(ws, "complete", {
        duration: Date.now() - startTime,
      });
      console.log(`[Server:${msgId}] ✅ PROCESSING COMPLETE`, {
        duration: Date.now() - startTime,
      });
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[Server:${msgId}] ❌ PROCESSING ERROR`, {
        error: error.message,
        stack: error.stack?.substring(0, 200),
        duration: processingTime,
      });
      WsResponseFormatter.sendError(
        ws,
        error.message || "Message processing failed"
      );
    }
  }

  async onClose(_ws: any): Promise<void> {}

  private async initializeAgent(ws: any): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.initialize();
      AgentInitializer.setupSharedSkills(this.sharedRegistry);
      this.domainGroups = await AgentInitializer.setupDomainGroups(
        await this.state,
        (this as any).env
      );
      AgentInitializer.registerCoordinatorSkill(this.sharedRegistry);

      this.skillManager = new SkillManager(
        this.sharedRegistry,
        this.domainGroups
      );
      this.intentRouter = new IntentRouter(
        this.sharedRegistry,
        this.domainGroups
      );

      this.isInitialized = true;
      console.log(`[Agent] ✅ AGENT INITIALIZED`);
    } catch (error: any) {
      console.error(`[Agent] ❌ INITIALIZATION FAILED`, {
        error: error.message,
      });
      WsResponseFormatter.sendError(ws, "Failed to initialize agent");
      throw error;
    }
  }

  private async handleMessage(
    ws: any,
    data: SkillExecutionRequest,
    state: ChatState,
    context: any,
    message: string
  ): Promise<void> {
    const msgId = crypto.randomUUID().substring(0, 8);
    console.log(`[Server:${msgId}] 🔎 DETECTING INTENT`, {
      messageLen: message.length,
    });

    WsResponseFormatter.sendProgress(ws, "detecting_intent", {
      messageLen: message.length,
    });

    // Ensure intentRouter is initialized
    if (!this.intentRouter) {
      console.log(
        `[Server:${msgId}] ⚠️ INTENT ROUTER NOT INITIALIZED, USING CONVERSATION`
      );
      WsResponseFormatter.sendProgress(ws, "fallback_conversation", {
        reason: "router_not_ready",
      });
      return this.handleConversation(ws, data, state, context);
    }

    const intent = await this.intentRouter.detect(message, context);

    console.log(`[Server:${msgId}] 🎯 INTENT DETECTED`, {
      domain: intent?.domain,
      intent: intent?.intent,
      canRoute:
        intent && this.intentRouter.canRoute(intent.domain, intent.intent),
    });

    if (!intent || !this.intentRouter.canRoute(intent.domain, intent.intent)) {
      console.log(`[Server:${msgId}] 💬 ROUTING TO CONVERSATION`);
      WsResponseFormatter.sendProgress(ws, "routing_conversation", {
        reason: "no_intent_route",
      });
      return this.handleConversation(ws, data, state, context);
    }

    console.log(`[Server:${msgId}] 🚀 EXECUTING WORKFLOW`, {
      domain: intent.domain,
      intent: intent.intent,
    });

    WsResponseFormatter.sendProgress(ws, "executing_workflow", {
      domain: intent.domain,
      intent: intent.intent,
    });

    const result = await this.intentRouter.executeWorkflow(
      intent.domain,
      intent.intent,
      context
    );

    console.log(`[Server:${msgId}] 📤 WORKFLOW RESULT`, {
      success: result.success,
      dataKeys: result.data ? Object.keys(result.data) : [],
    });

    if (result.success) {
      WsResponseFormatter.sendSkillResult(
        ws,
        intent.intent,
        intent.domain,
        result.data
      );
    } else {
      console.log(
        `[Server:${msgId}] ↩️ WORKFLOW FAILED, FALLBACK TO CONVERSATION`
      );
      await this.handleConversation(ws, data, state, context);
    }
  }

  private async handleConversation(
    ws: any,
    data: SkillExecutionRequest,
    state: ChatState,
    context: any
  ): Promise<void> {
    const msgId = crypto.randomUUID().substring(0, 8);
    const startTime = Date.now();
    console.log(`[Server:${msgId}] 💬 EXECUTING CONVERSATION SKILL`, {
      timestamp: new Date().toISOString(),
      messageContent: data.content || data.message,
    });

    WsResponseFormatter.sendProgress(ws, "executing_conversation", {
      stage: "initializing",
    });

    // Ensure skillManager is initialized
    if (!this.skillManager) {
      console.log(`[Server:${msgId}] ⚠️ SKILL MANAGER NOT INITIALIZED`);
      WsResponseFormatter.sendError(ws, "System not fully initialized");
      return;
    }

    console.log(`[Server:${msgId}] ✅ SKILL MANAGER READY, executing...`);

    return new Promise<void>((resolve) => {
      console.log(`[Server:${msgId}] 📞 CALLING executeSkill WITH:`, {
        skillId: "conversation",
        hasInput: !!data.content || !!data.message,
        hasContext: !!context,
        hasCallbacks: true,
      });

      this.skillManager.executeSkill(
        ws,
        {
          skillId: "conversation",
          input: { message: data.content || data.message },
          context,
        },
        (result) => {
          const duration = Date.now() - startTime;
          console.log(`[Server:${msgId}] ✅ CONVERSATION RESPONSE RECEIVED`, {
            duration,
            resultSuccess: result.success,
            responseLen: result.data?.response?.length || 0,
            hasError: !!result.error,
          });

          if (!result.data?.response) {
            console.warn(`[Server:${msgId}] ⚠️ NO RESPONSE DATA:`, result);
          }

          WsResponseFormatter.sendProgress(ws, "generating_response", {
            stage: "complete",
          });
          const agentResponse = result.data?.response || "";
          console.log(`[Server:${msgId}] 📝 ADDING MESSAGE TO STATE`, {
            responseLen: agentResponse.length,
          });
          StateManager.addMessage(state, "agent", agentResponse);
          console.log(`[Server:${msgId}] 📤 SENDING AGENT MESSAGE TO WS`, {
            contentLen: agentResponse.length,
          });
          WsResponseFormatter.sendAgentMessage(ws, agentResponse);
          console.log(`[Server:${msgId}] ✨ RESOLVING PROMISE`);
          resolve();
        },
        (error) => {
          const duration = Date.now() - startTime;
          console.error(`[Server:${msgId}] ❌ CONVERSATION ERROR`, {
            duration,
            error,
            errorMessage: error?.message || error,
          });

          // Send error as agent message to user
          let errorMessage =
            "I encountered an issue processing your request. Please try again.";

          if (typeof error === "string") {
            if (error.includes("3040")) {
              errorMessage =
                "The AI service is temporarily at capacity. Please try again in a moment.";
            } else if (error.includes("timeout")) {
              errorMessage = "The request timed out. Please try again.";
            } else {
              errorMessage = `Service error: ${error}`;
            }
          } else if (error?.message) {
            if (error.message.includes("3040")) {
              errorMessage =
                "The AI service is temporarily at capacity. Please try again in a moment.";
            } else if (error.message.includes("timeout")) {
              errorMessage = "The request timed out. Please try again.";
            } else {
              errorMessage = `Service error: ${error.message}`;
            }
          }

          console.log(`[Server:${msgId}] 📝 ADDING ERROR MESSAGE TO STATE`, {
            errorLen: errorMessage.length,
          });
          StateManager.addMessage(state, "agent", errorMessage);
          WsResponseFormatter.sendAgentMessage(ws, errorMessage);
          resolve();
        }
      );
      console.log(`[Server:${msgId}] ⏳ WAITING FOR SKILL EXECUTION...`);
    });
  }
}
