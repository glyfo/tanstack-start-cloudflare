import { Env } from "../types/env";

export interface AIResponseStream {
  [Symbol.asyncIterator](): AsyncIterator<any>;
}

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class AIService {
  private env: Env;
  private modelId: string;

  constructor(env: Env) {
    this.env = env;
    this.modelId = env.AI_MODEL || "@cf/zai-org/glm-4.7-flash";
  }

  /**
   * Generate a streaming response
   */
  async generateStream(
    messages: AIMessage[],
    systemPrompt?: string,
    tools?: any[] // Future support for function calling
  ): Promise<Response> {
    const aiMessages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages
    ];

    try {
      const response = await this.env.AI.run(this.modelId, {
        messages: aiMessages,
        stream: true,
        tools: tools // Pass tools when supported by model/binding
      });

      if (!response) {
        throw new Error("AI service returned invalid response");
      }

      // Return as standard Response with SSE headers
      return new Response(response, {
        headers: { "Content-Type": "text/event-stream" },
      });

    } catch (error) {
      console.error("[AIService] Generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate a single response (non-streaming)
   */
  async generate(
    messages: AIMessage[],
    systemPrompt?: string,
    tools?: any[]
  ): Promise<string> {
    const aiMessages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages
    ];

    try {
      const response = await this.env.AI.run(this.modelId, {
        messages: aiMessages,
        stream: false,
        tools: tools
      });

      return response.response || "";
    } catch (error) {
      console.error("[AIService] Generation failed:", error);
      throw error;
    }
  }
}
