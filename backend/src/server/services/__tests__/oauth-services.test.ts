/**
 * Tests for OAuth Services
 *
 * Tests auth URL builders, token exchange, and refresh logic for all platforms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildFacebookAuthUrl,
  buildInstagramAuthUrl,
  buildWhatsAppAuthUrl,
  buildTikTokAuthUrl,
  exchangeFacebookCode,
  exchangeTikTokCode,
  refreshFacebookToken,
  refreshTikTokToken,
  getFacebookUserInfo,
  getFacebookPages,
  getInstagramBusinessAccount,
  getWhatsAppBusinessAccounts,
  getTikTokUserInfo,
  verifyToken,
} from '../oauth-services';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OAuth Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // AUTH URL BUILDERS
  // ==========================================================================

  describe('buildFacebookAuthUrl', () => {
    it('should build a valid Facebook OAuth URL', () => {
      const url = buildFacebookAuthUrl({
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        state: 'encrypted-state',
        scopes: ['pages_show_list', 'pages_messaging'],
      });

      expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('state=encrypted-state');
      expect(url).toContain('scope=pages_show_list%2Cpages_messaging');
      expect(url).toContain('response_type=code');
    });

    it('should handle empty scopes', () => {
      const url = buildFacebookAuthUrl({
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        state: 'state',
        scopes: [],
      });

      expect(url).toContain('scope=');
    });
  });

  describe('buildInstagramAuthUrl', () => {
    it('should build Instagram auth URL using Facebook OAuth', () => {
      const url = buildInstagramAuthUrl({
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        state: 'encrypted-state',
        scopes: ['instagram_basic', 'instagram_manage_messages'],
      });

      // Instagram uses Facebook OAuth
      expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
      expect(url).toContain('instagram_basic');
    });
  });

  describe('buildWhatsAppAuthUrl', () => {
    it('should build WhatsApp auth URL using Facebook OAuth', () => {
      const url = buildWhatsAppAuthUrl({
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        state: 'encrypted-state',
        scopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
      });

      expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
      expect(url).toContain('whatsapp_business_messaging');
    });
  });

  describe('buildTikTokAuthUrl', () => {
    it('should build a valid TikTok OAuth URL with PKCE', () => {
      const url = buildTikTokAuthUrl({
        clientKey: 'test-client-key',
        redirectUri: 'https://example.com/callback',
        state: 'encrypted-state',
        scopes: ['user.info.basic', 'video.list'],
        codeChallenge: 'test-code-challenge',
      });

      expect(url).toContain('https://www.tiktok.com/v2/auth/authorize/');
      expect(url).toContain('client_key=test-client-key');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('state=encrypted-state');
      expect(url).toContain('scope=user.info.basic%2Cvideo.list');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge=test-code-challenge');
      expect(url).toContain('code_challenge_method=S256');
    });
  });

  // ==========================================================================
  // TOKEN EXCHANGE
  // ==========================================================================

  describe('exchangeFacebookCode', () => {
    it('should exchange code for long-lived token', async () => {
      // Mock short-lived token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'short-lived-token',
          token_type: 'bearer',
        }),
      });

      // Mock long-lived token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'long-lived-token',
          token_type: 'bearer',
          expires_in: 5184000, // 60 days
        }),
      });

      const result = await exchangeFacebookCode({
        code: 'auth-code',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
      });

      expect(result.accessToken).toBe('long-lived-token');
      expect(result.expiresAt).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw on token exchange failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid code',
      });

      await expect(
        exchangeFacebookCode({
          code: 'invalid-code',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'https://example.com/callback',
        })
      ).rejects.toThrow('Facebook token exchange failed');
    });
  });

  describe('exchangeTikTokCode', () => {
    it('should exchange code with PKCE verifier', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tiktok-access-token',
          refresh_token: 'tiktok-refresh-token',
          expires_in: 86400,
          refresh_expires_in: 31536000,
          open_id: 'tiktok-open-id',
          scope: 'user.info.basic',
          token_type: 'Bearer',
        }),
      });

      const result = await exchangeTikTokCode({
        code: 'auth-code',
        clientKey: 'client-key',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
        codeVerifier: 'pkce-verifier',
      });

      expect(result.accessToken).toBe('tiktok-access-token');
      expect(result.refreshToken).toBe('tiktok-refresh-token');
      expect(result.openId).toBe('tiktok-open-id');
      expect(result.expiresAt).toBeDefined();

      // Verify PKCE was included
      const [, fetchOptions] = mockFetch.mock.calls[0];
      expect(fetchOptions.body.toString()).toContain('code_verifier=pkce-verifier');
    });
  });

  // ==========================================================================
  // TOKEN REFRESH
  // ==========================================================================

  describe('refreshFacebookToken', () => {
    it('should refresh Facebook token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          token_type: 'bearer',
          expires_in: 5184000,
        }),
      });

      const result = await refreshFacebookToken({
        accessToken: 'old-token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      });

      expect(result.accessToken).toBe('refreshed-token');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw on refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Token expired',
      });

      await expect(
        refreshFacebookToken({
          accessToken: 'expired-token',
          clientId: 'client-id',
          clientSecret: 'client-secret',
        })
      ).rejects.toThrow('Facebook token refresh failed');
    });
  });

  describe('refreshTikTokToken', () => {
    it('should refresh TikTok token using refresh token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 86400,
          refresh_expires_in: 31536000,
          open_id: 'open-id',
          scope: 'user.info.basic',
          token_type: 'Bearer',
        }),
      });

      const result = await refreshTikTokToken({
        refreshToken: 'old-refresh-token',
        clientKey: 'client-key',
        clientSecret: 'client-secret',
      });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });
  });

  // ==========================================================================
  // USER INFO
  // ==========================================================================

  describe('getFacebookUserInfo', () => {
    it('should fetch Facebook user info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '123456789',
          name: 'Test User',
        }),
      });

      const result = await getFacebookUserInfo('access-token');

      expect(result.id).toBe('123456789');
      expect(result.name).toBe('Test User');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid token',
      });

      await expect(getFacebookUserInfo('invalid-token')).rejects.toThrow(
        'Failed to get Facebook user info'
      );
    });
  });

  describe('getFacebookPages', () => {
    it('should fetch Facebook pages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'page-1', name: 'Page One', access_token: 'page-token-1' },
            { id: 'page-2', name: 'Page Two', access_token: 'page-token-2' },
          ],
        }),
      });

      const result = await getFacebookPages('access-token');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('page-1');
      expect(result[0].name).toBe('Page One');
      expect(result[0].accessToken).toBe('page-token-1');
    });
  });

  describe('getInstagramBusinessAccount', () => {
    it('should fetch Instagram Business Account', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instagram_business_account: {
            id: 'ig-123',
            username: 'testuser',
          },
        }),
      });

      const result = await getInstagramBusinessAccount('page-id', 'access-token');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ig-123');
      expect(result!.username).toBe('testuser');
    });

    it('should return null if no IG account linked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await getInstagramBusinessAccount('page-id', 'access-token');

      expect(result).toBeNull();
    });
  });

  describe('getWhatsAppBusinessAccounts', () => {
    it('should fetch WhatsApp Business Accounts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              owned_whatsapp_business_accounts: {
                data: [
                  { id: 'wa-1', name: 'WA Business 1' },
                  { id: 'wa-2', name: 'WA Business 2' },
                ],
              },
            },
          ],
        }),
      });

      const result = await getWhatsAppBusinessAccounts('access-token');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('wa-1');
      expect(result[1].name).toBe('WA Business 2');
    });
  });

  describe('getTikTokUserInfo', () => {
    it('should fetch TikTok user info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: {
              open_id: 'tt-open-id',
              display_name: 'TikTok User',
            },
          },
        }),
      });

      const result = await getTikTokUserInfo('access-token');

      expect(result.openId).toBe('tt-open-id');
      expect(result.displayName).toBe('TikTok User');
    });

    it('should throw on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { user: {} },
          error: {
            code: 'access_token_invalid',
            message: 'Invalid access token',
          },
        }),
      });

      await expect(getTikTokUserInfo('invalid-token')).rejects.toThrow('TikTok API error');
    });
  });

  // ==========================================================================
  // TOKEN VERIFICATION
  // ==========================================================================

  describe('verifyToken', () => {
    it('should verify valid Facebook token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { is_valid: true },
        }),
      });

      const result = await verifyToken('facebook', 'valid-token');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for expired token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            is_valid: false,
            error: { message: 'Token has expired' },
          },
        }),
      });

      const result = await verifyToken('facebook', 'expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });

    it('should verify TikTok token by fetching user info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await verifyToken('tiktok', 'valid-token');

      expect(result.valid).toBe(true);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyToken('facebook', 'token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
