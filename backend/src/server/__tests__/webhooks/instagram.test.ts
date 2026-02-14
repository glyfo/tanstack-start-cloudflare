/**
 * Instagram Webhook Handler Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  handleInstagramWebhook,
  handleInstagramVerification,
  parseInstagramLeadFields,
} from '../../webhooks/instagram';

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

vi.mock('../../utils/webhook-routing', () => ({
  getOrgIdForWebhook: vi.fn().mockResolvedValue('test-org'),
  scopedKey: vi.fn().mockImplementation((orgId, key) => `${orgId}:${key}`),
}));

vi.mock('../../services/facebook-api', () => ({
  fetchLeadData: vi.fn().mockResolvedValue({
    id: 'lead-ig-123',
    created_time: '2026-02-01T10:00:00Z',
    field_data: [
      { name: 'email', values: ['ig@example.com'] },
      { name: 'full_name', values: ['Insta Lead'] },
      { name: 'phone_number', values: ['+15551234567'] },
    ],
    ad_id: 'ad-123',
    adset_id: 'adset-123',
    campaign_id: 'camp-123',
    form_id: 'form-123',
  }),
}));

vi.mock('../../workflows/opportunity-workflows', () => ({
  createOpportunityFromLead: vi.fn().mockResolvedValue({
    success: true,
    opportunityId: 'opp-ig-123',
  }),
  syncQualificationScore: vi.fn().mockResolvedValue(undefined),
}));

async function makeSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `sha256=${signatureHex}`;
}

describe('Instagram Webhook Handler', () => {
  describe('parseInstagramLeadFields', () => {
    it('maps standard fields and preserves custom fields', () => {
      const result = parseInstagramLeadFields([
        { name: 'full_name', values: ['Jane Doe'] },
        { name: 'email', values: ['jane@example.com'] },
        { name: 'phone', values: ['+15550001111'] },
        { name: 'custom_question', values: ['custom answer'] },
      ]);

      expect(result.name).toBe('Jane Doe');
      expect(result.email).toBe('jane@example.com');
      expect(result.phone).toBe('+15550001111');
      expect(result.customFields.custom_question).toBe('custom answer');
    });
  });

  describe('handleInstagramVerification', () => {
    it('returns challenge for valid verification token', async () => {
      const response = handleInstagramVerification(
        'subscribe',
        'test-token',
        'test-challenge',
        'test-token'
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('test-challenge');
    });
  });

  describe('handleInstagramWebhook', () => {
    it('processes a valid POST lead webhook event', async () => {
      const payload = JSON.stringify({
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
                  leadgen_id: 'leadgen-123',
                  created_time: Date.now(),
                  page_id: 'page-123',
                  adgroup_id: 'adgroup-123',
                },
              },
            ],
          },
        ],
      });

      const secret = 'test-app-secret';
      const signature = await makeSignature(payload, secret);

      const request = new Request('https://example.com/api/webhooks/instagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await handleInstagramWebhook(request, {
        FACEBOOK_APP_SECRET: secret,
        FACEBOOK_PAGE_ACCESS_TOKEN: 'test-access-token',
        FACEBOOK_VERIFY_TOKEN: 'test-verify-token',
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('EVENT_RECEIVED');
    });
  });
});
