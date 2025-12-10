import { useState, useCallback } from "react";
import { streamAIResponse, getAIResponse } from "@/server/ai";

/**
 * Hook for streaming AI responses from Cloudflare Workers AI
 *
 * Features:
 * - Real-time streaming of AI responses
 * - Automatic chunk processing
 * - Error handling
 *
 * Usage:
 * ```tsx
 * const { stream, isLoading, error, response } = useAIStream()
 *
 * const handleSend = async (prompt) => {
 *   await stream(prompt)
 * }
 * ```
 */

export function useAIStream() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stream = useCallback(
    async (_prompt: string, onChunk?: (chunk: string) => void) => {
      setIsLoading(true);
      setError(null);
      setResponse("");

      try {
        // Call server function - currently uses default prompt
        // Custom prompts coming in v2
        const streamResponse = await streamAIResponse();

        // Process the readable stream
        if (streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder();
          let fullResponse = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;

            // Call the callback to update UI in real-time
            if (onChunk) {
              onChunk(chunk);
            }

            setResponse(fullResponse);
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Stream error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { stream, isLoading, response, error };
}

/**
 * Hook for non-streaming AI responses
 *
 * Usage:
 * ```tsx
 * const { sendMessage, isLoading, response, error } = useAI()
 *
 * const handleSend = async (prompt) => {
 *   const result = await sendMessage(prompt)
 * }
 * ```
 */

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (_prompt: string) => {
    setIsLoading(true);
    setError(null);
    setResponse("");

    try {
      // Call server function - currently uses default prompt
      // Custom prompts coming in v2
      const result = await getAIResponse();
      setResponse(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("AI error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { sendMessage, isLoading, response, error };
}
