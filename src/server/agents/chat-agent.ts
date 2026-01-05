import { Agent, Connection } from "agents";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export class ChatAgent extends Agent<any> {
  private connections: Set<Connection> = new Set();

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
