import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

export interface AIInput {
  prompt: string;
}

export const connectToAI = createServerFn({ method: "POST" })
  .inputValidator((data: AIInput) => data)
  .handler(async ({ data }) => {
    const AI = (env as any).AI;

    if (!AI) {
      throw new Error("AI binding not configured");
    }

    const model = "@cf/meta/llama-3.1-8b-instruct";
    const prompt = data?.prompt || "Tell me something interesting";

    const response = await AI.run(model, {
      prompt,
      stream: true,
    });

    // If it's a ReadableStream, return it
    if (response instanceof ReadableStream) {
      return new Response(response, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Fallback: if not a stream, return as text
    const text =
      typeof response === "string"
        ? response
        : response?.response || response?.result?.response || "No response";

    const sseStream = new ReadableStream({
      async start(controller) {
        const tokens = text.split(/(\s+)/);

        for (const token of tokens) {
          if (token && token.trim()) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ response: token })}\n\n`
              )
            );
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }

        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ response: "[DONE]" })}\n\n`
          )
        );
        controller.close();
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
