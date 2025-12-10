import { createServerFn } from "@tanstack/react-start";

/**
 * Cloudflare Workers AI Integration - Server Functions
 *
 * These server functions handle communication with Cloudflare's AI API.
 * They must run on the server to keep the API key secure.
 *
 * Setup required:
 * 1. Set CLOUDFLARE_ACCOUNT_ID in .env or wrangler.env
 * 2. Set CLOUDFLARE_API_TOKEN in .env or wrangler.env
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const MODEL = "@cf/meta/llama-2-7b-chat-int8";

/**
 * Stream an AI response from Cloudflare Workers AI
 * Returns a ReadableStream for real-time streaming
 *
 * Note: Currently uses a default prompt. To support custom prompts,
 * this function would need to be called from a route handler that
 * has access to request body parsing.
 *
 * Usage in client:
 * ```
 * const response = await streamAIResponse()
 * // Process response.body with ReadableStreamDefaultReader
 * ```
 */
export const streamAIResponse = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      // Use a default prompt - can be customized by route handler
      const prompt = "Tell me something interesting and informative.";

      if (!ACCOUNT_ID || !API_TOKEN) {
        throw new Error(
          "Cloudflare credentials not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables."
        );
      }

      const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Cloudflare API error:", error);
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText}`
        );
      }

      // Return the streaming response
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("AI streaming error:", message);
      throw error;
    }
  }
);

/**
 * Get a complete AI response from Cloudflare Workers AI (non-streaming)
 *
 * Note: Currently uses a default prompt. To support custom prompts,
 * this function would need to be called from a route handler that
 * has access to request body parsing.
 *
 * Usage in client:
 * ```
 * const response = await getAIResponse()
 * ```
 */
export const getAIResponse = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      // Use a default prompt - can be customized by route handler
      const prompt = "Tell me something interesting and informative.";

      if (!ACCOUNT_ID || !API_TOKEN) {
        throw new Error(
          "Cloudflare credentials not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables."
        );
      }

      const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Cloudflare API error:", error);
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        result?: { response?: string };
      };
      return data.result?.response || "No response from AI";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("AI error:", message);
      throw error;
    }
  }
);
