/**
 * [REQUIRED] Conversation Skill
 *
 * Handles general conversation via AI.
 * Shared skill used across all domains.
 * Integrates with Cloudflare AI for natural language responses.
 *
 * CATEGORY: conversation
 * EXTENDS: BaseSkill
 * USED BY: IntentRouter, SkillManager (fallback)
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";

export class ConversationSkill extends BaseSkill {
  metadata: SkillMetadata = {
    id: "conversation",
    name: "Conversation",
    description: "Handle general conversation via AI",
    version: "1.0.0",
    category: "conversation",
    tags: ["ai", "streaming", "chat"],
  };

  private aiModel = "@cf/meta/llama-3.1-8b-instruct";

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
  }

  async execute(input: any): Promise<SkillResult> {
    console.log("[ConversationSkill] 🔄 EXECUTE called with input:", {
      hasMessage: !!input?.message,
      messageLen: input?.message?.length || 0,
      messagePreview: input?.message?.substring(0, 50),
    });

    if (!input.message || typeof input.message !== "string") {
      console.error("[ConversationSkill] ❌ INVALID INPUT:", input);
      return {
        success: false,
        error: "Invalid input: message (string) required",
      };
    }

    try {
      console.log("[ConversationSkill] ✅ INPUT VALIDATION PASSED");
      this.validateContext();
      console.log("[ConversationSkill] ✅ CONTEXT VALIDATED");

      console.log("[ConversationSkill] 🧠 CALLING generateResponse...");
      const response = await this.generateResponse(
        input.message,
        this.context!.messageHistory || []
      );

      console.log("[ConversationSkill] ✅ RESPONSE GENERATED", {
        responseLen: response.length,
        responsePreview: response.substring(0, 100),
      });

      return {
        success: true,
        data: {
          response,
          isStream: false,
          metadata: {
            model: this.aiModel,
            timestamp: new Date().toISOString(),
          },
        },
      };
    } catch (error: any) {
      console.error("[ConversationSkill] 💥 EXCEPTION in execute:", {
        errorMessage: error.message,
        errorStack: error.stack?.substring(0, 300),
      });
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  canHandle(input: any): boolean {
    return input && typeof input.message === "string";
  }

  /**
   * Generate AI response with retry logic for capacity errors
   */
  private async generateResponse(
    message: string,
    history: any[]
  ): Promise<string> {
    console.log("[ConversationSkill.generateResponse] 🤖 CALLED", {
      messageLen: message.length,
      historyLen: history.length,
    });

    const ai = (this.context!.env as any)?.AI;
    if (!ai) {
      console.error("[ConversationSkill.generateResponse] ❌ AI NOT AVAILABLE");
      throw new Error("AI not configured in environment");
    }

    console.log("[ConversationSkill.generateResponse] ✅ AI AVAILABLE");

    // Build system prompt for contact creation guidance
    let systemPrompt =
      "You are a helpful assistant. Keep responses brief and direct.";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("contact") || lowerMessage.includes("create")) {
      systemPrompt = `Keep responses very brief. If user wants to create a contact, say: "Let me help you create a contact. I'll ask for: Name, Phone, Email, and optional fields like Address and Notes. Ready?" Do not provide long explanations.`;
    }

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10).map((m: any) => ({
        role: m.role === "agent" ? "assistant" : m.role,
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    console.log("[ConversationSkill.generateResponse] 📨 CALLING AI", {
      messagesCount: messages.length,
      model: this.aiModel,
    });

    // Retry logic for capacity errors
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[ConversationSkill.generateResponse] 🔄 AI.RUN attempt ${attempt + 1}/${maxRetries + 1}...`
        );
        const response = await ai.run(this.aiModel, {
          messages,
          stream: false,
          max_tokens: 1024,
          temperature: 0.7,
        });

        console.log(
          "[ConversationSkill.generateResponse] 📦 AI RESPONSE RECEIVED",
          {
            responseType: typeof response,
            isString: typeof response === "string",
            hasResponse: !!response?.response,
            hasAsyncIterator: !!response?.[Symbol.asyncIterator],
          }
        );

        if (typeof response === "string") {
          console.log(
            "[ConversationSkill.generateResponse] ✅ RESPONSE IS STRING"
          );
          return response;
        }

        if (response.response) {
          console.log(
            "[ConversationSkill.generateResponse] ✅ RESPONSE HAS .response PROPERTY"
          );
          return response.response;
        }

        if (response[Symbol.asyncIterator]) {
          console.log(
            "[ConversationSkill.generateResponse] 🔄 RESPONSE IS ASYNC ITERATOR"
          );
          let text = "";
          for await (const chunk of response) {
            console.log("[ConversationSkill.generateResponse] 📦 CHUNK:", {
              chunkLen: chunk.response?.length || 0,
            });
            if (chunk.response) {
              text += chunk.response;
            }
          }
          console.log(
            "[ConversationSkill.generateResponse] ✅ ITERATION COMPLETE",
            {
              totalLen: text.length,
            }
          );
          return text;
        }

        console.log(
          "[ConversationSkill.generateResponse] ⚠️ UNKNOWN RESPONSE FORMAT, STRINGIFYING"
        );
        return JSON.stringify(response);
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || String(error);
        console.error(
          `[ConversationSkill.generateResponse] 💥 AI CALL ERROR (attempt ${attempt + 1}):`,
          {
            errorMessage: errorMsg,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            willRetry: attempt < maxRetries && errorMsg.includes("3040"),
          }
        );

        // Check if it's a capacity or prompt error and we have retries left
        if (
          (errorMsg.includes("3040") || errorMsg.includes("9015")) &&
          attempt < maxRetries
        ) {
          const delayMs = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s...
          console.log(
            `[ConversationSkill.generateResponse] ⏳ RETRYING in ${delayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // If not a retry-able error or out of retries, throw
        throw new Error(`AI service error: ${errorMsg}`);
      }
    }

    // Should never reach here, but just in case
    throw new Error(
      `AI service error: ${lastError.message || "Unknown error"}`
    );
  }

  async cleanup(_context: SkillContext): Promise<void> {
    // No cleanup needed
  }
}
