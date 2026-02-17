/**
 * Telegram Bot API Webhook Handler
 *
 * Handles incoming messages and updates from Telegram.
 * Routes messages through ChannelGateway using TelegramAdapter.
 *
 * https://core.telegram.org/bots/api#getting-updates
 */

import { TelegramAdapter } from '../channels/adapters/telegram-adapter';
import type { Env } from '../types/env';

/**
 * Handle Telegram webhook request
 */
export async function handleTelegramWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Verify request method
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse payload
    const payload = await request.json() as any;

    console.log('[Telegram] Incoming webhook:', {
      updateId: payload.update_id,
      hasMessage: !!payload.message,
      hasEditedMessage: !!payload.edited_message,
    });

    // Extract message (handle both new and edited messages)
    const message = payload.message || payload.edited_message;

    if (!message) {
      // No message to process (might be other update types)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get organization (in production, map bot token to org)
    const orgId = env.DEFAULT_WEBHOOK_ORG || 'default-org';

    // Get or create Telegram adapter
    const adapter = await getTelegramAdapter(env, orgId);

    // Normalize message to MessageEnvelope
    const envelope = await adapter.normalize(message, { orgId });

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
      console.error('[Telegram] Gateway routing error:', error);
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Telegram] Message routed successfully');

    // Telegram expects JSON response
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Telegram] Webhook error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200, // Always return 200 to prevent retries
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get or create Telegram adapter for organization
 */
async function getTelegramAdapter(env: Env, orgId: string): Promise<TelegramAdapter> {
  const config = {
    id: `telegram-${orgId}`,
    orgId,
    channelType: 'telegram' as const,
    accountId: env.TELEGRAM_BOT_USERNAME || '',
    enabled: true,
    dmPolicy: 'open' as const,
    groupPolicy: 'allowlist' as const,
    textChunkLimit: 4096,
    chunkMode: 'newline' as const,
    sendReadReceipts: false,
    settings: {
      botToken: env.TELEGRAM_BOT_TOKEN || '',
      botUsername: env.TELEGRAM_BOT_USERNAME || '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = new TelegramAdapter(config);
  await adapter.connect();

  return adapter;
}
