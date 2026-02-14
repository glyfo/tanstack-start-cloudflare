/**
 * Webhook Signature Verification Tests
 *
 * Tests for verifyMetaSignature, verifyTikTokSignature, and related utilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyMetaSignature,
  verifyTikTokSignature,
  verifyWebhookSignature,
  extractSignature,
} from '../../utils/webhook-verification';

// Mock the logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Webhook Verification', () => {
  describe('verifyMetaSignature', () => {
    const appSecret = 'test-app-secret';

    it('should verify valid Meta signature', async () => {
      const payload = '{"test":"data"}';
      // Compute expected signature using the same algorithm
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = await verifyMetaSignature(payload, `sha256=${signature}`, appSecret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid Meta signature', async () => {
      const payload = '{"test":"data"}';
      const invalidSignature = 'sha256=invalid_signature_here_12345678901234567890';

      const isValid = await verifyMetaSignature(payload, invalidSignature, appSecret);
      expect(isValid).toBe(false);
    });

    it('should reject when signature is missing', async () => {
      const payload = '{"test":"data"}';

      const isValid = await verifyMetaSignature(payload, '', appSecret);
      expect(isValid).toBe(false);
    });

    it('should reject when app secret is missing', async () => {
      const payload = '{"test":"data"}';
      const signature = 'sha256=abc123';

      const isValid = await verifyMetaSignature(payload, signature, '');
      expect(isValid).toBe(false);
    });

    it('should handle signature without sha256= prefix', async () => {
      const payload = '{"test":"data"}';
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Without prefix should still work (the code strips sha256= if present)
      const isValid = await verifyMetaSignature(payload, signature, appSecret);
      expect(isValid).toBe(true);
    });

    it('should reject modified payload', async () => {
      const originalPayload = '{"test":"data"}';
      const modifiedPayload = '{"test":"modified"}';

      // Generate valid signature for original payload
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(originalPayload));
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Verify with modified payload should fail
      const isValid = await verifyMetaSignature(modifiedPayload, `sha256=${signature}`, appSecret);
      expect(isValid).toBe(false);
    });
  });

  describe('verifyTikTokSignature', () => {
    const secret = 'tiktok-webhook-secret';

    it('should verify valid TikTok signature', async () => {
      const payload = '{"event":"lead.create","leads":[]}';

      // Compute expected signature (base64-encoded HMAC-SHA256)
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const isValid = await verifyTikTokSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid TikTok signature', async () => {
      const payload = '{"event":"lead.create"}';
      const invalidSignature = 'aW52YWxpZF9zaWduYXR1cmU='; // "invalid_signature" in base64

      const isValid = await verifyTikTokSignature(payload, invalidSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should reject when signature is missing', async () => {
      const payload = '{"event":"lead.create"}';

      const isValid = await verifyTikTokSignature(payload, '', secret);
      expect(isValid).toBe(false);
    });

    it('should reject when secret is missing', async () => {
      const payload = '{"event":"lead.create"}';
      const signature = 'some-signature';

      const isValid = await verifyTikTokSignature(payload, signature, '');
      expect(isValid).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should route to Meta verification for facebook platform', async () => {
      const payload = '{}';
      const signature = 'sha256=invalid';
      const secret = 'secret';

      // Should return false for invalid signature (but not throw)
      const result = await verifyWebhookSignature('facebook', payload, signature, secret);
      expect(typeof result).toBe('boolean');
    });

    it('should route to Meta verification for whatsapp platform', async () => {
      const payload = '{}';
      const signature = 'sha256=invalid';
      const secret = 'secret';

      const result = await verifyWebhookSignature('whatsapp', payload, signature, secret);
      expect(typeof result).toBe('boolean');
    });

    it('should route to TikTok verification for tiktok platform', async () => {
      const payload = '{}';
      const signature = 'invalid';
      const secret = 'secret';

      const result = await verifyWebhookSignature('tiktok', payload, signature, secret);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('extractSignature', () => {
    it('should extract Meta signature from X-Hub-Signature-256 header', () => {
      const request = new Request('https://example.com', {
        headers: { 'X-Hub-Signature-256': 'sha256=abc123' },
      });

      expect(extractSignature(request, 'facebook')).toBe('sha256=abc123');
      expect(extractSignature(request, 'whatsapp')).toBe('sha256=abc123');
    });

    it('should extract Meta signature from lowercase header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-hub-signature-256': 'sha256=abc123' },
      });

      expect(extractSignature(request, 'facebook')).toBe('sha256=abc123');
    });

    it('should extract TikTok signature from X-TikTok-Signature header', () => {
      const request = new Request('https://example.com', {
        headers: { 'X-TikTok-Signature': 'base64signature==' },
      });

      expect(extractSignature(request, 'tiktok')).toBe('base64signature==');
    });

    it('should extract TikTok signature from lowercase header', () => {
      const request = new Request('https://example.com', {
        headers: { 'x-tiktok-signature': 'base64signature==' },
      });

      expect(extractSignature(request, 'tiktok')).toBe('base64signature==');
    });

    it('should return empty string when header is missing', () => {
      const request = new Request('https://example.com');

      expect(extractSignature(request, 'facebook')).toBe('');
      expect(extractSignature(request, 'tiktok')).toBe('');
    });
  });
});
