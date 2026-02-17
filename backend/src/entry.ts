/**
 * Cloudflare Worker Entry Point
 * Single CRM agent handles all operations
 */

import { getAgentByName } from "agents";
import { ChatAgent } from "@/server/agents/chat-agent";
import { ChannelGateway } from "@/server/durable-objects/ChannelGateway";
import { CustomerIdentityDO } from "@/server/durable-objects/CustomerIdentityDO";
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
import { handleTwilioWebhook } from "@/server/webhooks/twilio";
import { handleSlackWebhook } from "@/server/webhooks/slack";
import { handleDiscordWebhook } from "@/server/webhooks/discord";
import { handleTelegramWebhook } from "@/server/webhooks/telegram";
import { handleInboundEmail } from "@/server/webhooks/email";
import { handleExportRequest } from "@/server/api/export-leads";
import { handleOAuthStart, handleOAuthCallback } from "@/server/api/oauth-handlers";
import { handleConnectionsRequest } from "@/server/api/connections-handlers";
import { handleAnalyticsRequest } from "@/server/routes/analytics";
import {
  handleConversationInsights,
  handleChannelPerformance,
  handleActiveTests,
  handleCreateTest,
  handleTestResults,
} from "@/server/routes/conversation-analytics-api";
import { runGmailAutonomousReview } from "@/server/workflows/gmail-autonomous-review";
import { runImprovementLoop } from "@/server/analytics/improvement-loop";
import type { SocialPlatform } from "@/types/social-connections";

// Export Durable Object classes for registration
export { ChatAgent, ChannelGateway, CustomerIdentityDO, ConversationStateDO, ContactDO, LeadQualificationDO, EnhancedConversationDO, TikTokLeadDO, FacebookLeadDO, WhatsAppConversationDO, OpportunityDO, RateLimiterDO, SocialConnectionsDO, SocialHubDO };

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

// ============================================================================
// Admin API Handlers
// ============================================================================

async function handleChannelStats(request: Request, env: any): Promise<Response> {
  try {
    const orgId = request.headers.get('X-Org-ID') || 'default-org';

    // Get ChannelGateway for this org
    const gatewayId = env.CHANNEL_GATEWAY.idFromName(orgId);
    const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

    // Get real stats from ChannelGateway
    const response = await gateway.fetch(`http://internal/all-stats?orgId=${orgId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch channel stats from gateway');
    }

    return response;
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleChannelHealth(request: Request, env: any): Promise<Response> {
  try {
    const orgId = request.headers.get('X-Org-ID') || 'default-org';

    // Get ChannelGateway for this org
    const gatewayId = env.CHANNEL_GATEWAY.idFromName(orgId);
    const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

    // Get stats to derive health status
    const statsResponse = await gateway.fetch(`http://internal/all-stats?orgId=${orgId}`);
    if (!statsResponse.ok) {
      throw new Error('Failed to fetch channel stats');
    }

    const { channels } = await statsResponse.json() as { channels: any[] };

    // Derive health from stats
    const health = channels.map(channel => {
      let status: 'healthy' | 'degraded' | 'down' | 'unconfigured' = 'unconfigured';

      if (channel.enabled) {
        if (channel.errorCount === 0) {
          status = 'healthy';
        } else if (channel.errorCount < 10) {
          status = 'degraded';
        } else {
          status = 'down';
        }
      }

      return {
        channelType: channel.channelType,
        status,
        responseTime: status === 'healthy' ? 100 : status === 'degraded' ? 300 : 1000,
        uptime: status === 'healthy' ? 99.9 : status === 'degraded' ? 95.0 : 50.0,
      };
    });

    return jsonResponse({ health });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetCustomer(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const orgId = customerId?.split('-')[1] || 'default-org';

    if (!customerId) {
      return jsonResponse({ error: 'customerId required' }, 400);
    }

    const identityId = env.CUSTOMER_IDENTITY.idFromName(orgId);
    const identityDO = env.CUSTOMER_IDENTITY.get(identityId);

    return await identityDO.fetch(`http://internal/customer?customerId=${customerId}`);
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleGetCustomerMessages(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const limit = url.searchParams.get('limit') || '100';

    if (!customerId) {
      return jsonResponse({ error: 'customerId required' }, 400);
    }

    // Load customer profile first
    const orgId = customerId.split('-')[1] || 'default-org';
    const identityId = env.CUSTOMER_IDENTITY.idFromName(orgId);
    const identityDO = env.CUSTOMER_IDENTITY.get(identityId);

    const profileResponse = await identityDO.fetch(`http://internal/customer?customerId=${customerId}`);
    const profile = await profileResponse.json();

    if (!profile) {
      return jsonResponse({ messages: [] });
    }

    // Aggregate messages from all channel identities
    const { CrossChannelContextService } = await import('@/server/services/cross-channel-context');
    const contextService = new CrossChannelContextService(env);
    const context = await contextService.getCustomerContext(customerId);

    return jsonResponse({
      messages: context?.recentMessages || [],
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleSearchCustomers(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const orgId = url.searchParams.get('orgId') || 'default-org';

    if (!query) {
      return jsonResponse({ error: 'q parameter required' }, 400);
    }

    const identityId = env.CUSTOMER_IDENTITY.idFromName(orgId);
    const identityDO = env.CUSTOMER_IDENTITY.get(identityId);

    return await identityDO.fetch(`http://internal/search?q=${encodeURIComponent(query)}&orgId=${orgId}`);
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleLinkIdentity(request: Request, env: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { customerId, channelType, identifier, displayName, metadata } = body;

    const orgId = customerId.split('-')[1] || 'default-org';
    const identityId = env.CUSTOMER_IDENTITY.idFromName(orgId);
    const identityDO = env.CUSTOMER_IDENTITY.get(identityId);

    return await identityDO.fetch('http://internal/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, channelType, identifier, displayName, metadata }),
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleMergeCustomers(request: Request, env: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { fromCustomerId, toCustomerId, mergedBy } = body;

    const orgId = fromCustomerId.split('-')[1] || 'default-org';
    const identityId = env.CUSTOMER_IDENTITY.idFromName(orgId);
    const identityDO = env.CUSTOMER_IDENTITY.get(identityId);

    return await identityDO.fetch('http://internal/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCustomerId, toCustomerId, mergedBy }),
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleListPairingRequests(request: Request, env: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const orgId = request.headers.get('X-Org-ID') || 'default-org';

    const gatewayId = env.CHANNEL_GATEWAY.idFromName(orgId);
    const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

    // Get real pairing requests from ChannelGateway
    const response = await gateway.fetch(`http://internal/pairing-requests?orgId=${orgId}&status=${status}`);
    if (!response.ok) {
      throw new Error('Failed to fetch pairing requests');
    }

    return response;
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleApprovePairing(request: Request, env: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { requestId, reviewedBy } = body;
    const orgId = request.headers.get('X-Org-ID') || 'default-org';

    const gatewayId = env.CHANNEL_GATEWAY.idFromName(orgId);
    const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

    return await gateway.fetch('http://internal/approve-pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingId: requestId, reviewedBy }),
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

async function handleRejectPairing(request: Request, env: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { requestId, reviewedBy } = body;
    const orgId = request.headers.get('X-Org-ID') || 'default-org';

    const gatewayId = env.CHANNEL_GATEWAY.idFromName(orgId);
    const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

    return await gateway.fetch('http://internal/reject-pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingId: requestId, reviewedBy }),
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================================================
// Agent Request Handler
// ============================================================================

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

      // Twilio SMS webhook endpoint
      if (pathname === "/api/webhooks/twilio") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO TWILIO WEBHOOK`);
        return await handleTwilioWebhook(request, env);
      }

      // Slack Events API webhook endpoint
      if (pathname === "/api/webhooks/slack") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO SLACK WEBHOOK`);
        return await handleSlackWebhook(request, env);
      }

      // Discord Interactions webhook endpoint
      if (pathname === "/api/webhooks/discord") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO DISCORD WEBHOOK`);
        return await handleDiscordWebhook(request, env);
      }

      // Telegram Bot API webhook endpoint
      if (pathname === "/api/webhooks/telegram") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO TELEGRAM WEBHOOK`);
        return await handleTelegramWebhook(request, env);
      }

      // Export endpoint
      if (pathname === "/api/export/leads") {
        console.log(`[🔀 Worker:${requestId}] ROUTING TO EXPORT ENDPOINT`);
        return withCors(await handleExportRequest(request, env), request, env);
      }

      // ============================================================
      // Admin API Endpoints - Channel Management & Customer Identity
      // ============================================================

      // Channel Stats
      if (pathname === "/api/channel-stats") {
        return withCors(await handleChannelStats(request, env), request, env);
      }

      // Channel Health
      if (pathname === "/api/channel-health") {
        return withCors(await handleChannelHealth(request, env), request, env);
      }

      // Analytics Dashboard (aggregate metrics)
      if (pathname === "/api/analytics") {
        return withCors(await handleAnalyticsRequest(request, env), request, env);
      }

      // Conversation Analytics - Insights
      if (pathname === "/api/analytics/conversation-insights") {
        return withCors(await handleConversationInsights(request, env), request, env);
      }

      // Conversation Analytics - Channel Performance
      if (pathname === "/api/analytics/channel-performance") {
        return withCors(await handleChannelPerformance(request, env), request, env);
      }

      // Conversation Analytics - Active A/B Tests
      if (pathname === "/api/analytics/active-tests") {
        return withCors(await handleActiveTests(request, env), request, env);
      }

      // Conversation Analytics - Create A/B Test
      if (pathname === "/api/analytics/create-test" && request.method === "POST") {
        return withCors(await handleCreateTest(request, env), request, env);
      }

      // Conversation Analytics - Test Results
      if (pathname.startsWith("/api/analytics/test-results/")) {
        const testId = pathname.split("/").pop() || "";
        return withCors(await handleTestResults(request, env, testId), request, env);
      }

      // Customer Identity - Get Profile
      if (pathname.startsWith("/api/customer-identity/customer")) {
        return withCors(await handleGetCustomer(request, env), request, env);
      }

      // Customer Identity - Get Messages
      if (pathname.startsWith("/api/customer-identity/messages")) {
        return withCors(await handleGetCustomerMessages(request, env), request, env);
      }

      // Customer Identity - Search
      if (pathname.startsWith("/api/customer-identity/search")) {
        return withCors(await handleSearchCustomers(request, env), request, env);
      }

      // Customer Identity - Link Identity
      if (pathname === "/api/customer-identity/link" && request.method === "POST") {
        return withCors(await handleLinkIdentity(request, env), request, env);
      }

      // Customer Identity - Merge Customers
      if (pathname === "/api/customer-identity/merge" && request.method === "POST") {
        return withCors(await handleMergeCustomers(request, env), request, env);
      }

      // Pairing Requests - List
      if (pathname === "/api/pairing-requests" && request.method === "GET") {
        return withCors(await handleListPairingRequests(request, env), request, env);
      }

      // Pairing Requests - Approve
      if (pathname === "/api/pairing-requests/approve" && request.method === "POST") {
        return withCors(await handleApprovePairing(request, env), request, env);
      }

      // Pairing Requests - Reject
      if (pathname === "/api/pairing-requests/reject" && request.method === "POST") {
        return withCors(await handleRejectPairing(request, env), request, env);
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
    const cronExpression = controller.cron;
    console.log(`[Worker] Scheduled job triggered: ${cronExpression}`);

    try {
      // Gmail autonomous review (every 15 minutes: */15 * * * *)
      if (cronExpression.includes('*/15')) {
        console.log('[Worker] Running Gmail autonomous review...');
        await runGmailAutonomousReview(env, {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
        });
      }

      // Improvement loop analysis (daily at 2 AM: 0 2 * * *)
      if (cronExpression.includes('0 2')) {
        console.log('[Worker] Running improvement loop analysis...');
        await runImprovementLoop(env);
      }
    } catch (error) {
      console.error("[Worker] Scheduled job failed", {
        cron: cronExpression,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
  async email(message: any, env: any, ctx: any) {
    // Handle inbound emails via Cloudflare Email Workers
    await handleInboundEmail(message, env);
  },
} satisfies ExportedHandler;
