/**
 * Cloudflare Worker Entry Point
 * Multi-Agent Architecture:
 * - Orchestrator (Main ChatAgent) - Routes to specialized agents
 * - Planning Agent - Breaks down complex tasks
 * - Knowledge Agent - Retrieves CRM data
 * - Execution Agent - Performs CRM actions
 * - Verification Agent - Validates data quality
 */

import { ChatAgent } from "@/server/agents/chat-agent";
import { PlanningAgent } from "@/server/agents/planning-agent";
import { KnowledgeAgent } from "@/server/agents/knowledge-agent";
import { ExecutionAgent } from "@/server/agents/execution-agent";
import { VerificationAgent } from "@/server/agents/verification-agent";
import { getAgentByName } from "agents";

// Export all agents as Durable Objects
export {
  ChatAgent, // Orchestrator
  PlanningAgent, // Plans subtasks
  KnowledgeAgent, // Retrieves info
  ExecutionAgent, // Performs actions
  VerificationAgent, // Validates results
};

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
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[🔀 Router:${requestId}] AGENT REQUEST ROUTING`, {
    timestamp: new Date().toISOString(),
    pathname,
    method: request.method,
    url: request.url.substring(0, 150),
  });

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 3) {
    console.warn(`[⚠️  Router:${requestId}] INVALID PATH`, {
      pathParts: parts.length,
      parts,
      expected: "/agents/ChatAgent/sessionId",
    });
    return jsonResponse({ error: "Invalid path" }, 400);
  }

  try {
    const agentName = parts[1];
    const sessionId = parts[2];
    const upgradeHeader = request.headers.get("Upgrade");
    console.log(`[🎯 Router:${requestId}] AGENT LOOKUP`, {
      agentName,
      sessionId: sessionId.substring(0, 8),
      isWebSocket: upgradeHeader === "websocket",
      upgradeHeader,
    });

    const agent = await getAgentByName(env.CHAT_AGENT, agentName);
    console.log(`[✅ Router:${requestId}] AGENT FOUND`, {
      agentName,
      agentType: agent?.constructor?.name,
      hasFetch: typeof agent?.fetch === "function",
    });

    console.log(`[📡 Router:${requestId}] CALLING agent.fetch()`);
    const response = await agent.fetch(request);
    console.log(`[📡 Router:${requestId}] agent.fetch() RETURNED`, {
      status: response.status,
      statusText: response.statusText,
    });

    // Don't log WebSocket upgrades (status 101) - those are handled by Server logs
    // Only log traditional HTTP responses
    if (response.status !== 101) {
      console.log(`[✅ Router:${requestId}] RESPONSE SENT`, {
        status: response.status,
        contentType: response.headers.get("content-type") || "application/json",
      });
    }

    return response;
  } catch (error) {
    console.error(`[❌ Router:${requestId}] AGENT REQUEST FAILED`, {
      error: error instanceof Error ? error.message : String(error),
      stack:
        error instanceof Error ? error.stack?.substring(0, 300) : undefined,
    });
    return jsonResponse({ error: "Agent request failed" }, 500);
  }
};

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const requestId = crypto.randomUUID().substring(0, 8);
    const startTime = Date.now();

    console.log(`[📥 Worker:${requestId}] INCOMING REQUEST`, {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url.substring(0, 150),
      pathname: new URL(request.url).pathname,
    });

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname.startsWith("/agents/")) {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO AGENT HANDLER`);
        return await handleAgentRequest(request, pathname, env);
      }

      console.log(`[🔀 Worker:${requestId}] ROUTING TO TANSTACK HANDLER`);
      if (!tanstackHandler) {
        console.log(`[⏳ Worker:${requestId}] LOADING TANSTACK HANDLER`);
        const mod = await import("@tanstack/react-start/server-entry");
        tanstackHandler = mod.default;
        console.log(`[✅ Worker:${requestId}] TANSTACK HANDLER LOADED`);
      }

      const response = await tanstackHandler.fetch(request, env, ctx);
      const duration = Date.now() - startTime;
      console.log(`[✅ Worker:${requestId}] RESPONSE SENT`, {
        status: response.status,
        duration: `${duration}ms`,
        contentType: response.headers.get("content-type"),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[❌ Worker:${requestId}] REQUEST HANDLER ERROR`, {
        error: error instanceof Error ? error.message : String(error),
        stack:
          error instanceof Error ? error.stack?.substring(0, 300) : undefined,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler;
