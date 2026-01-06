import { Agent, Connection } from "agents";
import { AgentStateMachine } from "./agent-state-machine";
import { ChatAgentState } from "./types";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export class ChatAgent extends Agent<any, ChatAgentState> {
  private connections: Set<Connection> = new Set();
  private stateMachine!: AgentStateMachine;

  // SDK-recommended approach: use initialState property
  initialState: ChatAgentState = {
    agentLoop: {
      phase: "idle",
      iteration: 0,
      maxIterations: 10,
      progress: 0,
      lastUpdate: Date.now(),
    },
  };

  constructor(state: any, env: any) {
    super(state, env);
    // Initialize state machine after super() call
    // At this point, SDK has initialized this.state with initialState
    this.stateMachine = new AgentStateMachine(this);
  }

  async onConnect(connection: Connection): Promise<void> {
    this.connections.add(connection);
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    console.log(
      `[ChatAgent] WS closed: ${code} - ${reason} - wasClean: ${wasClean}`
    );
    this.connections.delete(connection);
    connection.close();
  }

  async onError(
    connectionOrError: Connection | unknown,
    error?: unknown
  ): Promise<void> {
    if (error !== undefined) {
      const connection = connectionOrError as Connection;
      this.connections.delete(connection);
    }
    console.error(`[ChatAgent] WS error:`, error || connectionOrError);
  }

  async onMessage(connection: Connection, data: any): Promise<void> {
    try {
      const message = typeof data === "string" ? JSON.parse(data) : data;

      if (this.stateMachine.isActive()) {
        connection.send(
          JSON.stringify({
            type: "error",
            message: "Agent is processing a goal. Please wait.",
          })
        );
        return;
      }

      if (message.type === "agent-goal") {
        await this.executeAgentLoop(
          connection,
          message.content,
          message.maxIterations
        );
        return;
      }

      if (message.type === "user-message") {
        await this.handleChat(connection, message.content);
      } else if (message.type === "get-messages") {
        const messages = await this.getMessages();
        connection.send(JSON.stringify({ type: "messages-list", messages }));
      }
    } catch (error) {
      console.error("[ChatAgent] Error:", error);
      connection.send(
        JSON.stringify({
          type: "error",
          message: "An error occurred. Please try again.",
        })
      );
    }
  }

  private async executeAgentLoop(
    connection: Connection,
    goal: string,
    maxIterations: number = 10
  ): Promise<void> {
    try {
      await this.stateMachine.initialize(goal, maxIterations);
      let continueLoop = true;
      let iteration = 0;

      while (continueLoop) {
        iteration++;

        await this.stateMachine.transition("observing", {
          currentAction: "Gathering context",
        });
        const observation = await this.observe();
        await this.stateMachine.updateProgress(
          (iteration / maxIterations) * 25
        );

        await this.stateMachine.transition("thinking", {
          currentAction: "Planning action",
        });
        const plan = await this.think(goal, observation);
        await this.stateMachine.updateProgress(
          (iteration / maxIterations) * 50,
          "Action planned",
          plan.reasoning
        );

        await this.stateMachine.transition("acting", {
          currentAction: plan.action,
          reasoning: plan.reasoning,
        });
        const result = await this.act(connection, plan);
        await this.stateMachine.updateProgress(
          (iteration / maxIterations) * 75
        );

        await this.stateMachine.transition("learning", {
          currentAction: "Storing results",
        });
        await this.learn(plan, result);
        await this.stateMachine.updateProgress(
          (iteration / maxIterations) * 100
        );

        const goalAchieved = result.success === true;
        const canContinue = await this.stateMachine.nextIteration();
        continueLoop = !goalAchieved && canContinue;

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await this.stateMachine.complete(true, { goal, iterations: iteration });
    } catch (error) {
      console.error("[ChatAgent] Agent loop error:", error);
      await this.stateMachine.complete(false, { error: String(error) });
    }
  }

  private async observe(): Promise<any> {
    const messages = await this.getMessages();
    return { conversationHistory: messages, timestamp: Date.now() };
  }

  private async think(goal: string, observation: any): Promise<any> {
    try {
      const response = await (this as any).env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: `Goal: ${goal}\nDecide next action. Return JSON: {"action":"respond|wait","reasoning":"why","content":"message"}`,
          },
          {
            role: "user",
            content: `Goal: ${goal}\nHistory: ${JSON.stringify(
              observation.conversationHistory.slice(-3)
            )}`,
          },
        ],
      });

      try {
        const plan = JSON.parse(response.response);
        return {
          action: plan.action || "respond",
          reasoning: plan.reasoning || "Responding",
          content: plan.content || `Working on: ${goal}`,
        };
      } catch {
        return {
          action: "respond",
          reasoning: "Fallback",
          content: response.response || `Working on: ${goal}`,
        };
      }
    } catch {
      return {
        action: "respond",
        reasoning: "Error",
        content: "Let me try a different approach.",
      };
    }
  }

  private async act(connection: Connection, plan: any): Promise<any> {
    if (plan.action === "respond") {
      await this.handleChat(connection, plan.content);
      return { success: true, action: "respond" };
    }
    return { success: true, action: "wait" };
  }

  private async learn(plan: any, result: any): Promise<void> {
    await (this as any).ctx.storage.put(`memory:${Date.now()}`, {
      timestamp: Date.now(),
      plan,
      result,
      success: result.success,
    });
  }

  private async handleChat(
    _connection: Connection,
    content: string
  ): Promise<void> {
    try {
      // Save user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
        timestamp: Date.now(),
      };
      await this.saveMessage(userMsg);

      // Get history and call AI
      const history = await this.getMessages();
      const messages = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await (this as any).env.AI.run(MODEL, {
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      });

      // Stream response
      const assistantId = crypto.randomUUID();
      let fullText = "";

      this.broadcast(
        JSON.stringify({ type: "message-start", messageId: assistantId })
      );

      const reader = response.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.response) {
                fullText += data.response;
                this.broadcast(
                  JSON.stringify({
                    type: "message-chunk",
                    messageId: assistantId,
                    chunk: data.response,
                  })
                );
              }
            } catch (e) {}
          }
        }
      }

      // Save complete message
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: fullText,
        parts: [{ type: "text", text: fullText }],
        timestamp: Date.now(),
      };
      await this.saveMessage(assistantMsg);

      this.broadcast(
        JSON.stringify({
          type: "message-done",
          messageId: assistantId,
          message: assistantMsg,
        })
      );
    } catch (error) {
      console.error("[ChatAgent] Chat error:", error);
      this.broadcast(
        JSON.stringify({
          type: "error",
          message: "Failed to get AI response.",
        })
      );
    }
  }

  private async saveMessage(message: Message): Promise<void> {
    await (this as any).ctx.storage.put(`message:${message.id}`, message);
  }

  private async getMessages(): Promise<Message[]> {
    const entries = await (this as any).ctx.storage.list({
      prefix: "message:",
    });
    const messages = Array.from(entries.values()).map((m: any) => ({
      ...m,
      parts: m.parts || [{ type: "text", text: m.content || "" }],
    })) as Message[];
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }
}
