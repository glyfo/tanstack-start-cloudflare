import { Agent } from "agents";
import { env } from "cloudflare:workers";
import { A2UIBuilder } from "./a2ui-builder";
import type { A2UIComponent } from "@/types/a2ui-schema";

/**
 * Chat Agent - extends Cloudflare Agents framework
 * ================================================
 *
 * Built-in features:
 * - this.ctx.storage.kv - Key-value storage (SQL-backed)
 * - this.env - Environment bindings (AI, etc.)
 * - WebSocket support with streaming AI responses
 *
 * Supports both text streaming and A2UI component trees
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  a2uiComponents?: A2UIComponent[];
}

export interface ChatState {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  lastUpdated: number;
}

export class ChatAgent extends Agent {
  /**
   * Initialize agent state
   */
  async initialize() {
    const state = (await this.state) as any;
    if (!state || !state.sessionId) {
      await this.setState({
        sessionId: crypto.randomUUID(),
        userId: "",
        messages: [],
        context: {},
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  async onConnect(ws: any) {
    console.log("[ChatAgent] Client connected");
    await this.initialize();

    // Send welcome message with current state
    const state = (await this.state) as any;
    ws.send(
      JSON.stringify({
        type: "welcome",
        sessionId: state.sessionId,
        messages: state.messages,
      })
    );
  }

  /**
   * Parse SSE stream from Cloudflare AI
   * Cloudflare returns SSE format with data: prefix and JSON chunks
   */
  private async *parseSSEStream(response: any): AsyncGenerator<string> {
    try {
      let stream: ReadableStream<Uint8Array> | null = null;

      // Handle Response object with .body
      if (response && typeof response === "object" && response.body) {
        stream = response.body;
      }
      // Handle if response is already an AsyncIterable
      else if (
        typeof response?.[Symbol.asyncIterator] === "function" ||
        typeof response?.[Symbol.iterator] === "function"
      ) {
        // Response is already iterable, iterate through it directly
        const decoder = new TextDecoder();
        let buffer = "";

        for await (const chunk of response) {
          // Handle Uint8Array or string chunks
          let chunkStr = "";
          if (typeof chunk === "string") {
            chunkStr = chunk;
          } else if (chunk instanceof Uint8Array) {
            chunkStr = decoder.decode(chunk, { stream: true });
          } else if (typeof chunk === "object" && "response" in chunk) {
            // Already parsed JSON object
            if (chunk.response) {
              yield chunk.response;
            }
            continue;
          }

          buffer += chunkStr;
          const lines = buffer.split("\n");

          // Process complete lines, keep incomplete line in buffer
          buffer = lines[lines.length - 1];

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line.startsWith(":")) continue;

            // Parse SSE format: "data: {json}"
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);

              // Handle [DONE] signal
              if (dataStr === "[DONE]") {
                return;
              }

              // Parse JSON and extract response field
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.response) {
                  yield parsed.response;
                }
              } catch (parseErr) {
                console.log(
                  "[ChatAgent] Failed to parse SSE data:",
                  dataStr.substring(0, 100)
                );
              }
            }
          }
        }

        // Handle remaining buffer
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr !== "[DONE]") {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.response) {
                  yield parsed.response;
                }
              } catch (parseErr) {
                console.log(
                  "[ChatAgent] Failed to parse final SSE data:",
                  dataStr.substring(0, 100)
                );
              }
            }
          }
        }
        return;
      } else {
        console.log(
          "[ChatAgent] Response format not recognized:",
          typeof response
        );
        return;
      }

      // Handle Response.body stream
      if (stream) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Process complete lines, keep incomplete line in buffer
          buffer = lines[lines.length - 1];

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line.startsWith(":")) continue;

            // Parse SSE format: "data: {json}"
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);

              // Handle [DONE] signal
              if (dataStr === "[DONE]") {
                return;
              }

              // Parse JSON and extract response field
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.response) {
                  yield parsed.response;
                }
              } catch (parseErr) {
                console.log(
                  "[ChatAgent] Failed to parse SSE data:",
                  dataStr.substring(0, 100)
                );
              }
            }
          }
        }

        // Handle remaining buffer
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr !== "[DONE]") {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.response) {
                  yield parsed.response;
                }
              } catch (parseErr) {
                console.log(
                  "[ChatAgent] Failed to parse final SSE data:",
                  dataStr.substring(0, 100)
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[ChatAgent] SSE parsing error:", error);
    }
  }

  /**
   * Generate AI response using Cloudflare AI with native streaming
   * Model: Llama 3.1 8B - proven streaming support
   */
  private async generateAIResponse(
    messages: ChatMessage[]
  ): Promise<AsyncIterable<string> | string> {
    try {
      // Build message history for the model
      const conversationMessages = messages
        .slice(-10) // Last 10 messages for context
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      console.log(
        "[ChatAgent] Calling AI with",
        conversationMessages.length,
        "messages - STREAMING MODE"
      );

      // Access AI binding from Cloudflare env
      const ai = (env as any)?.AI;

      if (!ai) {
        console.error("[ChatAgent] AI binding not configured");
        throw new Error("AI service is not configured");
      }

      console.log("[ChatAgent] AI binding available, calling model...");

      // Call Cloudflare AI with native streaming
      // Using Llama 3.1 8B with proven streaming support
      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: conversationMessages,
        stream: true, // ← Enable native streaming via SSE
        max_tokens: 1024,
        temperature: 0.7,
      });

      console.log(
        "[ChatAgent] Response received - type:",
        typeof response,
        "constructor:",
        response?.constructor?.name
      );

      // Return the response (could be stream or string)
      return response;
    } catch (error: any) {
      console.error("[ChatAgent] AI error:", error);
      
      // Return fallback response for error code 1031 (service unavailable)
      if (error?.code === 1031 || error?.message?.includes("1031")) {
        console.log("[ChatAgent] AI service unavailable (1031), returning fallback response");
        const fallbackResponse = "I apologize, but the AI service is temporarily unavailable. Please try again in a moment.";
        
        // Create a mock async iterable that yields the fallback text
        const mockStream = {
          async *[Symbol.asyncIterator]() {
            yield fallbackResponse;
          },
        };
        
        return mockStream;
      }
      
      throw error;
    }
  }

  /**
   * Handle incoming messages from WebSocket
   */
  async onMessage(ws: any, message: string) {
    try {
      const data = JSON.parse(message);
      console.log("[ChatAgent] Message received:", {
        type: data.type,
        contentLen: data.content?.length,
      });

      const state = (await this.state) as any;

      if (data.type === "chat") {
        // Add user message to state
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: data.content,
          timestamp: Date.now(),
        };

        const messages = state.messages || [];
        const updatedMessages = [...messages, userMsg];
        const newState = {
          ...state,
          userId: data.userId || state.userId,
          messages: updatedMessages,
          lastUpdated: Date.now(),
        };

        await this.setState(newState);

        // Send user message confirmation
        ws.send(
          JSON.stringify({
            type: "message_added",
            message: userMsg,
          })
        );

        // Generate AI response with streaming
        try {
          console.log("[ChatAgent] Generating AI response (streaming mode)...");
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "", // Will accumulate chunks
            timestamp: Date.now(),
          };

          // Get response (could be stream or string)
          const response = await this.generateAIResponse(updatedMessages);

          const responseAny = response as any;
          const isAsyncIterable =
            typeof responseAny?.[Symbol.asyncIterator] === "function";
          const isIterable =
            isAsyncIterable ||
            typeof responseAny?.[Symbol.iterator] === "function";

          console.log(
            "[ChatAgent] Response type:",
            typeof response,
            "is iterable:",
            isIterable
          );

          if (isIterable) {
            // Handle streaming response via SSE parser
            console.log(
              "[ChatAgent] Processing streaming response (SSE format)..."
            );

            for await (const chunkText of this.parseSSEStream(response)) {
              if (
                chunkText &&
                typeof chunkText === "string" &&
                chunkText.length > 0
              ) {
                assistantMsg.content += chunkText;

                // Send chunk to client - clean format
                ws.send(
                  JSON.stringify({
                    type: "message_stream",
                    id: assistantMsg.id,
                    chunk: chunkText,
                    role: "assistant",
                  })
                );

                console.log(
                  "[ChatAgent] Sent chunk (" +
                    chunkText.length +
                    " chars), accumulated: " +
                    assistantMsg.content.length
                );
              }
            }
          } else if (typeof response === "string") {
            // Handle non-streaming string response - split into chunks for UI
            console.log("[ChatAgent] Processing non-streaming response...");
            console.log(
              "[ChatAgent] Response text:",
              response.substring(0, 100)
            );

            assistantMsg.content = response;

            // Send as streaming chunks for consistent UI experience
            // Split by words but preserve spaces
            const words = response.split(/\s+/); // Split on whitespace
            console.log("[ChatAgent] Split into", words.length, "words");

            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              // Add space after word (except last word)
              const chunkToSend = i < words.length - 1 ? word + " " : word;

              ws.send(
                JSON.stringify({
                  type: "message_stream",
                  id: assistantMsg.id,
                  chunk: chunkToSend,
                  role: "assistant",
                })
              );

              console.log(
                "[ChatAgent] Sent chunk",
                i + 1,
                "of",
                words.length,
                ":",
                chunkToSend.length,
                "chars"
              );
            }
          } else if (response && typeof response === "object") {
            // Handle object response with text field
            const text =
              (response as any).response ||
              (response as any).text ||
              (response as any).result ||
              JSON.stringify(response);

            assistantMsg.content = text;

            console.log(
              "[ChatAgent] Processing object response, text length:",
              text.length
            );

            // Send complete response as single chunk
            ws.send(
              JSON.stringify({
                type: "message_stream",
                id: assistantMsg.id,
                chunk: text,
                role: "assistant",
              })
            );

            console.log(
              "[ChatAgent] Sent object response, length:",
              text.length
            );
          }

          // Build A2UI components from response (demo feature)
          // Check if response contains structured content hints
          const shouldUseA2UI =
            assistantMsg.content.includes("**") &&
            assistantMsg.content.includes("\n");

          let messageToSend: any = { ...assistantMsg };

          if (shouldUseA2UI) {
            try {
              // Convert AI response to A2UI components
              const a2uiMessage = A2UIBuilder.fromTextResponse(
                assistantMsg.content,
                { progressive: true }
              );
              messageToSend.a2uiComponents = a2uiMessage.components;
            } catch (a2uiErr) {
              console.log(
                "[ChatAgent] A2UI conversion skipped, using markdown"
              );
            }
          }

          // Update state with complete assistant message
          const finalState = (await this.state) as any;
          const finalMessages = finalState?.messages || [];

          await this.setState({
            ...finalState,
            messages: [...finalMessages, assistantMsg],
            lastUpdated: Date.now(),
          });

          // Send completion message
          console.log(
            "[ChatAgent] Stream complete, total length:",
            assistantMsg.content.length
          );
          ws.send(
            JSON.stringify({
              type: "message_complete",
              message: messageToSend,
            })
          );

          console.log("[ChatAgent] Response sent successfully");
        } catch (aiError) {
          console.error("[ChatAgent] AI generation error:", aiError);
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Failed to generate AI response",
              details:
                aiError instanceof Error ? aiError.message : String(aiError),
            })
          );
        }
      } else if (data.type === "get_history") {
        ws.send(
          JSON.stringify({
            type: "history",
            messages: state.messages || [],
          })
        );
      }
    } catch (error) {
      console.error("[ChatAgent] Message error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Handle WebSocket close
   */
  async onClose(_ws: any) {
    console.log("[ChatAgent] Client disconnected");
  }

  /**
   * Get current state (for HTTP requests)
   */
  async getState() {
    return await this.state;
  }
}
