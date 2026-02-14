/**
 * Tests for OAuth Handlers
 *
 * Tests OAuth start/callback flows, error handling, and rate limiting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define all mocks with vi.hoisted to avoid hoisting issues
const {
  mockRateLimit,
  mockGetClientId,
  mockRateLimitResponse,
  mockEncryptOAuthState,
  mockDecryptOAuthState,
  mockGenerateNonce,
  mockGenerateCodeVerifier,
  mockGenerateCodeChallenge,
  mockBuildFacebookAuthUrl,
  mockBuildTikTokAuthUrl,
  mockExchangeFacebookCode,
  mockExchangeTikTokCode,
  mockGetFacebookUserInfo,
  mockGetFacebookPages,
  mockGetTikTokUserInfo,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientId: vi.fn(),
  mockRateLimitResponse: vi.fn(),
  mockEncryptOAuthState: vi.fn(),
  mockDecryptOAuthState: vi.fn(),
  mockGenerateNonce: vi.fn(),
  mockGenerateCodeVerifier: vi.fn(),
  mockGenerateCodeChallenge: vi.fn(),
  mockBuildFacebookAuthUrl: vi.fn(),
  mockBuildTikTokAuthUrl: vi.fn(),
  mockExchangeFacebookCode: vi.fn(),
  mockExchangeTikTokCode: vi.fn(),
  mockGetFacebookUserInfo: vi.fn(),
  mockGetFacebookPages: vi.fn(),
  mockGetTikTokUserInfo: vi.fn(),
}));

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(public ctx: any, public env: any) {}
  },
}));

// Mock rate limiter
vi.mock('../../middleware/rate-limiter', () => ({
  checkRateLimit: mockRateLimit,
  getClientId: mockGetClientId,
  rateLimitResponse: mockRateLimitResponse,
}));

// Mock token encryption
vi.mock('../../services/token-encryption', () => ({
  encryptOAuthState: mockEncryptOAuthState,
  decryptOAuthState: mockDecryptOAuthState,
  generateNonce: mockGenerateNonce,
  generateCodeVerifier: mockGenerateCodeVerifier,
  generateCodeChallenge: mockGenerateCodeChallenge,
}));

// Mock OAuth services
vi.mock('../../services/oauth-services', () => ({
  buildFacebookAuthUrl: mockBuildFacebookAuthUrl,
  buildInstagramAuthUrl: vi.fn().mockReturnValue('https://facebook.com/oauth?instagram'),
  buildWhatsAppAuthUrl: vi.fn().mockReturnValue('https://facebook.com/oauth?whatsapp'),
  buildTikTokAuthUrl: mockBuildTikTokAuthUrl,
  exchangeFacebookCode: mockExchangeFacebookCode,
  exchangeInstagramCode: vi.fn(),
  exchangeWhatsAppCode: vi.fn(),
  exchangeTikTokCode: mockExchangeTikTokCode,
  getFacebookUserInfo: mockGetFacebookUserInfo,
  getFacebookPages: mockGetFacebookPages,
  getInstagramBusinessAccount: vi.fn(),
  getWhatsAppBusinessAccounts: vi.fn(),
  getTikTokUserInfo: mockGetTikTokUserInfo,
}));

import { handleOAuthStart, handleOAuthCallback } from '../oauth-handlers';

describe('OAuth Handlers', () => {
  let mockEnv: any;
  let mockConnectionsDO: any;

  beforeEach(() => {
    // Set up default mock implementations
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 10 });
    mockGetClientId.mockReturnValue('127.0.0.1');
    mockRateLimitResponse.mockImplementation((retryAfter: number) =>
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Retry-After': retryAfter.toString() },
      })
    );

    mockEncryptOAuthState.mockResolvedValue('encrypted-state');
    mockGenerateNonce.mockReturnValue('test-nonce');
    mockGenerateCodeVerifier.mockReturnValue('test-code-verifier');
    mockGenerateCodeChallenge.mockResolvedValue('test-code-challenge');

    mockDecryptOAuthState.mockResolvedValue({
      platform: 'facebook',
      orgId: 'test-org',
      userId: 'test-user',
      nonce: 'test-nonce',
      redirectUrl: 'https://example.com/settings/connections',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
    });

    mockBuildFacebookAuthUrl.mockReturnValue('https://facebook.com/oauth?test');
    mockBuildTikTokAuthUrl.mockReturnValue('https://tiktok.com/oauth?test');

    mockExchangeFacebookCode.mockResolvedValue({
      accessToken: 'fb-access-token',
      expiresAt: Math.floor(Date.now() / 1000) + 5184000,
    });
    mockExchangeTikTokCode.mockResolvedValue({
      accessToken: 'tt-access-token',
      refreshToken: 'tt-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      openId: 'tt-open-id',
    });

    mockGetFacebookUserInfo.mockResolvedValue({
      id: 'fb-user-id',
      name: 'Facebook User',
    });
    mockGetFacebookPages.mockResolvedValue([
      { id: 'page-id', name: 'Test Page', accessToken: 'page-token' },
    ]);
    mockGetTikTokUserInfo.mockResolvedValue({
      openId: 'tt-open-id',
      displayName: 'TikTok User',
    });

    mockConnectionsDO = {
      saveConnection: vi.fn().mockResolvedValue({ id: 'conn-id', platform: 'facebook' }),
      scheduleRefreshCheck: vi.fn().mockResolvedValue(undefined),
    };

    mockEnv = {
      FACEBOOK_APP_ID: 'test-fb-app-id',
      FACEBOOK_APP_SECRET: 'test-fb-app-secret',
      TIKTOK_CLIENT_KEY: 'test-tt-client-key',
      TIKTOK_CLIENT_SECRET: 'test-tt-client-secret',
      TOKEN_ENCRYPTION_SECRET: 'test-encryption-secret',
      SOCIAL_CONNECTIONS_DO: {
        idFromName: vi.fn().mockReturnValue('do-id'),
        get: vi.fn().mockReturnValue(mockConnectionsDO),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // OAuth Start
  // ==========================================================================

  describe('handleOAuthStart', () => {
    it('should redirect to Facebook OAuth URL', async () => {
      const request = new Request('https://example.com/api/oauth/facebook/start', {
        headers: {
          'X-Org-ID': 'test-org',
          'X-User-ID': 'test-user',
        },
      });

      const response = await handleOAuthStart(request, 'facebook', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('facebook');
      expect(mockBuildFacebookAuthUrl).toHaveBeenCalled();
    });

    it('should redirect to TikTok OAuth URL with PKCE', async () => {
      const request = new Request('https://example.com/api/oauth/tiktok/start', {
        headers: {
          'X-Org-ID': 'test-org',
          'X-User-ID': 'test-user',
        },
      });

      const response = await handleOAuthStart(request, 'tiktok', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('tiktok');
      expect(mockBuildTikTokAuthUrl).toHaveBeenCalled();
      expect(mockGenerateCodeVerifier).toHaveBeenCalled();
      expect(mockGenerateCodeChallenge).toHaveBeenCalled();
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      const request = new Request('https://example.com/api/oauth/facebook/start');
      const response = await handleOAuthStart(request, 'facebook', mockEnv);

      expect(response.status).toBe(429);
    });

    it('should use default tenant context if headers missing', async () => {
      const request = new Request('https://example.com/api/oauth/facebook/start');

      const response = await handleOAuthStart(request, 'facebook', mockEnv);

      expect(response.status).toBe(302);
      // State should include default org/user
      expect(mockEncryptOAuthState).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'default-org',
          userId: 'default-user',
        }),
        expect.any(String)
      );
    });
  });

  // ==========================================================================
  // OAuth Callback
  // ==========================================================================

  describe('handleOAuthCallback', () => {
    it('should exchange Facebook code and save connection', async () => {
      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?code=auth-code&state=encrypted-state'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('oauth_success=true');
      expect(mockConnectionsDO.saveConnection).toHaveBeenCalled();
      expect(mockConnectionsDO.scheduleRefreshCheck).toHaveBeenCalled();
    });

    it('should handle OAuth error from provider', async () => {
      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?error=access_denied&error_description=User%20denied'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('oauth_error=User%20denied');
    });

    it('should return 400 for missing code or state', async () => {
      const request = new Request('https://example.com/api/oauth/facebook/callback');

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toContain('Missing code or state');
    });

    it('should return 400 for invalid state', async () => {
      mockDecryptOAuthState.mockRejectedValueOnce(new Error('Invalid state'));

      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?code=test&state=invalid'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toContain('Invalid state');
    });

    it('should return 400 for platform mismatch', async () => {
      mockDecryptOAuthState.mockResolvedValueOnce({
        platform: 'instagram', // Different from request platform
        orgId: 'test-org',
        userId: 'test-user',
        nonce: 'test-nonce',
        redirectUrl: 'https://example.com/callback',
        createdAt: Date.now(),
        expiresAt: Date.now() + 600000,
      });

      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?code=test&state=valid'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(400);
      const body = await response.json() as { error: string };
      expect(body.error).toContain('Platform mismatch');
    });

    it('should redirect with error for expired state', async () => {
      mockDecryptOAuthState.mockResolvedValueOnce({
        platform: 'facebook',
        orgId: 'test-org',
        userId: 'test-user',
        nonce: 'test-nonce',
        redirectUrl: 'https://example.com/callback',
        createdAt: Date.now() - 1200000, // 20 minutes ago
        expiresAt: Date.now() - 600000, // Expired 10 minutes ago
      });

      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?code=test&state=expired'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('oauth_error=expired');
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?code=test&state=valid'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(429);
    });

    it('should handle TikTok callback with PKCE', async () => {
      mockDecryptOAuthState.mockResolvedValueOnce({
        platform: 'tiktok',
        orgId: 'test-org',
        userId: 'test-user',
        nonce: 'test-nonce',
        redirectUrl: 'https://example.com/callback',
        createdAt: Date.now(),
        expiresAt: Date.now() + 600000,
        codeVerifier: 'test-code-verifier',
      });

      const request = new Request(
        'https://example.com/api/oauth/tiktok/callback?code=test&state=valid'
      );

      const response = await handleOAuthCallback(request, 'tiktok', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('oauth_success=true');
      expect(mockExchangeTikTokCode).toHaveBeenCalledWith(
        expect.objectContaining({
          codeVerifier: 'test-code-verifier',
        })
      );
    });

    it('should redirect with error on token exchange failure', async () => {
      mockExchangeFacebookCode.mockRejectedValueOnce(new Error('Token exchange failed'));

      const request = new Request(
        'https://example.com/api/oauth/facebook/callback?code=test&state=valid'
      );

      const response = await handleOAuthCallback(request, 'facebook', mockEnv);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('oauth_error');
    });
  });
});
