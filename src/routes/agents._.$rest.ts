import { createFileRoute } from "@tanstack/react-router";
import { routeAgentRequest } from "agents";
import { ChatAgent } from "../server/agent-chat";

/**
 * AGENT ROUTING HANDLER
 * =====================
 *
 * Routes all /agents/* requests to Agent instances
 * Uses catch-all pattern: /agents/ChatAgent/{sessionId}
 */

export const Route = createFileRoute("/agents/_/$rest")({
  handlers: {
    // Handler for all HTTP methods (GET, POST, PUT, DELETE, etc.)
    async onMatch() {
      // This is a catch-all for agent requests
      // Real handling happens via the Cloudflare Worker entry point
      return new Response("Agent routing requires WebSocket support", {
        status: 400,
      });
    },
  },
});
