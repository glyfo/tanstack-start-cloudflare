/**
 * OAuth Services
 *
 * Platform-specific OAuth token exchange and refresh logic for
 * Facebook, Instagram, WhatsApp, and TikTok.
 */

import type {
  SocialPlatform,
  TokenPair,
} from '@/types/social-connections';

// =============================================================================
// TYPES
// =============================================================================

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookPageResponse {
  data: Array<{
    id: string;
    name: string;
    access_token: string;
  }>;
}

interface FacebookUserResponse {
  id: string;
  name: string;
}

interface InstagramAccountResponse {
  instagram_business_account?: {
    id: string;
    username: string;
  };
}

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
}

interface TikTokUserResponse {
  data: {
    user: {
      open_id: string;
      union_id?: string;
      avatar_url?: string;
      display_name?: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

interface WhatsAppBusinessAccountResponse {
  data: Array<{
    id: string;
    name: string;
    message_template_namespace?: string;
  }>;
}

// =============================================================================
// FACEBOOK OAUTH
// =============================================================================

/**
 * Build Facebook OAuth authorization URL
 */
export function buildFacebookAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', params.scopes.join(','));
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/**
 * Exchange Facebook authorization code for tokens
 */
export async function exchangeFacebookCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenPair> {
  // Exchange code for short-lived token
  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', params.clientId);
  tokenUrl.searchParams.set('client_secret', params.clientSecret);
  tokenUrl.searchParams.set('redirect_uri', params.redirectUri);
  tokenUrl.searchParams.set('code', params.code);

  const tokenResponse = await fetch(tokenUrl.toString());
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Facebook token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as FacebookTokenResponse;

  // Exchange short-lived token for long-lived token (60 days)
  const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longLivedUrl.searchParams.set('client_id', params.clientId);
  longLivedUrl.searchParams.set('client_secret', params.clientSecret);
  longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

  const longLivedResponse = await fetch(longLivedUrl.toString());
  if (!longLivedResponse.ok) {
    const error = await longLivedResponse.text();
    throw new Error(`Facebook long-lived token exchange failed: ${error}`);
  }

  const longLivedData = (await longLivedResponse.json()) as FacebookLongLivedTokenResponse;

  const expiresAt = Math.floor(Date.now() / 1000) + longLivedData.expires_in;

  return {
    accessToken: longLivedData.access_token,
    expiresAt,
  };
}

/**
 * Get Facebook user info
 */
export async function getFacebookUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
}> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Facebook user info: ${error}`);
  }

  return (await response.json()) as FacebookUserResponse;
}

/**
 * Get Facebook pages the user manages
 */
export async function getFacebookPages(accessToken: string): Promise<
  Array<{
    id: string;
    name: string;
    accessToken: string;
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Facebook pages: ${error}`);
  }

  const data = (await response.json()) as FacebookPageResponse;

  return data.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
  }));
}

/**
 * Refresh Facebook long-lived token
 * Note: Facebook tokens can only be refreshed before they expire
 */
export async function refreshFacebookToken(params: {
  accessToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenPair> {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('client_secret', params.clientSecret);
  url.searchParams.set('fb_exchange_token', params.accessToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook token refresh failed: ${error}`);
  }

  const data = (await response.json()) as FacebookLongLivedTokenResponse;
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

// =============================================================================
// INSTAGRAM OAUTH
// =============================================================================

/**
 * Build Instagram OAuth authorization URL (via Facebook)
 */
export function buildInstagramAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  // Instagram uses Facebook OAuth with additional scopes
  return buildFacebookAuthUrl(params);
}

/**
 * Exchange Instagram authorization code for tokens (via Facebook)
 */
export async function exchangeInstagramCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenPair> {
  // Uses the same flow as Facebook
  return exchangeFacebookCode(params);
}

/**
 * Get Instagram Business Account connected to a Facebook Page
 */
export async function getInstagramBusinessAccount(
  pageId: string,
  accessToken: string
): Promise<{ id: string; username: string } | null> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Instagram Business Account: ${error}`);
  }

  const data = (await response.json()) as InstagramAccountResponse;

  if (data.instagram_business_account) {
    return {
      id: data.instagram_business_account.id,
      username: data.instagram_business_account.username,
    };
  }

  return null;
}

// =============================================================================
// WHATSAPP OAUTH
// =============================================================================

/**
 * Build WhatsApp OAuth authorization URL (via Facebook)
 */
export function buildWhatsAppAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}): string {
  // WhatsApp uses Facebook OAuth with WhatsApp-specific scopes
  return buildFacebookAuthUrl(params);
}

/**
 * Exchange WhatsApp authorization code for tokens (via Facebook)
 */
export async function exchangeWhatsAppCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenPair> {
  // Uses the same flow as Facebook
  return exchangeFacebookCode(params);
}

/**
 * Get WhatsApp Business Accounts
 */
export async function getWhatsAppBusinessAccounts(accessToken: string): Promise<
  Array<{
    id: string;
    name: string;
  }>
> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/businesses?fields=owned_whatsapp_business_accounts{id,name}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get WhatsApp Business Accounts: ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{
      owned_whatsapp_business_accounts?: WhatsAppBusinessAccountResponse;
    }>;
  };

  const accounts: Array<{ id: string; name: string }> = [];

  for (const business of data.data) {
    if (business.owned_whatsapp_business_accounts?.data) {
      accounts.push(
        ...business.owned_whatsapp_business_accounts.data.map((account) => ({
          id: account.id,
          name: account.name,
        }))
      );
    }
  }

  return accounts;
}

// =============================================================================
// TIKTOK OAUTH
// =============================================================================

/**
 * Build TikTok OAuth authorization URL with PKCE
 */
export function buildTikTokAuthUrl(params: {
  clientKey: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  codeChallenge: string;
}): string {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', params.clientKey);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', params.scopes.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/**
 * Exchange TikTok authorization code for tokens
 */
export async function exchangeTikTokCode(params: {
  code: string;
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenPair & { openId: string }> {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: params.clientKey,
      client_secret: params.clientSecret,
      code: params.code,
      grant_type: 'authorization_code',
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TikTok token exchange failed: ${error}`);
  }

  const data = (await response.json()) as TikTokTokenResponse;
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scope: data.scope,
    openId: data.open_id,
  };
}

/**
 * Refresh TikTok access token
 */
export async function refreshTikTokToken(params: {
  refreshToken: string;
  clientKey: string;
  clientSecret: string;
}): Promise<TokenPair> {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: params.clientKey,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TikTok token refresh failed: ${error}`);
  }

  const data = (await response.json()) as TikTokTokenResponse;
  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scope: data.scope,
  };
}

/**
 * Get TikTok user info
 */
export async function getTikTokUserInfo(accessToken: string): Promise<{
  openId: string;
  displayName?: string;
}> {
  const response = await fetch('https://open.tiktokapis.com/v2/user/info/', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get TikTok user info: ${error}`);
  }

  const data = (await response.json()) as TikTokUserResponse;

  if (data.error) {
    throw new Error(`TikTok API error: ${data.error.message}`);
  }

  return {
    openId: data.data.user.open_id,
    displayName: data.data.user.display_name,
  };
}

// =============================================================================
// UNIFIED TOKEN VERIFICATION
// =============================================================================

/**
 * Verify if a token is still valid for a given platform
 */
export async function verifyToken(
  platform: SocialPlatform,
  accessToken: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (platform) {
      case 'facebook':
      case 'instagram':
      case 'whatsapp':
        // Use Facebook debug_token endpoint
        const fbResponse = await fetch(
          `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        );
        if (!fbResponse.ok) {
          return { valid: false, error: 'Token validation failed' };
        }
        const fbData = (await fbResponse.json()) as {
          data: { is_valid: boolean; error?: { message: string } };
        };
        if (!fbData.data.is_valid) {
          return { valid: false, error: fbData.data.error?.message };
        }
        return { valid: true };

      case 'tiktok':
        // TikTok: try to fetch user info
        const ttResponse = await fetch('https://open.tiktokapis.com/v2/user/info/', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!ttResponse.ok) {
          return { valid: false, error: 'Token validation failed' };
        }
        return { valid: true };

      case 'gmail':
        // Google token introspection endpoint
        const gmailResponse = await fetch(
          `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
        );
        if (!gmailResponse.ok) {
          return { valid: false, error: 'Token validation failed' };
        }
        return { valid: true };

      default:
        return { valid: false, error: 'Unknown platform' };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
