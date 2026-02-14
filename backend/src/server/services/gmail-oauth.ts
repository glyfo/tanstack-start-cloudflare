/**
 * Gmail OAuth Service
 *
 * Handles OAuth 2.0 authentication with Google/Gmail API.
 * Gmail uses standard OAuth 2.0 with PKCE and short-lived tokens (~1 hour).
 */

import type { TokenPair } from '@/types/social-connections';
import { createLogger } from '../utils/logger';

const logger = createLogger('GmailOAuth');

// =============================================================================
// TYPES
// =============================================================================

export interface GmailTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface GmailUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export interface GmailTokenInfo {
  audience: string;
  user_id: string;
  scope: string;
  expires_in: number;
  email?: string;
  verified_email?: boolean;
  access_type?: string;
}

// =============================================================================
// AUTH URL BUILDER
// =============================================================================

/**
 * Build Gmail OAuth authorization URL with PKCE
 */
export function buildGmailAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  codeChallenge: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', params.scopes.join(' '));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline'); // Required for refresh token
  url.searchParams.set('prompt', 'consent'); // Force consent to always get refresh token
  url.searchParams.set('include_granted_scopes', 'true');

  logger.info('[GmailOAuth] Built auth URL', {
    redirectUri: params.redirectUri,
    scopeCount: params.scopes.length,
  });

  return url.toString();
}

// =============================================================================
// TOKEN EXCHANGE
// =============================================================================

/**
 * Exchange Gmail authorization code for tokens
 */
export async function exchangeGmailCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenPair> {
  logger.info('[GmailOAuth] Exchanging code for tokens');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      code_verifier: params.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: params.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailOAuth] Token exchange failed', { error, status: response.status });
    throw new Error(`Gmail token exchange failed: ${error}`);
  }

  const data = (await response.json()) as GmailTokenResponse;
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  logger.info('[GmailOAuth] Token exchange successful', {
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
  });

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scope: data.scope,
  };
}

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * Refresh Gmail access token using refresh token
 */
export async function refreshGmailToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenPair> {
  logger.info('[GmailOAuth] Refreshing access token');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailOAuth] Token refresh failed', { error, status: response.status });
    throw new Error(`Gmail token refresh failed: ${error}`);
  }

  const data = (await response.json()) as GmailTokenResponse;
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  logger.info('[GmailOAuth] Token refresh successful', { expiresIn: data.expires_in });

  return {
    accessToken: data.access_token,
    // Google usually doesn't return a new refresh token on refresh
    refreshToken: params.refreshToken,
    expiresAt,
    scope: data.scope,
  };
}

// =============================================================================
// USER INFO
// =============================================================================

/**
 * Get Gmail user profile information
 */
export async function getGmailUserInfo(accessToken: string): Promise<GmailUserInfo> {
  logger.info('[GmailOAuth] Fetching user info');

  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailOAuth] Failed to get user info', { error, status: response.status });
    throw new Error(`Failed to get Gmail user info: ${error}`);
  }

  const userInfo = (await response.json()) as GmailUserInfo;

  logger.info('[GmailOAuth] Got user info', {
    email: userInfo.email,
    verified: userInfo.verified_email,
  });

  return userInfo;
}

// =============================================================================
// TOKEN VERIFICATION
// =============================================================================

/**
 * Verify Gmail token validity
 */
export async function verifyGmailToken(
  accessToken: string
): Promise<{ valid: boolean; error?: string; info?: GmailTokenInfo }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.text();
      logger.warn('[GmailOAuth] Token validation failed', { error });
      return { valid: false, error: 'Token validation failed' };
    }

    const data = (await response.json()) as GmailTokenInfo;

    if (data.expires_in <= 0) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, info: data };
  } catch (error) {
    logger.error('[GmailOAuth] Token verification error', { error });
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// REVOKE TOKEN
// =============================================================================

/**
 * Revoke Gmail OAuth token (for disconnect)
 */
export async function revokeGmailToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${token}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      logger.warn('[GmailOAuth] Token revocation failed', { status: response.status });
      return false;
    }

    logger.info('[GmailOAuth] Token revoked successfully');
    return true;
  } catch (error) {
    logger.error('[GmailOAuth] Token revocation error', { error });
    return false;
  }
}
