/**
 * OAuth Handlers
 *
 * Handles OAuth start and callback flows for all social platforms.
 */

import type { SocialPlatform, OAuthState } from '@/types/social-connections';
import { PLATFORM_CONFIGS } from '@/types/social-connections';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import {
  encryptOAuthState,
  decryptOAuthState,
  generateNonce,
  generateCodeVerifier,
  generateCodeChallenge,
} from '@/server/services/token-encryption';
import {
  buildFacebookAuthUrl,
  buildInstagramAuthUrl,
  buildWhatsAppAuthUrl,
  buildTikTokAuthUrl,
  exchangeFacebookCode,
  exchangeInstagramCode,
  exchangeWhatsAppCode,
  exchangeTikTokCode,
  getFacebookUserInfo,
  getFacebookPages,
  getInstagramBusinessAccount,
  getWhatsAppBusinessAccounts,
  getTikTokUserInfo,
} from '@/server/services/oauth-services';
import {
  buildGmailAuthUrl,
  exchangeGmailCode,
  getGmailUserInfo,
} from '@/server/services/gmail-oauth';
import { registerWebhookRoute } from '@/server/utils/webhook-routing';

// =============================================================================
// HELPERS
// =============================================================================

const jsonResponse = (data: any, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const redirectResponse = (url: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: url },
  });

/**
 * Get encryption secret from environment
 */
function getEncryptionSecret(env: any): string {
  return env.TOKEN_ENCRYPTION_SECRET || 'dev-encryption-secret-change-me';
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
 * Build the OAuth callback URL
 */
function getCallbackUrl(platform: SocialPlatform, request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/oauth/${platform}/callback`;
}

/**
 * Get the SocialConnectionsDO stub for an organization
 */
function getSocialConnectionsDO(env: any, orgId: string) {
  const id = env.SOCIAL_CONNECTIONS_DO.idFromName(orgId);
  return env.SOCIAL_CONNECTIONS_DO.get(id);
}

// =============================================================================
// OAUTH START HANDLERS
// =============================================================================

/**
 * Handle OAuth start - redirects to platform authorization
 */
export async function handleOAuthStart(
  request: Request,
  platform: SocialPlatform,
  env: any
): Promise<Response> {
  // Rate limit: 10 requests per minute
  const clientId = getClientId(request);
  const rateLimit = await checkRateLimit(env, clientId, '/oauth/start', 10, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter || 60);
  }

  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get('redirect') || `${url.origin}/settings/connections`;

  // Extract tenant context from headers (falls back to defaults)
  const { orgId, userId } = extractTenantContext(request);

  const config = PLATFORM_CONFIGS[platform];
  const credentials = getOAuthCredentials(platform, env);
  const encryptionSecret = getEncryptionSecret(env);

  // Generate OAuth state
  const nonce = generateNonce();
  // Gmail and TikTok use PKCE
  const codeVerifier = (platform === 'tiktok' || platform === 'gmail') ? generateCodeVerifier() : undefined;

  const oauthState: OAuthState = {
    platform,
    orgId,
    userId,
    nonce,
    redirectUrl,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    codeVerifier,
  };

  // Encrypt state
  const encryptedState = await encryptOAuthState(oauthState, encryptionSecret);
  const callbackUrl = getCallbackUrl(platform, request);

  // Build authorization URL
  let authUrl: string;

  switch (platform) {
    case 'facebook':
      authUrl = buildFacebookAuthUrl({
        clientId: credentials.clientId,
        redirectUri: callbackUrl,
        state: encryptedState,
        scopes: config.scopes,
      });
      break;

    case 'instagram':
      authUrl = buildInstagramAuthUrl({
        clientId: credentials.clientId,
        redirectUri: callbackUrl,
        state: encryptedState,
        scopes: config.scopes,
      });
      break;

    case 'whatsapp':
      authUrl = buildWhatsAppAuthUrl({
        clientId: credentials.clientId,
        redirectUri: callbackUrl,
        state: encryptedState,
        scopes: config.scopes,
      });
      break;

    case 'tiktok': {
      const ttCodeChallenge = await generateCodeChallenge(codeVerifier!);
      authUrl = buildTikTokAuthUrl({
        clientKey: credentials.clientKey!,
        redirectUri: callbackUrl,
        state: encryptedState,
        scopes: config.scopes,
        codeChallenge: ttCodeChallenge,
      });
      break;
    }

    case 'gmail': {
      const gmailCodeChallenge = await generateCodeChallenge(codeVerifier!);
      authUrl = buildGmailAuthUrl({
        clientId: credentials.clientId,
        redirectUri: callbackUrl,
        state: encryptedState,
        scopes: config.scopes,
        codeChallenge: gmailCodeChallenge,
      });
      break;
    }

    default:
      return jsonResponse({ error: 'Invalid platform' }, 400);
  }

  return redirectResponse(authUrl);
}

// =============================================================================
// OAUTH CALLBACK HANDLERS
// =============================================================================

/**
 * Handle OAuth callback - exchanges code for tokens and stores connection
 */
export async function handleOAuthCallback(
  request: Request,
  platform: SocialPlatform,
  env: any
): Promise<Response> {
  // Rate limit: 20 requests per minute
  const clientId = getClientId(request);
  const rateLimit = await checkRateLimit(env, clientId, '/oauth/callback', 20, 60);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter || 60);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    const redirectUrl = `${url.origin}/settings/connections?oauth_error=${encodeURIComponent(errorDescription || error)}&oauth_platform=${platform}`;
    return redirectResponse(redirectUrl);
  }

  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state' }, 400);
  }

  const encryptionSecret = getEncryptionSecret(env);

  // Decrypt and validate state
  let oauthState: OAuthState;
  try {
    oauthState = await decryptOAuthState<OAuthState>(state, encryptionSecret);
  } catch {
    return jsonResponse({ error: 'Invalid state' }, 400);
  }

  // Validate state
  if (oauthState.platform !== platform) {
    return jsonResponse({ error: 'Platform mismatch' }, 400);
  }

  if (Date.now() > oauthState.expiresAt) {
    const redirectUrl = `${oauthState.redirectUrl}?oauth_error=expired&oauth_platform=${platform}`;
    return redirectResponse(redirectUrl);
  }

  const credentials = getOAuthCredentials(platform, env);
  const callbackUrl = getCallbackUrl(platform, request);

  try {
    // Exchange code for tokens
    let tokenResult: any;
    let platformInfo: {
      userId?: string;
      username?: string;
      pageId?: string;
      pageName?: string;
    } = {};

    switch (platform) {
      case 'facebook': {
        tokenResult = await exchangeFacebookCode({
          code,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri: callbackUrl,
        });

        // Get user info
        const fbUser = await getFacebookUserInfo(tokenResult.accessToken);
        platformInfo.userId = fbUser.id;
        platformInfo.username = fbUser.name;

        // Get first page if available
        const pages = await getFacebookPages(tokenResult.accessToken);
        if (pages.length > 0) {
          platformInfo.pageId = pages[0].id;
          platformInfo.pageName = pages[0].name;
          // Store page token instead of user token for API calls
          tokenResult.accessToken = pages[0].accessToken;
        }
        break;
      }

      case 'instagram': {
        tokenResult = await exchangeInstagramCode({
          code,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri: callbackUrl,
        });

        // Get user and page info
        const igUser = await getFacebookUserInfo(tokenResult.accessToken);
        platformInfo.userId = igUser.id;

        // Get connected Instagram Business Account
        const pages = await getFacebookPages(tokenResult.accessToken);
        for (const page of pages) {
          const igAccount = await getInstagramBusinessAccount(page.id, tokenResult.accessToken);
          if (igAccount) {
            platformInfo.pageId = igAccount.id;
            platformInfo.username = igAccount.username;
            break;
          }
        }
        break;
      }

      case 'whatsapp': {
        tokenResult = await exchangeWhatsAppCode({
          code,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri: callbackUrl,
        });

        // Get user info
        const waUser = await getFacebookUserInfo(tokenResult.accessToken);
        platformInfo.userId = waUser.id;

        // Get WhatsApp Business Account
        const accounts = await getWhatsAppBusinessAccounts(tokenResult.accessToken);
        if (accounts.length > 0) {
          platformInfo.pageId = accounts[0].id;
          platformInfo.pageName = accounts[0].name;
        }
        break;
      }

      case 'tiktok': {
        if (!oauthState.codeVerifier) {
          throw new Error('Missing code verifier');
        }

        tokenResult = await exchangeTikTokCode({
          code,
          clientKey: credentials.clientKey!,
          clientSecret: credentials.clientSecret!,
          redirectUri: callbackUrl,
          codeVerifier: oauthState.codeVerifier,
        });

        platformInfo.userId = tokenResult.openId;

        // Get user display name
        try {
          const ttUser = await getTikTokUserInfo(tokenResult.accessToken);
          platformInfo.username = ttUser.displayName;
        } catch {
          // Username is optional
        }
        break;
      }

      case 'gmail': {
        if (!oauthState.codeVerifier) {
          throw new Error('Missing code verifier');
        }

        tokenResult = await exchangeGmailCode({
          code,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri: callbackUrl,
          codeVerifier: oauthState.codeVerifier,
        });

        // Get Gmail user info
        const gmailUser = await getGmailUserInfo(tokenResult.accessToken);
        platformInfo.userId = gmailUser.id;
        platformInfo.username = gmailUser.email;
        break;
      }
    }

    // Save connection to Durable Object
    const connectionsDO = getSocialConnectionsDO(env, oauthState.orgId);
    await connectionsDO.saveConnection({
      platform,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresAt: tokenResult.expiresAt,
      scope: tokenResult.scope,
      platformUserId: platformInfo.userId,
      platformUsername: platformInfo.username,
      platformPageId: platformInfo.pageId,
      platformPageName: platformInfo.pageName,
      connectedBy: oauthState.userId,
    });

    // Register webhook routing where account IDs are known and stable.
    // This allows inbound webhooks to resolve to the correct organization.
    if ((platform === 'facebook' || platform === 'instagram') && platformInfo.pageId) {
      await registerWebhookRoute(env, platform, platformInfo.pageId, oauthState.orgId);
    }

    // Schedule token refresh check
    await connectionsDO.scheduleRefreshCheck();

    // Redirect to success
    const successUrl = `${oauthState.redirectUrl}?oauth_success=true&oauth_platform=${platform}`;
    return redirectResponse(successUrl);
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const errorUrl = `${oauthState.redirectUrl}?oauth_error=${encodeURIComponent(errorMsg)}&oauth_platform=${platform}`;
    return redirectResponse(errorUrl);
  }
}
