/**
 * Twilio SMS Webhook Handler
 *
 * Handles incoming SMS messages from Twilio.
 * Routes messages through ChannelGateway to appropriate agents.
 */

import { TwilioAdapter } from '../channels/adapters/twilio-adapter';
import type { Env } from '../types/env';

/**
 * Handle Twilio webhook request
 */
export async function handleTwilioWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Verify request method
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse form data from Twilio webhook
    const formData = await request.formData();
    const payload: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      payload[key] = value.toString();
    }

    console.log('[Twilio] Incoming SMS webhook:', {
      from: payload.From,
      to: payload.To,
      body: payload.Body?.substring(0, 100),
      messageSid: payload.MessageSid,
    });

    // Verify Twilio signature (recommended for production)
    const twilioSignature = request.headers.get('X-Twilio-Signature');
    if (!twilioSignature) {
      console.warn('[Twilio] Missing X-Twilio-Signature header');
      // In production, you should verify the signature
      // For now, we'll allow it to proceed
    }

    // Get organization from phone number mapping
    // For now, use default org (in production, implement phone number → org mapping)
    const orgId = env.DEFAULT_WEBHOOK_ORG || 'default-org';

    // Get or create Twilio adapter
    const adapter = await getTwilioAdapter(env, orgId);

    // Normalize webhook payload to MessageEnvelope
    const envelope = await adapter.normalize(payload, { orgId });

    // Get ChannelGateway stub
    const gatewayId = env.CHANNEL_GATEWAY.idFromName(orgId);
    const gateway = env.CHANNEL_GATEWAY.get(gatewayId);

    // Route message through Gateway
    const result = await gateway.fetch('http://internal/route-inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!result.ok) {
      const error = await result.text();
      console.error('[Twilio] Gateway routing error:', error);
      return new Response('Error processing message', { status: 500 });
    }

    // Return TwiML response (empty response tells Twilio we processed successfully)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    console.error('[Twilio] Webhook error:', error);
    return new Response(error.message || 'Internal server error', { status: 500 });
  }
}

/**
 * Get or create Twilio adapter for organization
 */
async function getTwilioAdapter(env: Env, orgId: string): Promise<TwilioAdapter> {
  // In a real implementation, you would:
  // 1. Fetch channel config from ChannelGateway
  // 2. Create adapter with config
  // 3. Cache adapter instance

  // For now, create a simple config from environment variables
  const config = {
    id: `twilio-${orgId}`,
    orgId,
    channelType: 'sms' as const,
    accountId: env.TWILIO_PHONE_NUMBER || '',
    enabled: true,
    dmPolicy: 'open' as const,
    groupPolicy: 'closed' as const,
    textChunkLimit: 1600,
    chunkMode: 'word' as const,
    sendReadReceipts: false,
    settings: {
      accountSid: env.TWILIO_ACCOUNT_SID || '',
      authToken: env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: env.TWILIO_PHONE_NUMBER || '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = new TwilioAdapter(config);
  await adapter.connect();

  return adapter;
}
