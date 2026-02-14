/**
 * WhatsApp Webhook Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleWhatsAppWebhook,
  handleWhatsAppVerification,
  processWhatsAppMessage,
  processStatusUpdate,
  type WhatsAppContact,
} from '../../webhooks/whatsapp';

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../utils/webhook-verification', () => ({
  verifyMetaSignature: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../middleware/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientId: vi.fn().mockReturnValue('test-client'),
  rateLimitResponse: vi.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

vi.mock('../../services/whatsapp-message-parser', () => ({
  parseWhatsAppMessage: vi.fn().mockReturnValue({
    content: 'Hello, I need help',
    metadata: { type: 'text' },
  }),
}));

vi.mock('../../utils/webhook-routing', () => ({
  getOrgIdForWebhook: vi.fn().mockResolvedValue('test-org'),
  scopedKey: vi.fn().mockImplementation((orgId, key) => `${orgId}:${key}`),
}));

describe('WhatsApp Webhook Handler', () => {
  describe('handleWhatsAppVerification', () => {
    it('should return challenge when verification succeeds', () => {
      const mockEnv = { WHATSAPP_VERIFY_TOKEN: 'test-whatsapp-token' };
      const request = new Request(
        'https://example.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-whatsapp-token&hub.challenge=test-challenge-123'
      );

      const response = handleWhatsAppVerification(request, mockEnv);

      expect(response.status).toBe(200);
    });

    it('should use default token when env not set', () => {
      const mockEnv = {};
      const request = new Request(
        'https://example.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=dev-whatsapp-verify-token&hub.challenge=test-challenge'
      );

      const response = handleWhatsAppVerification(request, mockEnv);

      expect(response.status).toBe(200);
    });

    it('should return 403 when token does not match', () => {
      const mockEnv = { WHATSAPP_VERIFY_TOKEN: 'correct-token' };
      const request = new Request(
        'https://example.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=test-challenge'
      );

      const response = handleWhatsAppVerification(request, mockEnv);

      expect(response.status).toBe(403);
    });

    it('should return 403 when mode is not subscribe', () => {
      const mockEnv = { WHATSAPP_VERIFY_TOKEN: 'test-token' };
      const request = new Request(
        'https://example.com/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=test-token&hub.challenge=test-challenge'
      );

      const response = handleWhatsAppVerification(request, mockEnv);

      expect(response.status).toBe(403);
    });
  });

  describe('processWhatsAppMessage', () => {
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        WHATSAPP_CONVERSATION: {
          idFromName: vi.fn().mockReturnValue('conv-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(
              new Response(
                JSON.stringify({
                  lastInboundMessageTime: new Date().toISOString(),
                  messageCount: 5,
                })
              )
            ),
          }),
        },
        CHAT_AGENT: {
          idFromName: vi.fn().mockReturnValue('agent-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(new Response('OK')),
          }),
        },
      };

      vi.clearAllMocks();
    });

    it('should process text message successfully', async () => {
      const message = {
        id: 'msg-123',
        from: '15551234567',
        timestamp: String(Date.now()),
        type: 'text' as const,
        text: { body: 'Hello!' },
      };

      const contact: WhatsAppContact = {
        profile: { name: 'John Doe' },
        wa_id: '15551234567',
      };

      const result = await processWhatsAppMessage(
        message,
        contact,
        'phone-number-id',
        mockEnv
      );

      expect(result.success).toBe(true);
      expect(mockEnv.WHATSAPP_CONVERSATION.get).toHaveBeenCalled();
    });

    it('should route message to ChatAgent when within 24-hour window', async () => {
      const message = {
        id: 'msg-123',
        from: '15551234567',
        timestamp: String(Date.now()),
        type: 'text' as const,
        text: { body: 'I need help with my order' },
      };

      const contact: WhatsAppContact = {
        profile: { name: 'Jane Smith' },
        wa_id: '15551234567',
      };

      await processWhatsAppMessage(message, contact, 'phone-id', mockEnv);

      expect(mockEnv.CHAT_AGENT.get).toHaveBeenCalled();
    });

    it('should not auto-respond when outside 24-hour window', async () => {
      // Mock conversation state with old timestamp (outside 24-hour window)
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      mockEnv.WHATSAPP_CONVERSATION.get.mockReturnValue({
        fetch: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              lastInboundMessageTime: oldTimestamp,
              messageCount: 5,
            })
          )
        ),
      });

      const message = {
        id: 'msg-123',
        from: '15551234567',
        timestamp: String(Date.now()),
        type: 'text' as const,
        text: { body: 'Hello' },
      };

      const contact: WhatsAppContact = {
        profile: { name: 'John Doe' },
        wa_id: '15551234567',
      };

      await processWhatsAppMessage(message, contact, 'phone-id', mockEnv);

      // ChatAgent should not be called when outside window
      expect(mockEnv.CHAT_AGENT.get).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockEnv.WHATSAPP_CONVERSATION.get.mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('DO error')),
      });

      const message = {
        id: 'msg-123',
        from: '15551234567',
        timestamp: String(Date.now()),
        type: 'text' as const,
        text: { body: 'Hello' },
      };

      const contact: WhatsAppContact = {
        profile: { name: 'John Doe' },
        wa_id: '15551234567',
      };

      const result = await processWhatsAppMessage(
        message,
        contact,
        'phone-id',
        mockEnv
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DO error');
    });
  });

  describe('processStatusUpdate', () => {
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        WHATSAPP_CONVERSATION: {
          idFromName: vi.fn().mockReturnValue('conv-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(new Response('OK')),
          }),
        },
      };
    });

    it('should update message status', async () => {
      const status = {
        id: 'msg-123',
        status: 'delivered',
        recipient_id: '15551234567',
        timestamp: String(Date.now()),
      };

      await processStatusUpdate(status, 'phone-id', mockEnv);

      expect(mockEnv.WHATSAPP_CONVERSATION.get).toHaveBeenCalled();
    });

    it('should handle status update errors gracefully', async () => {
      mockEnv.WHATSAPP_CONVERSATION.get.mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      const status = {
        id: 'msg-123',
        status: 'read',
        recipient_id: '15551234567',
        timestamp: String(Date.now()),
      };

      // Should not throw
      await expect(
        processStatusUpdate(status, 'phone-id', mockEnv)
      ).resolves.not.toThrow();
    });
  });

  describe('handleWhatsAppWebhook', () => {
    let mockEnv: any;

    beforeEach(() => {
      mockEnv = {
        FACEBOOK_APP_SECRET: 'test-app-secret',
        WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
        WHATSAPP_CONVERSATION: {
          idFromName: vi.fn().mockReturnValue('conv-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(
              new Response(
                JSON.stringify({
                  lastInboundMessageTime: new Date().toISOString(),
                  messageCount: 1,
                })
              )
            ),
          }),
        },
        CHAT_AGENT: {
          idFromName: vi.fn().mockReturnValue('agent-id'),
          get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(new Response('OK')),
          }),
        },
      };

      vi.clearAllMocks();
    });

    it('should handle verification GET request', async () => {
      const request = new Request(
        'https://example.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=test-challenge',
        { method: 'GET' }
      );

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should reject non-GET/POST methods', async () => {
      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'PUT',
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(405);
    });

    it('should process incoming message webhook', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'business-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+15551234567',
                    phone_number_id: 'phone-id-123',
                  },
                  contacts: [
                    {
                      profile: { name: 'John Doe' },
                      wa_id: '15559876543',
                    },
                  ],
                  messages: [
                    {
                      id: 'msg-123',
                      from: '15559876543',
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: 'text',
                      text: { body: 'Hello!' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=valid',
        },
        body: JSON.stringify(payload),
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.processed).toBe(1);
    });

    it('should process status update webhook', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'business-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+15551234567',
                    phone_number_id: 'phone-id-123',
                  },
                  statuses: [
                    {
                      id: 'msg-123',
                      status: 'delivered',
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      recipient_id: '15559876543',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=valid',
        },
        body: JSON.stringify(payload),
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.results[0].status).toBe('status_updated');
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

      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(429);
    });

    it('should reject invalid signature when app secret is set', async () => {
      const { verifyMetaSignature } = await import('../../utils/webhook-verification');
      vi.mocked(verifyMetaSignature).mockResolvedValueOnce(false);

      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid',
        },
        body: '{"object":"whatsapp_business_account","entry":[]}',
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should skip signature verification when app secret not set', async () => {
      const envWithoutSecret = { ...mockEnv, FACEBOOK_APP_SECRET: undefined };

      const payload = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await handleWhatsAppWebhook(request, envWithoutSecret);
      // Should succeed without signature verification
      expect(response.status).toBe(200);
    });

    it('should handle invalid JSON payload', async () => {
      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=valid',
        },
        body: 'invalid json{',
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      expect(response.status).toBe(400);
    });

    it('should return 200 even on internal errors (WhatsApp requirement)', async () => {
      mockEnv.WHATSAPP_CONVERSATION.get.mockImplementation(() => {
        throw new Error('Internal error');
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'business-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+15551234567',
                    phone_number_id: 'phone-id-123',
                  },
                  contacts: [{ profile: { name: 'Test' }, wa_id: '123' }],
                  messages: [
                    {
                      id: 'msg-123',
                      from: '123',
                      timestamp: String(Date.now()),
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = new Request('https://example.com/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=valid',
        },
        body: JSON.stringify(payload),
      });

      const response = await handleWhatsAppWebhook(request, mockEnv);
      // WhatsApp requires 200 response even on errors
      expect(response.status).toBe(200);
    });
  });
});
