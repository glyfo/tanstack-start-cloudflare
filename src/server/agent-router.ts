import { routeAgentRequest } from "agents";
import { ChatAgent } from "./agent-chat";

/**
 * PURE AGENT ROUTER
 * ==================
 *
 * Routes all requests to Agent instances
 * No Server Functions - pure WebSocket + RPC
 *
 * URL Format: /agents/ChatAgent/{sessionId}
 */

export { ChatAgent };

export default {
  async fetch(request: Request, env: any) {
    // Route agent requests (WebSocket + RPC)
    const response = await routeAgentRequest(request, env);

    if (response) {
      return response;
    }

    return new Response("Not found", { status: 404 });
  },
};
