/**
 * Cloudflare Worker Entry Point
 * Single CRM agent handles all operations
 */

import { getAgentByName } from "agents";
import { ChatAgent } from "@/server/agents/chat-agent";
import { ConversationStateDO } from "@/server/durable-objects/ConversationStateDO";
import { ContactDO } from "@/server/durable-objects/ContactDO";
import { LeadQualificationDO } from "@/server/durable-objects/LeadQualificationDO";
import { EnhancedConversationDO } from "@/server/durable-objects/EnhancedConversationDO";
import { TikTokLeadDO } from "@/server/durable-objects/TikTokLeadDO";
import { FacebookLeadDO } from "@/server/durable-objects/FacebookLeadDO";
import { WhatsAppConversationDO } from "@/server/durable-objects/WhatsAppConversationDO";
import { OpportunityDO } from "@/server/durable-objects/OpportunityDO";
import { RateLimiterDO } from "@/server/middleware/rate-limiter";
import { SocialConnectionsDO } from "@/server/durable-objects/SocialConnectionsDO";
import { SocialHubDO } from "@/server/durable-objects/SocialHubDO";
import { handleTikTokWebhook } from "@/server/webhooks/tiktok";
import { handleFacebookWebhook } from "@/server/webhooks/facebook";
import { handleWhatsAppWebhook } from "@/server/webhooks/whatsapp";
import { handleInstagramWebhook } from "@/server/webhooks/instagram";
import { handleExportRequest } from "@/server/api/export-leads";
import { handleOAuthStart, handleOAuthCallback } from "@/server/api/oauth-handlers";
import { handleConnectionsRequest } from "@/server/api/connections-handlers";
import { runGmailAutonomousReview } from "@/server/workflows/gmail-autonomous-review";
import type { SocialPlatform } from "@/types/social-connections";

// Export Durable Object classes for registration
export { ChatAgent, ConversationStateDO, ContactDO, LeadQualificationDO, EnhancedConversationDO, TikTokLeadDO, FacebookLeadDO, WhatsAppConversationDO, OpportunityDO, RateLimiterDO, SocialConnectionsDO, SocialHubDO };

const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Helper to get a Durable Object stub by sessionId
const getAgentStub = async (env: any, sessionId: string) => {
  // env.CHAT_AGENT is a DurableObjectNamespace
  return getAgentByName(env.CHAT_AGENT, sessionId);
};

const corsHeaders = (request: Request, env: any): Record<string, string> => {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.FRONTEND_ORIGIN || origin || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Org-ID, X-User-ID",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
};

const withCors = (response: Response, request: Request, env: any): Response => {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);

  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

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

    // Accept both 'ChatAgent' and 'chat-agent' (case-insensitive)
    if (!/^(ChatAgent|chat-agent)$/i.test(agentName)) {
      return jsonResponse({ error: "Unknown agent" }, 404);
    }

    const agent = await getAgentStub(env, sessionId);
    console.log(`[✅ Router:${requestId}] AGENT STUB FOUND`, {
      agentName,
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

      if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request, env),
        });
      }

      // TikTok webhook endpoint
      if (pathname === "/api/webhooks/tiktok") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO TIKTOK WEBHOOK`);
        return await handleTikTokWebhook(request, env, ctx);
      }

      // Facebook webhook endpoint
      if (pathname === "/api/webhooks/facebook") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO FACEBOOK WEBHOOK`);
        return await handleFacebookWebhook(request, env, ctx);
      }

      // WhatsApp webhook endpoint
      if (pathname === "/api/webhooks/whatsapp") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO WHATSAPP WEBHOOK`);
        return await handleWhatsAppWebhook(request, env);
      }

      // Instagram webhook endpoint
      if (pathname === "/api/webhooks/instagram") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO INSTAGRAM WEBHOOK`);
        return await handleInstagramWebhook(request, env, ctx);
      }

      // Export endpoint
      if (pathname === "/api/export/leads") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO EXPORT ENDPOINT`);
        return withCors(await handleExportRequest(request, env), request, env);
      }

      // Health check endpoints
      if (pathname === "/health" || pathname === "/health/") {
        return withCors(jsonResponse({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        }), request, env);
      }

      if (pathname === "/health/webhooks") {
        console.log(`[🔀 Worker:${requestId}] HEALTH CHECK: WEBHOOKS`);
        const webhookStatus = {
          tiktok: {
            endpoint: "/api/webhooks/tiktok",
            status: "active",
            secretConfigured: !!env.TIKTOK_WEBHOOK_SECRET,
          },
          facebook: {
            endpoint: "/api/webhooks/facebook",
            status: "active",
            secretConfigured: !!env.FACEBOOK_APP_SECRET,
            verifyTokenConfigured: !!env.FACEBOOK_VERIFY_TOKEN,
          },
          whatsapp: {
            endpoint: "/api/webhooks/whatsapp",
            status: "active",
            secretConfigured: !!env.FACEBOOK_APP_SECRET,
            verifyTokenConfigured: !!env.WHATSAPP_VERIFY_TOKEN,
          },
          instagram: {
            endpoint: "/api/webhooks/instagram",
            status: "active",
            secretConfigured: !!(env.INSTAGRAM_APP_SECRET || env.FACEBOOK_APP_SECRET),
            verifyTokenConfigured: !!(env.INSTAGRAM_VERIFY_TOKEN || env.FACEBOOK_VERIFY_TOKEN),
          },
        };
        return withCors(jsonResponse({
          status: "healthy",
          webhooks: webhookStatus,
          timestamp: new Date().toISOString(),
        }), request, env);
      }

      if (pathname === "/health/apis") {
        console.log(`[🔀 Worker:${requestId}] HEALTH CHECK: APIS`);
        const apiStatus: Record<string, any> = {
          facebook: {
            configured: !!env.FACEBOOK_PAGE_ACCESS_TOKEN,
            appSecretConfigured: !!env.FACEBOOK_APP_SECRET,
          },
          whatsapp: {
            configured: !!env.WHATSAPP_ACCESS_TOKEN,
            phoneNumberConfigured: !!env.WHATSAPP_PHONE_NUMBER_ID,
          },
          tiktok: {
            configured: !!env.TIKTOK_WEBHOOK_SECRET,
          },
          instagram: {
            configured: !!(env.INSTAGRAM_ACCESS_TOKEN || env.FACEBOOK_PAGE_ACCESS_TOKEN),
            appSecretConfigured: !!(env.INSTAGRAM_APP_SECRET || env.FACEBOOK_APP_SECRET),
            verifyTokenConfigured: !!(env.INSTAGRAM_VERIFY_TOKEN || env.FACEBOOK_VERIFY_TOKEN),
          },
          gmail: {
            clientIdConfigured: !!env.GMAIL_CLIENT_ID,
            clientSecretConfigured: !!env.GMAIL_CLIENT_SECRET,
          },
          durableObjects: {
            chatAgent: !!env.CHAT_AGENT,
            contactDO: !!env.CONTACT_DO,
            opportunityDO: !!env.OPPORTUNITY_DO,
            socialConnectionsDO: !!env.SOCIAL_CONNECTIONS_DO,
          },
          kv: {
            leadsKV: !!env.LEADS_KV,
            leadIndexKV: !!env.LEAD_INDEX_KV,
          },
          ai: {
            configured: !!env.AI,
          },
        };
        return withCors(jsonResponse({
          status: "healthy",
          apis: apiStatus,
          timestamp: new Date().toISOString(),
        }), request, env);
      }

      if (pathname === "/health/ready") {
        // Readiness check - verify critical services are available
        const checks: Record<string, boolean> = {
          chatAgent: !!env.CHAT_AGENT,
          contactDO: !!env.CONTACT_DO,
          opportunityDO: !!env.OPPORTUNITY_DO,
          ai: !!env.AI,
        };
        const allReady = Object.values(checks).every(Boolean);
        return withCors(jsonResponse(
          {
            status: allReady ? "ready" : "not_ready",
            checks,
            timestamp: new Date().toISOString(),
          },
          allReady ? 200 : 503
        ), request, env);
      }

      // OAuth start endpoints
      const oauthStartMatch = pathname.match(/^\/api\/oauth\/(facebook|instagram|whatsapp|tiktok|gmail)\/start$/);
      if (oauthStartMatch) {
        const platform = oauthStartMatch[1] as SocialPlatform;
        console.log(`[🔀 Worker:${requestId}] ROUTING TO OAUTH START: ${platform}`);
        return await handleOAuthStart(request, platform, env);
      }

      // OAuth callback endpoints
      const oauthCallbackMatch = pathname.match(/^\/api\/oauth\/(facebook|instagram|whatsapp|tiktok|gmail)\/callback$/);
      if (oauthCallbackMatch) {
        const platform = oauthCallbackMatch[1] as SocialPlatform;
        console.log(`[🔀 Worker:${requestId}] ROUTING TO OAUTH CALLBACK: ${platform}`);
        return await handleOAuthCallback(request, platform, env);
      }

      // Connections API endpoints
      if (pathname.startsWith("/api/connections")) {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO CONNECTIONS API`);
        const response = await handleConnectionsRequest(request, env);
        if (response) return withCors(response, request, env);
      }

      if (pathname.startsWith("/agents/")) {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO AGENT HANDLER`);
        return await handleAgentRequest(request, pathname, env);
      }

      return jsonResponse({ error: "Not found" }, 404);
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
  async scheduled(controller: ScheduledController, env: any, _ctx: any) {
    try {
      await runGmailAutonomousReview(env, {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      });
    } catch (error) {
      console.error("[Worker] Scheduled Gmail review failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
} satisfies ExportedHandler;
