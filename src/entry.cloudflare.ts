/**
 * Cloudflare Worker Entry Point
 * Routes:
 * - /agents/* → ChatAgent
 * - /* → TanStack Start
 */

import { ChatAgent } from "@/server/core/agent";
import { getAgentByName } from "agents";

export { ChatAgent };

let tanstackHandler: any;

const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const handleAgentRequest = async (
  request: Request,
  pathname: string,
  env: any
) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3) return jsonResponse({ error: "Invalid path" }, 400);

  try {
    const agent = await getAgentByName(env.CHAT_AGENT, parts[2]);
    return await agent.fetch(request);
  } catch (error) {
    console.error("Agent error:", error);
    return jsonResponse({ error: "Agent request failed" }, 500);
  }
};

export default {
  async fetch(request: Request, env: any, ctx: any) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname.startsWith("/agents/"))
        return await handleAgentRequest(request, pathname, env);

      if (!tanstackHandler) {
        const mod = await import("@tanstack/react-start/server-entry");
        tanstackHandler = mod.default;
      }

      return await tanstackHandler.fetch(request, env, ctx);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler;
