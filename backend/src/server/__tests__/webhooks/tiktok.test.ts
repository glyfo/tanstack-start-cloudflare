/**
 * TikTok Webhook Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleTikTokWebhook,
  verifyTikTokSignature,
  deduplicateLead,
  type TikTokLead,
  type TikTokWebhookPayload,
} from '../../webhooks/tiktok';

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../utils/deduplication', () => ({
  checkForDuplicate: vi.fn().mockResolvedValue({ isDuplicate: false }),
  registerLead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientId: vi.fn().mockReturnValue('test-client'),
  rateLimitResponse: vi.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

vi.mock('../../workflows/opportunity-workflows', () => ({
  createOpportunityFromLead: vi.fn().mockResolvedValue({
    success: true,
    opportunityId: 'opp-123',
  }),
  syncQualificationScore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/webhook-routing', () => ({
  getOrgIdForWebhook: vi.fn().mockResolvedValue('test-org'),
  scopedKey: vi.fn().mockImplementation((orgId, key) => `${orgId}:${key}`),
}));

describe('TikTok Webhook Handler', () => {
  const mockSecret = 'test-webhook-secret';

  describe('verifyTikTokSignature', () => {
    it('should verify valid signature', async () => {
      const payload = '{"event":"lead.create"}';

      // Generate valid signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(mockSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const isValid = await verifyTikTokSignature(payload, signature, mockSecret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const payload = '{"event":"lead.create"}';
      const invalidSignature = btoa('invalid');

      const isValid = await verifyTikTokSignature(payload, invalidSignature, mockSecret);
      expect(isValid).toBe(false);
    });

    it('should reject missing signature', async () => {
      const isValid = await verifyTikTokSignature('{}', '', mockSecret);
      expect(isValid).toBe(false);
    });

    it('should reject missing secret', async () => {
      const isValid = await verifyTikTokSignature('{}', 'sig', '');
      expect(isValid).toBe(false);
    });
  });

  describe('deduplicateLead', () => {
    const mockLead: TikTokLead = {
      event_id: 'evt-123',
      event_time: Date.now(),
      event_type: 'FORM_SUBMIT',
      form_id: 'form-123',
      form_name: 'Test Form',
      ad_id: 'ad-123',
      campaign_id: 'camp-123',
      creative_id: 'creative-123',
      page_id: 'page-123',
      user_details: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+15551234567',
      },
    };

    it('should return isDuplicate: false for new lead', async () => {
      const { checkForDuplicate } = await import('../../utils/deduplication');
      vi.mocked(checkForDuplicate).mockResolvedValueOnce({ isDuplicate: false });

      const mockEnv = { LEADS_KV: {} };
      const result = await deduplicateLead(mockLead, mockEnv);

      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: true for existing lead', async () => {
      const { checkForDuplicate } = await import('../../utils/deduplication');
      vi.mocked(checkForDuplicate).mockResolvedValueOnce({
        isDuplicate: true,
        existingLeadId: 'existing-lead-456',
      });

      const mockEnv = { LEADS_KV: {} };
      const result = await deduplicateLead(mockLead, mockEnv);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingLeadId).toBe('existing-lead-456');
    });

    it('should handle lead without email or phone', async () => {
      const leadWithoutContact: TikTokLead = {
        ...mockLead,
        user_details: { name: 'Anonymous' },
      };

      const mockEnv = { LEADS_KV: {} };
      const result = await deduplicateLead(leadWithoutContact, mockEnv);

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('handleTikTokWebhook', () => {
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        TIKTOK_WEBHOOK_SECRET: mockSecret,
        LEAD_QUALIFICATION: {
          idFromName: vi.fn().mockReturnValue('qual-id'),
          get: vi.fn().mockReturnValue({
            updateContact: vi.fn().mockResolvedValue(undefined),
            updateBANT: vi.fn().mockResolvedValue(undefined),
            getState: vi.fn().mockResolvedValue({
              score: { total: 50 },
              classification: 'nurture',
            }),
          }),
        },
        ENHANCED_CONVERSATION: {
          idFromName: vi.fn().mockReturnValue('conv-id'),
          get: vi.fn().mockReturnValue({
            processMessage: vi.fn().mockResolvedValue(undefined),
          }),
        },
        LEADS_KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        },
      };

      // Reset mocks
      vi.clearAllMocks();
    });

    it('should reject non-POST requests', async () => {
      const request = new Request('https://example.com/webhooks/tiktok', {
        method: 'GET',
      });

      const response = await handleTikTokWebhook(request, mockEnv);
      expect(response.status).toBe(405);
    });

    it('should reject invalid signature', async () => {
      const payload: TikTokWebhookPayload = {
        event: 'lead.create',
        timestamp: Date.now(),
        leads: [],
        page_id: 'page-123',
      };

      const request = new Request('https://example.com/webhooks/tiktok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TikTok-Signature': 'invalid-signature',
        },
        body: JSON.stringify(payload),
      });

      const response = await handleTikTokWebhook(request, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should process valid webhook with leads', async () => {
      const payload: TikTokWebhookPayload = {
        event: 'lead.create',
        timestamp: Date.now(),
        leads: [
          {
            event_id: 'evt-123',
            event_time: Date.now(),
            event_type: 'FORM_SUBMIT',
            form_id: 'form-123',
            form_name: 'Test Form',
            ad_id: 'ad-123',
            campaign_id: 'camp-123',
            creative_id: 'creative-123',
            page_id: 'page-123',
            user_details: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        ],
        page_id: 'page-123',
      };

      const payloadString = JSON.stringify(payload);

      // Generate valid signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(mockSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadString));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const request = new Request('https://example.com/webhooks/tiktok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TikTok-Signature': signature,
        },
        body: payloadString,
      });

      const response = await handleTikTokWebhook(request, mockEnv);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.processed).toBe(1);
    });

    it('should handle rate limiting', async () => {
      const { checkRateLimit, rateLimitResponse } = await import('../../middleware/rate-limiter');
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      });
      vi.mocked(rateLimitResponse).mockReturnValueOnce(
        new Response('Rate limited', { status: 429 })
      );

      const request = new Request('https://example.com/webhooks/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const response = await handleTikTokWebhook(request, mockEnv);
      expect(response.status).toBe(429);
    });

    it('should handle invalid JSON payload', async () => {
      // Generate valid signature for invalid JSON
      const payloadString = 'invalid json{';
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(mockSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadString));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const request = new Request('https://example.com/webhooks/tiktok', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TikTok-Signature': signature,
        },
        body: payloadString,
      });

      const response = await handleTikTokWebhook(request, mockEnv);
      expect(response.status).toBe(400);
    });
  });
});
