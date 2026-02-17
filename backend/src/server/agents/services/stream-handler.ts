/**
 * StreamHandler - Extracted from ChatAgent.handleChat
 *
 * Handles the full lifecycle of a chat message:
 * sanitization, rate limiting, message persistence,
 * processing, AI streaming, and error handling.
 */
import type { Connection } from "agents";
import type { Message } from "../chat-agent-types";
import { StorageError } from "../chat-agent-storage";
import { getFlow } from "../../workflows/conversational-flows";

export class StreamHandler {
  constructor(
    private agent: any, // Reference to ChatAgent instance
  ) {}

  /**
   * Handle chat messages - preserves all existing functionality
   * This method is used when clients send "user-message" type messages
   */
  async handleChat(connection: Connection, content: string, messageId?: string) {
    try {
      console.log("[ChatAgent] handleChat START");
      const sanitized = this.agent.sanitizeInput(content);
      console.log("[ChatAgent] Input sanitized");

      if (this.agent.checkRateLimit(connection)) {
        connection.send(
          JSON.stringify({
            type: "error",
            message: "Rate limit exceeded",
            code: "RATE_LIMIT_EXCEEDED"
          })
        );
        return;
      }
      console.log("[ChatAgent] Rate limit check passed");

      // Store current connection for context
      this.agent.currentConnection = connection;

      const userMessage: Message = {
        id: messageId || Math.random().toString(36).slice(2),
        role: "user",
        content: sanitized,
        parts: [{ type: "text", text: sanitized }],
        timestamp: Date.now(),
      };
      console.log("[ChatAgent] User message created");

      // Save to SQLite via AIChatAgent
      await this.agent.saveMessageWithRetry(userMessage);
      console.log("[ChatAgent] Message saved");

      // Broadcast user message to ALL clients
      this.agent.safeBroadcast({ type: "message", message: userMessage });
      console.log("[ChatAgent] Message broadcasted");

      // Track metadata
      const startTime = Date.now();

      // Process the message
      console.log("[ChatAgent] Processing message...");
      const { systemPrompt, toolCalls, shouldReturnDirectResponse, directResponse } =
        await this.agent.processUserMessage(sanitized, connection);
      console.log("[ChatAgent] Message processed, toolCalls:", toolCalls?.length || 0);

      // If shouldReturnDirectResponse is true, skip LLM streaming
      if (shouldReturnDirectResponse) {
        // Only send a message if directResponse has content
        if (directResponse && directResponse.trim()) {
          const assistantMessage: Message = {
            id: Math.random().toString(36).slice(2),
            role: "assistant",
            content: directResponse,
            parts: [{ type: "text", text: directResponse }],
            timestamp: Date.now(),
            metadata: {
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              processingTime: Date.now() - startTime,
            },
          };

          await this.agent.saveMessageWithRetry(assistantMessage);
          this.agent.safeBroadcast({ type: "message-done", messageId: assistantMessage.id, message: assistantMessage });
        }
        // For forms (empty directResponse), state update already sent - skip streaming
        console.log('[ChatAgent] Skipping LLM stream - direct response handled (form or data)');
        return;
      }

      // Stream response using Workers AI
      let responseText = "";
      const assistantMessageId = Math.random().toString(36).slice(2);

      this.agent.safeBroadcast({ type: "status", phase: "analyzing" });
      this.agent.safeBroadcast({ type: "message-start", messageId: assistantMessageId });
      this.agent.safeBroadcast({ type: "status", phase: "formatting" });

      if (!this.agent.env.AI) {
        throw new Error("AI service not configured");
      }

      const modelId = this.agent.env.AI_MODEL || "@cf/zai-org/glm-4.7-flash";

      // Build messages
      type AIMessage = { role: "user" | "assistant" | "system"; content: string };
      console.log("[ChatAgent] Getting messages history...");
      const messagesHistory = await this.agent.getMessages();
      console.log("[ChatAgent] Messages history retrieved:", messagesHistory?.length || 0);
      if (!messagesHistory || !Array.isArray(messagesHistory)) {
        console.error("[ChatAgent] ERROR: messagesHistory is not an array:", typeof messagesHistory);
        throw new Error("Messages history is not an array");
      }
      const aiMessages: AIMessage[] = messagesHistory.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      console.log("[ChatAgent] AI messages built:", aiMessages.length);

      // Add tool results to context (truncated to avoid exceeding token limits)
      if (toolCalls.length > 0) {
        const MAX_RESULT_LEN = 4000;
        const toolResultsContext = toolCalls.map((tc: any) => {
          if (tc.result) {
            let resultStr = JSON.stringify(tc.result);
            if (resultStr.length > MAX_RESULT_LEN) {
              resultStr = resultStr.slice(0, MAX_RESULT_LEN) + '... [truncated]';
            }
            return `Tool ${tc.tool} executed successfully with result: ${resultStr}`;
          } else {
            return `Tool ${tc.tool} failed: ${tc.error}`;
          }
        }).join('\n');

        aiMessages.push({
          role: "system",
          content: `Tool Execution Results:\n${toolResultsContext}\n\nNow provide a natural response.`
        });
      }

      // Add UI context
      if (this.agent.smartContext && Object.keys(this.agent.smartContext).length > 0) {
        const contextInfo: string[] = [];

        if (this.agent.smartContext.activeForm) {
          contextInfo.push(`User is viewing form: ${this.agent.smartContext.activeForm}`);
        }

        if (this.agent.smartContext.conversationalFlow?.status === 'active') {
          const flow = this.agent.smartContext.conversationalFlow;
          const flowDef = getFlow(flow.flowId);
          if (flowDef && flowDef.stages && flow.stage < flowDef.stages.length) {
            const stage = flowDef.stages[flow.stage];
            contextInfo.push(`ACTIVE FLOW: ${flowDef.name} - Stage ${flow.stage + 1}/${flowDef.stages.length}`);
            if (stage?.formComponent) {
              contextInfo.push(`REQUIRED: Show ${stage.formComponent} form`);
            }
          }
        }

        if (contextInfo.length > 0) {
          aiMessages.push({ role: "system", content: `UI Context:\n${contextInfo.join("\n")}` });
        }
      }

      try {
        const response = await this.agent.env.AI.run(modelId, {
          messages: [
            { role: "system", content: systemPrompt },
            ...aiMessages,
          ],
          stream: true,
        });

        if (!response || typeof response.getReader !== 'function') {
          throw new Error("AI service returned invalid response");
        }

        const reader = response.getReader();
        const decoder = new TextDecoder();
        const STREAM_TIMEOUT_MS = 60000; // 60s max for entire stream
        let lastChunkTime = Date.now();

        let chunkCount = 0;
        while (true) {
          // Timeout guard: abort if no data for 60s
          const timeSinceLastChunk = Date.now() - lastChunkTime;
          if (timeSinceLastChunk > STREAM_TIMEOUT_MS) {
            console.error(`[ChatAgent] Stream timeout after ${STREAM_TIMEOUT_MS}ms of inactivity`);
            try { reader.cancel(); } catch (_) { /* Stream already closed or cancelled - safe to ignore */ }
            throw new Error("Stream timeout: AI service stopped responding");
          }

          const { done, value } = await reader.read();
          if (done) {
            console.log(`[ChatAgent] Stream done. Total chunks: ${chunkCount}, responseText length: ${responseText.length}`);
            break;
          }
          lastChunkTime = Date.now();

          const chunk = decoder.decode(value);
          chunkCount++;

          // Log raw chunk for debugging
          console.log(`[ChatAgent] Raw chunk #${chunkCount}:`, chunk.slice(0, 500));

          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.trim().length === 0) continue;

            console.log(`[ChatAgent] Processing line:`, line.slice(0, 200));

            if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') {
                console.log('[ChatAgent] Received [DONE] signal');
                continue;
              }
              try {
                const data = JSON.parse(payload);
                console.log('[ChatAgent] Parsed data:', JSON.stringify(data).slice(0, 300));

                // Cloudflare Workers AI uses OpenAI-compatible format
                const text = data.choices?.[0]?.delta?.content
                  || data.response
                  || data.text
                  || data.content
                  || data.message
                  || '';
                if (text) {
                  console.log(`[ChatAgent] Got text (${text.length} chars):`, text.slice(0, 100));
                  responseText += text;
                  this.agent.safeBroadcast({
                    type: "message-chunk",
                    messageId: assistantMessageId,
                    chunk: text,
                  });
                } else {
                  console.warn('[ChatAgent] No text in chunk. Keys:', Object.keys(data).join(', '));
                }
              } catch (e) {
                console.error('[ChatAgent] JSON parse error:', e, 'Payload:', payload.slice(0, 200));
              }
            } else {
              console.log('[ChatEngine] Line does not start with "data: ":', line.slice(0, 100));
            }
          }
        }

      } catch (err) {
        console.error('[ChatAgent] Stream error:', err);

        let userMessage = "I'm having trouble responding right now. Please try again.";
        let errorCode = "STREAM_ERROR";

        if (err instanceof Error) {
          if (err.message.includes("invalid response")) {
            userMessage = "The AI service is temporarily unavailable.";
            errorCode = "AI_SERVICE_ERROR";
          } else if (err.message.includes("timeout")) {
            userMessage = "The request took too long. Please try again.";
            errorCode = "TIMEOUT_ERROR";
          }
        }

        // If we already streamed partial content, close that message first
        if (responseText.length > 0) {
          const partialMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: responseText + "\n\n_(Response interrupted)_",
            parts: [{ type: "text", text: responseText + "\n\n_(Response interrupted)_" }],
            timestamp: Date.now(),
          };
          await this.agent.saveMessageWithRetry(partialMessage);
          this.agent.safeBroadcast({ type: "message-done", messageId: assistantMessageId, message: partialMessage });
          return;
        }

        this.agent.safeBroadcast({ type: "error", message: userMessage, code: errorCode });

        const errorMessage: Message = {
          id: Math.random().toString(36).slice(2),
          role: "assistant",
          content: userMessage,
          parts: [{ type: "text", text: userMessage }],
          timestamp: Date.now(),
        };

        await this.agent.saveMessageWithRetry(errorMessage);
        this.agent.safeBroadcast({ type: "message-done", messageId: errorMessage.id, message: errorMessage });
        return;
      }

      // Save assistant message
      const processingTime = Date.now() - startTime;
      let summary: string | undefined;
      if (responseText.length > 200) {
        const sentences = responseText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;
      }

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: responseText,
        parts: [{ type: "text", text: responseText }],
        timestamp: Date.now(),
        metadata: {
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          summary,
          processingTime,
          modelUsed: modelId,
        },
      };

      await this.agent.saveMessageWithRetry(assistantMessage);
      this.agent.safeBroadcast({ type: "message-done", messageId: assistantMessageId, message: assistantMessage });

    } catch (error) {
      console.error('[ChatAgent] handleChat error:', error);

      const errorCode = error instanceof StorageError ? "STORAGE_ERROR" : "CHAT_ERROR";

      connection.send(JSON.stringify({
        type: "error",
        message: error instanceof Error ? error.message : "An error occurred",
        code: errorCode,
        retryable: error instanceof StorageError,
      }));
    }
  }
}
