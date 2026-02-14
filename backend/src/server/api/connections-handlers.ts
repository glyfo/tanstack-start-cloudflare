/**
 * Connections API Handlers
 *
 * REST API endpoints for managing social media connections.
 */

import type { SocialPlatform } from '@/types/social-connections';
import { PLATFORM_CONFIGS } from '@/types/social-connections';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import {
  refreshFacebookToken,
  refreshTikTokToken,
  verifyToken,
} from '@/server/services/oauth-services';
import { refreshGmailToken } from '@/server/services/gmail-oauth';

// =============================================================================
// HELPERS
// =============================================================================

const jsonResponse = (data: any, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/**
 * Get OAuth app credentials from environment
 */
function getOAuthCredentials(platform: SocialPlatform, env: any) {
  switch (platform) {
    case 'facebook':
    case 'instagram':
    case 'whatsapp':
      return {
        clientId: env.FACEBOOK_APP_ID || '',
        clientSecret: env.FACEBOOK_APP_SECRET || '',
      };
    case 'tiktok':
      return {
        clientKey: env.TIKTOK_CLIENT_KEY || '',
        clientSecret: env.TIKTOK_CLIENT_SECRET || '',
      };
    case 'gmail':
      return {
        clientId: env.GMAIL_CLIENT_ID || '',
        clientSecret: env.GMAIL_CLIENT_SECRET || '',
      };
  }
}

/**
 * Get the SocialConnectionsDO stub for an organization
 */
function getSocialConnectionsDO(env: any, orgId: string) {
  const id = env.SOCIAL_CONNECTIONS_DO.idFromName(orgId);
  return env.SOCIAL_CONNECTIONS_DO.get(id);
}

/**
 * Tenant context extraction from request headers
 */
interface TenantContext {
  orgId: string;
  userId: string;
}

function extractTenantContext(request: Request): TenantContext {
  return {
    orgId: request.headers.get('X-Org-ID') || 'default-org',
    userId: request.headers.get('X-User-ID') || 'default-user',
  };
}

/**
 * Extract platform from path like /api/connections/facebook
 */
function extractPlatformFromPath(pathname: string): SocialPlatform | null {
  const match = pathname.match(/\/api\/connections\/([^\/]+)/);
  if (!match) return null;

  const platform = match[1] as SocialPlatform;
  if (!PLATFORM_CONFIGS[platform]) return null;

  return platform;
}

// =============================================================================
// LIST CONNECTIONS
// =============================================================================

/**
 * GET /api/connections - List all connections
 */
export async function handleListConnections(
  request: Request,
  env: any
): Promise<Response> {
  // Rate limit: 30 requests per minute
  const clientId = getClientId(request);
  const rateLimit = await checkRateLimit(env, clientId, '/connections/list', 30, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter || 60);
  }

  // Extract tenant context from headers
  const { orgId } = extractTenantContext(request);

  try {
    const connectionsDO = getSocialConnectionsDO(env, orgId);
    const connections = await connectionsDO.listConnections();

    return jsonResponse({
      connections,
      total: connections.length,
    });
  } catch (error) {
    console.error('Failed to list connections:', error);
    return jsonResponse(
      { error: 'Failed to list connections' },
      500
    );
  }
}

// =============================================================================
// GET CONNECTION STATUS
// =============================================================================

/**
 * GET /api/connections/:platform/status - Get connection health status
 */
export async function handleGetConnectionStatus(
  request: Request,
  env: any,
  platform: SocialPlatform
): Promise<Response> {
  // Rate limit: 60 requests per minute
  const clientId = getClientId(request);
  const rateLimit = await checkRateLimit(env, clientId, '/connections/status', 60, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter || 60);
  }

  // Extract tenant context from headers
  const { orgId } = extractTenantContext(request);

  try {
    const connectionsDO = getSocialConnectionsDO(env, orgId);
    const connection = await connectionsDO.getConnection(platform);

    if (!connection) {
      return jsonResponse({
        platform,
        status: 'disconnected',
        message: 'Not connected',
      });
    }

    // Calculate days until expiry
    let daysUntilExpiry: number | undefined;
    if (connection.expiresAt) {
      const secondsLeft = connection.expiresAt - Math.floor(Date.now() / 1000);
      daysUntilExpiry = Math.ceil(secondsLeft / (24 * 60 * 60));
    }

    // Optionally verify token is still valid
    const accessToken = await connectionsDO.getAccessToken(platform);
    let tokenValid = false;

    if (accessToken) {
      const verification = await verifyToken(platform, accessToken);
      tokenValid = verification.valid;

      if (!verification.valid && connection.status === 'active') {
        // Update status to expired
        await connectionsDO.updateStatus(platform, 'expired', verification.error);
      }
    }

    return jsonResponse({
      platform,
      status: connection.status,
      lastVerifiedAt: connection.lastVerifiedAt,
      expiresAt: connection.expiresAt,
      daysUntilExpiry,
      tokenValid,
      errorMessage: connection.errorMessage,
    });
  } catch (error) {
    console.error(`Failed to get connection status for ${platform}:`, error);
    return jsonResponse(
      { error: 'Failed to get connection status' },
      500
    );
  }
}

// =============================================================================
// REFRESH TOKEN
// =============================================================================

/**
 * POST /api/connections/:platform/refresh - Refresh access token
 */
export async function handleRefreshToken(
  request: Request,
  env: any,
  platform: SocialPlatform
): Promise<Response> {
  // Rate limit: 10 requests per minute
  const clientId = getClientId(request);
  const rateLimit = await checkRateLimit(env, clientId, '/connections/refresh', 10, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter || 60);
  }

  // Extract tenant context from headers
  const { orgId } = extractTenantContext(request);

  try {
    const connectionsDO = getSocialConnectionsDO(env, orgId);
    const connection = await connectionsDO.getConnection(platform);

    if (!connection) {
      return jsonResponse({ error: 'Connection not found' }, 404);
    }

    const credentials = getOAuthCredentials(platform, env);
    if (!credentials) {
      return jsonResponse({ error: 'No credentials configured for this platform' }, 400);
    }
    let newTokens: { accessToken: string; refreshToken?: string; expiresAt?: number };

    switch (platform) {
      case 'facebook':
      case 'instagram':
      case 'whatsapp': {
        // Facebook family uses the access token to refresh
        const accessToken = await connectionsDO.getAccessToken(platform);
        if (!accessToken) {
          return jsonResponse({ error: 'No access token available' }, 400);
        }

        newTokens = await refreshFacebookToken({
          accessToken,
          clientId: (credentials as { clientId: string; clientSecret: string }).clientId,
          clientSecret: (credentials as { clientId: string; clientSecret: string }).clientSecret,
        });
        break;
      }

      case 'tiktok': {
        // TikTok uses a refresh token
        const refreshToken = await connectionsDO.getRefreshToken(platform);
        if (!refreshToken) {
          return jsonResponse(
            { error: 'No refresh token available. Please reconnect.' },
            400
          );
        }

        newTokens = await refreshTikTokToken({
          refreshToken,
          clientKey: (credentials as { clientKey: string; clientSecret: string }).clientKey,
          clientSecret: (credentials as { clientKey: string; clientSecret: string }).clientSecret,
        });
        break;
      }

      case 'gmail': {
        const refreshToken = await connectionsDO.getRefreshToken(platform);
        if (!refreshToken) {
          return jsonResponse(
            { error: 'No refresh token available. Please reconnect.' },
            400
          );
        }

        newTokens = await refreshGmailToken({
          refreshToken,
          clientId: (credentials as { clientId: string; clientSecret: string }).clientId,
          clientSecret: (credentials as { clientId: string; clientSecret: string }).clientSecret,
        });
        break;
      }

      default:
        return jsonResponse({ error: 'Invalid platform' }, 400);
    }

    // Update tokens in DO
    await connectionsDO.updateTokens({
      platform,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: newTokens.expiresAt,
    });

    return jsonResponse({
      success: true,
      expiresAt: newTokens.expiresAt,
    });
  } catch (error) {
    console.error(`Failed to refresh token for ${platform}:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Update status to error
    try {
      const connectionsDO = getSocialConnectionsDO(env, orgId);
      await connectionsDO.updateStatus(platform, 'error', errorMsg);
    } catch {}

    return jsonResponse(
      { error: `Failed to refresh token: ${errorMsg}` },
      500
    );
  }
}

// =============================================================================
// DISCONNECT
// =============================================================================

/**
 * DELETE /api/connections/:platform - Disconnect a platform
 */
export async function handleDisconnect(
  request: Request,
  env: any,
  platform: SocialPlatform
): Promise<Response> {
  // Rate limit: 10 requests per minute
  const clientId = getClientId(request);
  const rateLimit = await checkRateLimit(env, clientId, '/connections/disconnect', 10, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter || 60);
  }

  // Extract tenant context from headers
  const { orgId } = extractTenantContext(request);

  try {
    const connectionsDO = getSocialConnectionsDO(env, orgId);
    const success = await connectionsDO.disconnect(platform);

    if (!success) {
      return jsonResponse({ error: 'Connection not found' }, 404);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error(`Failed to disconnect ${platform}:`, error);
    return jsonResponse(
      { error: 'Failed to disconnect' },
      500
    );
  }
}

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Route connection API requests
 */
export async function handleConnectionsRequest(
  request: Request,
  env: any
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // GET /api/connections - List all connections
  if (pathname === '/api/connections' && method === 'GET') {
    return handleListConnections(request, env);
  }

  // Platform-specific routes
  const platform = extractPlatformFromPath(pathname);
  if (!platform) return null;

  // GET /api/connections/:platform/status
  if (pathname === `/api/connections/${platform}/status` && method === 'GET') {
    return handleGetConnectionStatus(request, env, platform);
  }

  // POST /api/connections/:platform/refresh
  if (pathname === `/api/connections/${platform}/refresh` && method === 'POST') {
    return handleRefreshToken(request, env, platform);
  }

  // DELETE /api/connections/:platform
  if (pathname === `/api/connections/${platform}` && method === 'DELETE') {
    return handleDisconnect(request, env, platform);
  }

  return null;
}
