/**
 * Tests for Connections Handlers
 *
 * Tests CRUD operations, rate limiting, and tenant context
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define mocks with vi.hoisted to avoid hoisting issues
const { mockRateLimit, mockGetClientId, mockRateLimitResponse, mockRefreshFacebookToken, mockRefreshTikTokToken, mockRefreshGmailToken, mockVerifyToken } = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockGetClientId: vi.fn(),
  mockRateLimitResponse: vi.fn(),
  mockRefreshFacebookToken: vi.fn(),
  mockRefreshTikTokToken: vi.fn(),
  mockRefreshGmailToken: vi.fn(),
  mockVerifyToken: vi.fn(),
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

// Mock OAuth services
vi.mock('../../services/oauth-services', () => ({
  refreshFacebookToken: mockRefreshFacebookToken,
  refreshTikTokToken: mockRefreshTikTokToken,
  verifyToken: mockVerifyToken,
}));

vi.mock('../../services/gmail-oauth', () => ({
  refreshGmailToken: mockRefreshGmailToken,
}));

import {
  handleListConnections,
  handleGetConnectionStatus,
  handleRefreshToken,
  handleDisconnect,
  handleConnectionsRequest,
} from '../connections-handlers';

// Helper for typing response bodies
interface JsonResponse {
  connections?: any[];
  total?: number;
  platform?: string;
  status?: string;
  tokenValid?: boolean;
  daysUntilExpiry?: number;
  success?: boolean;
  expiresAt?: number;
  error?: string;
}

describe('Connections Handlers', () => {
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

    mockVerifyToken.mockResolvedValue({ valid: true });
    mockRefreshFacebookToken.mockResolvedValue({
      accessToken: 'refreshed-token',
      expiresAt: Math.floor(Date.now() / 1000) + 5184000,
    });
    mockRefreshTikTokToken.mockResolvedValue({
      accessToken: 'refreshed-tt-token',
      refreshToken: 'new-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
    mockRefreshGmailToken.mockResolvedValue({
      accessToken: 'refreshed-gmail-token',
      refreshToken: 'new-gmail-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    mockConnectionsDO = {
      listConnections: vi.fn().mockResolvedValue([
        {
          id: 'conn-1',
          platform: 'facebook',
          status: 'active',
          platformUsername: 'Test User',
          connectedAt: Date.now() / 1000,
        },
        {
          id: 'conn-2',
          platform: 'instagram',
          status: 'active',
          platformUsername: 'ig_user',
          connectedAt: Date.now() / 1000,
        },
      ]),
      getConnection: vi.fn().mockResolvedValue({
        id: 'conn-1',
        platform: 'facebook',
        status: 'active',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      }),
      getAccessToken: vi.fn().mockResolvedValue('decrypted-access-token'),
      getRefreshToken: vi.fn().mockResolvedValue('decrypted-refresh-token'),
      updateTokens: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(true),
    };

    mockEnv = {
      FACEBOOK_APP_ID: 'test-fb-app-id',
      FACEBOOK_APP_SECRET: 'test-fb-app-secret',
      TIKTOK_CLIENT_KEY: 'test-tt-client-key',
      TIKTOK_CLIENT_SECRET: 'test-tt-client-secret',
      GMAIL_CLIENT_ID: 'test-gmail-client-id',
      GMAIL_CLIENT_SECRET: 'test-gmail-client-secret',
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
  // List Connections
  // ==========================================================================

  describe('handleListConnections', () => {
    it('should return list of connections', async () => {
      const request = new Request('https://example.com/api/connections', {
        headers: { 'X-Org-ID': 'test-org' },
      });

      const response = await handleListConnections(request, mockEnv);
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.connections).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('should use tenant context from headers', async () => {
      const request = new Request('https://example.com/api/connections', {
        headers: { 'X-Org-ID': 'custom-org' },
      });

      await handleListConnections(request, mockEnv);

      expect(mockEnv.SOCIAL_CONNECTIONS_DO.idFromName).toHaveBeenCalledWith('custom-org');
    });

    it('should use default org if header missing', async () => {
      const request = new Request('https://example.com/api/connections');

      await handleListConnections(request, mockEnv);

      expect(mockEnv.SOCIAL_CONNECTIONS_DO.idFromName).toHaveBeenCalledWith('default-org');
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      const request = new Request('https://example.com/api/connections');
      const response = await handleListConnections(request, mockEnv);

      expect(response.status).toBe(429);
    });

    it('should handle DO errors gracefully', async () => {
      mockConnectionsDO.listConnections.mockRejectedValueOnce(new Error('DO error'));

      const request = new Request('https://example.com/api/connections');
      const response = await handleListConnections(request, mockEnv);
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(500);
      expect(body.error).toContain('Failed to list connections');
    });
  });

  // ==========================================================================
  // Get Connection Status
  // ==========================================================================

  describe('handleGetConnectionStatus', () => {
    it('should return connection status with token verification', async () => {
      const request = new Request('https://example.com/api/connections/facebook/status');

      const response = await handleGetConnectionStatus(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.platform).toBe('facebook');
      expect(body.status).toBe('active');
      expect(body.tokenValid).toBe(true);
    });

    it('should return disconnected status for non-existent connection', async () => {
      mockConnectionsDO.getConnection.mockResolvedValueOnce(null);

      const request = new Request('https://example.com/api/connections/tiktok/status');
      const response = await handleGetConnectionStatus(request, mockEnv, 'tiktok');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.status).toBe('disconnected');
    });

    it('should update status if token verification fails', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        valid: false,
        error: 'Token expired',
      });

      const request = new Request('https://example.com/api/connections/facebook/status');
      await handleGetConnectionStatus(request, mockEnv, 'facebook');

      expect(mockConnectionsDO.updateStatus).toHaveBeenCalledWith(
        'facebook',
        'expired',
        'Token expired'
      );
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      const request = new Request('https://example.com/api/connections/facebook/status');
      const response = await handleGetConnectionStatus(request, mockEnv, 'facebook');

      expect(response.status).toBe(429);
    });

    it('should calculate days until expiry', async () => {
      const expiresInDays = 30;
      mockConnectionsDO.getConnection.mockResolvedValueOnce({
        id: 'conn-1',
        platform: 'facebook',
        status: 'active',
        expiresAt: Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60,
      });

      const request = new Request('https://example.com/api/connections/facebook/status');
      const response = await handleGetConnectionStatus(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(body.daysUntilExpiry).toBeGreaterThan(25);
      expect(body.daysUntilExpiry).toBeLessThanOrEqual(30);
    });
  });

  // ==========================================================================
  // Refresh Token
  // ==========================================================================

  describe('handleRefreshToken', () => {
    it('should refresh Facebook token', async () => {
      const request = new Request('https://example.com/api/connections/facebook/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.expiresAt).toBeDefined();
      expect(mockConnectionsDO.updateTokens).toHaveBeenCalled();
    });

    it('should refresh TikTok token with refresh token', async () => {
      mockConnectionsDO.getConnection.mockResolvedValueOnce({
        id: 'conn-tt',
        platform: 'tiktok',
        status: 'active',
      });

      const request = new Request('https://example.com/api/connections/tiktok/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'tiktok');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockRefreshTikTokToken).toHaveBeenCalled();
    });

    it('should return 404 for non-existent connection', async () => {
      mockConnectionsDO.getConnection.mockResolvedValueOnce(null);

      const request = new Request('https://example.com/api/connections/facebook/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(404);
      expect(body.error).toContain('Connection not found');
    });

    it('should refresh Gmail token with refresh token', async () => {
      mockConnectionsDO.getConnection.mockResolvedValueOnce({
        id: 'conn-gmail',
        platform: 'gmail',
        status: 'active',
      });

      const request = new Request('https://example.com/api/connections/gmail/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'gmail');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockRefreshGmailToken).toHaveBeenCalled();
      expect(mockConnectionsDO.updateTokens).toHaveBeenCalled();
    });

    it('should return 400 if no access token available', async () => {
      mockConnectionsDO.getAccessToken.mockResolvedValueOnce(null);

      const request = new Request('https://example.com/api/connections/facebook/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(400);
      expect(body.error).toContain('No access token');
    });

    it('should return 400 for TikTok if no refresh token available', async () => {
      mockConnectionsDO.getConnection.mockResolvedValueOnce({
        id: 'conn-tt',
        platform: 'tiktok',
        status: 'active',
      });
      mockConnectionsDO.getRefreshToken.mockResolvedValueOnce(null);

      const request = new Request('https://example.com/api/connections/tiktok/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'tiktok');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(400);
      expect(body.error).toContain('No refresh token');
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      const request = new Request('https://example.com/api/connections/facebook/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'facebook');

      expect(response.status).toBe(429);
    });

    it('should update status on refresh failure', async () => {
      mockRefreshFacebookToken.mockRejectedValueOnce(new Error('Refresh failed'));

      const request = new Request('https://example.com/api/connections/facebook/refresh', {
        method: 'POST',
      });

      const response = await handleRefreshToken(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(500);
      expect(body.error).toContain('Failed to refresh token');
      expect(mockConnectionsDO.updateStatus).toHaveBeenCalledWith(
        'facebook',
        'error',
        expect.any(String)
      );
    });
  });

  // ==========================================================================
  // Disconnect
  // ==========================================================================

  describe('handleDisconnect', () => {
    it('should disconnect a platform', async () => {
      const request = new Request('https://example.com/api/connections/facebook', {
        method: 'DELETE',
      });

      const response = await handleDisconnect(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockConnectionsDO.disconnect).toHaveBeenCalledWith('facebook');
    });

    it('should return 404 if connection not found', async () => {
      mockConnectionsDO.disconnect.mockResolvedValueOnce(false);

      const request = new Request('https://example.com/api/connections/facebook', {
        method: 'DELETE',
      });

      const response = await handleDisconnect(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(404);
      expect(body.error).toContain('Connection not found');
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 60,
      });

      const request = new Request('https://example.com/api/connections/facebook', {
        method: 'DELETE',
      });

      const response = await handleDisconnect(request, mockEnv, 'facebook');

      expect(response.status).toBe(429);
    });

    it('should handle disconnect errors', async () => {
      mockConnectionsDO.disconnect.mockRejectedValueOnce(new Error('DO error'));

      const request = new Request('https://example.com/api/connections/facebook', {
        method: 'DELETE',
      });

      const response = await handleDisconnect(request, mockEnv, 'facebook');
      const body = (await response.json()) as JsonResponse;

      expect(response.status).toBe(500);
      expect(body.error).toContain('Failed to disconnect');
    });
  });

  // ==========================================================================
  // Request Router
  // ==========================================================================

  describe('handleConnectionsRequest', () => {
    it('should route GET /api/connections to listConnections', async () => {
      const request = new Request('https://example.com/api/connections', {
        method: 'GET',
      });

      const response = await handleConnectionsRequest(request, mockEnv);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
    });

    it('should route GET /api/connections/:platform/status to getConnectionStatus', async () => {
      const request = new Request('https://example.com/api/connections/facebook/status', {
        method: 'GET',
      });

      const response = await handleConnectionsRequest(request, mockEnv);

      expect(response).not.toBeNull();
    });

    it('should route POST /api/connections/:platform/refresh to refreshToken', async () => {
      const request = new Request('https://example.com/api/connections/facebook/refresh', {
        method: 'POST',
      });

      const response = await handleConnectionsRequest(request, mockEnv);

      expect(response).not.toBeNull();
    });

    it('should route DELETE /api/connections/:platform to disconnect', async () => {
      const request = new Request('https://example.com/api/connections/facebook', {
        method: 'DELETE',
      });

      const response = await handleConnectionsRequest(request, mockEnv);

      expect(response).not.toBeNull();
    });

    it('should return null for unknown routes', async () => {
      const request = new Request('https://example.com/api/connections/unknown/path', {
        method: 'GET',
      });

      const response = await handleConnectionsRequest(request, mockEnv);

      expect(response).toBeNull();
    });

    it('should return null for invalid platforms', async () => {
      const request = new Request('https://example.com/api/connections/invalid/status', {
        method: 'GET',
      });

      const response = await handleConnectionsRequest(request, mockEnv);

      expect(response).toBeNull();
    });
  });
});
