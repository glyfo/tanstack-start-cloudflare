/**
 * Facebook Webhook Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleFacebookWebhook,
  handleFacebookVerification,
  verifyFacebookSignature,
  extractContactInfo,
  extractBANTData,
  type FacebookLeadField,
} from '../../webhooks/facebook';

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

vi.mock('../../services/facebook-api', () => ({
  fetchLeadData: vi.fn().mockResolvedValue({
    id: 'lead-123',
    created_time: '2026-01-20T10:00:00Z',
    field_data: [
      { name: 'email', values: ['john@example.com'] },
      { name: 'full_name', values: ['John Doe'] },
    ],
    ad_id: 'ad-123',
    adset_id: 'adset-123',
    campaign_id: 'camp-123',
    form_id: 'form-123',
  }),
}));

vi.mock('../../utils/webhook-routing', () => ({
  getOrgIdForWebhook: vi.fn().mockResolvedValue('test-org'),
  scopedKey: vi.fn().mockImplementation((orgId, key) => `${orgId}:${key}`),
}));

vi.mock('../../workflows/opportunity-workflows', () => ({
  createOpportunityFromLead: vi.fn().mockResolvedValue({
    success: true,
    opportunityId: 'opp-123',
  }),
  syncQualificationScore: vi.fn().mockResolvedValue(undefined),
}));

describe('Facebook Webhook Handler', () => {
  const appSecret = 'test-app-secret';

  describe('verifyFacebookSignature', () => {
    it('should verify valid signature', async () => {
      const payload = '{"object":"page","entry":[]}';

      // Generate valid signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = await verifyFacebookSignature(
        payload,
        `sha256=${signatureHex}`,
        appSecret
      );
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const payload = '{"object":"page"}';
      const isValid = await verifyFacebookSignature(
        payload,
        'sha256=invalid_signature',
        appSecret
      );
      expect(isValid).toBe(false);
    });

    it('should reject signature without sha256 prefix', async () => {
      const payload = '{"object":"page"}';
      const isValid = await verifyFacebookSignature(
        payload,
        'invalid_format_signature',
        appSecret
      );
      expect(isValid).toBe(false);
    });

    it('should reject missing signature', async () => {
      const isValid = await verifyFacebookSignature('{}', '', appSecret);
      expect(isValid).toBe(false);
    });

    it('should reject missing app secret', async () => {
      const isValid = await verifyFacebookSignature('{}', 'sha256=abc', '');
      expect(isValid).toBe(false);
    });
  });

  describe('extractContactInfo', () => {
    it('should extract standard contact fields', () => {
      const fieldData: FacebookLeadField[] = [
        { name: 'email', values: ['john@example.com'] },
        { name: 'full_name', values: ['John Doe'] },
        { name: 'phone_number', values: ['+15551234567'] },
        { name: 'company_name', values: ['Acme Inc'] },
        { name: 'city', values: ['San Francisco'] },
        { name: 'state', values: ['CA'] },
        { name: 'country', values: ['USA'] },
        { name: 'zip_code', values: ['94102'] },
      ];

      const result = extractContactInfo(fieldData);

      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John Doe');
      expect(result.phone).toBe('+15551234567');
      expect(result.company).toBe('Acme Inc');
      expect(result.city).toBe('San Francisco');
      expect(result.state).toBe('CA');
      expect(result.country).toBe('USA');
      expect(result.zip).toBe('94102');
    });

    it('should construct full name from first and last name', () => {
      const fieldData: FacebookLeadField[] = [
        { name: 'first_name', values: ['John'] },
        { name: 'last_name', values: ['Doe'] },
      ];

      const result = extractContactInfo(fieldData);
      expect(result.name).toBe('John Doe');
    });

    it('should store unknown fields as custom fields', () => {
      const fieldData: FacebookLeadField[] = [
        { name: 'custom_question', values: ['Custom answer'] },
        { name: 'preferred_time', values: ['Morning'] },
      ];

      const result = extractContactInfo(fieldData);

      expect(result.customFields['custom_question']).toBe('Custom answer');
      expect(result.customFields['preferred_time']).toBe('Morning');
    });

    it('should handle empty field values', () => {
      const fieldData: FacebookLeadField[] = [
        { name: 'email', values: [] },
      ];

      const result = extractContactInfo(fieldData);
      expect(result.email).toBe('');
    });

    it('should handle phone field alias', () => {
      const fieldData: FacebookLeadField[] = [
        { name: 'phone', values: ['+15551234567'] },
      ];

      const result = extractContactInfo(fieldData);
      expect(result.phone).toBe('+15551234567');
    });
  });

  describe('extractBANTData', () => {
    it('should extract budget from budget field', () => {
      const customFields = { budget: '$10,000-$25,000' };
      const bant = extractBANTData(customFields);

      expect(bant.budget).toBeDefined();
      expect(bant.budget.range).toBe('$10,000-$25,000');
      expect(bant.budget.qualified).toBe(true);
      expect(bant.budget.confidence).toBe(0.7);
    });

    it('should extract timeline from timeline field', () => {
      const customFields = { timeline: '3-6 months' };
      const bant = extractBANTData(customFields);

      expect(bant.timeline).toBeDefined();
      expect(bant.timeline.range).toBe('3-6 months');
    });

    it('should extract need from problem field', () => {
      const customFields = { problem: 'Need better CRM solution' };
      const bant = extractBANTData(customFields);

      expect(bant.need).toBeDefined();
      expect(bant.need.description).toBe('Need better CRM solution');
      expect(bant.need.painPoints).toContain('Need better CRM solution');
    });

    it('should identify decision maker from job title', () => {
      const customFields = { job_title: 'CEO' };
      const bant = extractBANTData(customFields);

      expect(bant.authority).toBeDefined();
      expect(bant.authority.role).toBe('decision_maker');
      expect(bant.authority.canApprove).toBe(true);
    });

    it('should identify influencer from non-executive job title', () => {
      const customFields = { job_title: 'Software Engineer' };
      const bant = extractBANTData(customFields);

      expect(bant.authority).toBeDefined();
      expect(bant.authority.role).toBe('influencer');
      expect(bant.authority.canApprove).toBe(false);
    });

    it('should return empty object when no BANT fields', () => {
      const customFields = { random_field: 'value' };
      const bant = extractBANTData(customFields);

      expect(Object.keys(bant)).toHaveLength(0);
    });
  });

  describe('handleFacebookVerification', () => {
    it('should return challenge when verification succeeds', () => {
      const mockEnv = { FACEBOOK_VERIFY_TOKEN: 'test-verify-token' };
      const request = new Request(
        'https://example.com/webhooks/facebook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=test-challenge'
      );

      const response = handleFacebookVerification(request, mockEnv);

      expect(response.status).toBe(200);
    });

    it('should return 403 when token does not match', () => {
      const mockEnv = { FACEBOOK_VERIFY_TOKEN: 'correct-token' };
      const request = new Request(
        'https://example.com/webhooks/facebook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=test-challenge'
      );

      const response = handleFacebookVerification(request, mockEnv);

      expect(response.status).toBe(403);
    });

    it('should return 403 when mode is not subscribe', () => {
      const mockEnv = { FACEBOOK_VERIFY_TOKEN: 'test-token' };
      const request = new Request(
        'https://example.com/webhooks/facebook?hub.mode=unsubscribe&hub.verify_token=test-token&hub.challenge=test-challenge'
      );

      const response = handleFacebookVerification(request, mockEnv);

      expect(response.status).toBe(403);
    });
  });

  describe('handleFacebookWebhook', () => {
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        FACEBOOK_APP_SECRET: appSecret,
        FACEBOOK_VERIFY_TOKEN: 'test-verify-token',
        FACEBOOK_PAGE_ACCESS_TOKEN: 'test-page-token',
        LEAD_QUALIFICATION_DO: {
          idFromName: vi.fn().mockReturnValue('qual-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(
              new Response(JSON.stringify({ score: { total: 50 }, classification: 'nurture' }))
            ),
          }),
        },
        ENHANCED_CONVERSATION: {
          idFromName: vi.fn().mockReturnValue('conv-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(new Response('OK')),
          }),
        },
        LEADS_KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
        },
      };

      vi.clearAllMocks();
    });

    it('should handle verification GET request', async () => {
      const request = new Request(
        'https://example.com/webhooks/facebook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=test-challenge',
        { method: 'GET' }
      );

      const response = await handleFacebookWebhook(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should reject non-GET/POST methods', async () => {
      const request = new Request('https://example.com/webhooks/facebook', {
        method: 'DELETE',
      });

      const response = await handleFacebookWebhook(request, mockEnv);
      expect(response.status).toBe(405);
    });

    it('should reject invalid signature', async () => {
      const payload = { object: 'page', entry: [] };
      const request = new Request('https://example.com/webhooks/facebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid',
        },
        body: JSON.stringify(payload),
      });

      const response = await handleFacebookWebhook(request, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should process valid webhook payload', async () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page-123',
            time: Date.now(),
            changes: [
              {
                field: 'leadgen',
                value: {
                  ad_id: 'ad-123',
                  form_id: 'form-123',
                  leadgen_id: 'lead-123',
                  created_time: Date.now(),
                  page_id: 'page-123',
                  adgroup_id: 'adgroup-123',
                },
              },
            ],
          },
        ],
      };

      const payloadString = JSON.stringify(payload);

      // Generate valid signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadString));
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const request = new Request('https://example.com/webhooks/facebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${signatureHex}`,
        },
        body: payloadString,
      });

      const response = await handleFacebookWebhook(request, mockEnv);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
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

      const request = new Request('https://example.com/webhooks/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const response = await handleFacebookWebhook(request, mockEnv);
      expect(response.status).toBe(429);
    });

    it('should handle invalid JSON payload', async () => {
      const payloadString = 'invalid json{';

      // Generate valid signature for invalid JSON
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadString));
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const request = new Request('https://example.com/webhooks/facebook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${signatureHex}`,
        },
        body: payloadString,
      });

      const response = await handleFacebookWebhook(request, mockEnv);
      expect(response.status).toBe(400);
    });
  });
});
