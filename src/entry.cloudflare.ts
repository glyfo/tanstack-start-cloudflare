/**
 * CLOUDFLARE WORKER ENTRY POINT
 * ==============================
 *
 * Routes:
 * - /agents/* → ChatAgent (via agents framework)
 * - /* → TanStack Start
 */

import { ChatAgent } from "./server/agent-chat";
import { getAgentByName } from "agents";

// Export ChatAgent for Durable Objects
export { ChatAgent };

let tanstackHandler: any;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Route agent requests to ChatAgent
      if (pathname.startsWith("/agents/")) {
        try {
          const parts = pathname.split("/").filter(Boolean);
          if (parts.length < 3) {
            return new Response(
              JSON.stringify({ error: "Invalid agent path" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const sessionId = parts[2];

          // Get agent instance by name
          const agent = await getAgentByName(env.CHAT_AGENT, sessionId);
          
          // Forward request to agent - handles WebSocket natively
          const response = await agent.fetch(request);
          return response;
        } catch (agentError) {
          console.error("Agent error:", agentError);
          return new Response(
            JSON.stringify({
              error: "Agent request failed",
              message:
                agentError instanceof Error
                  ? agentError.message
                  : String(agentError),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // All other routes → TanStack Start
      if (!tanstackHandler) {
        const mod = await import("@tanstack/react-start/server-entry");
        tanstackHandler = mod.default;
      }

      return await tanstackHandler.fetch(request, env, ctx);
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
} satisfies ExportedHandler;
