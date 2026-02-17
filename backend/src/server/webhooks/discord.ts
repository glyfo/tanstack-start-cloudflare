/**
 * Discord Interactions Webhook Handler
 *
 * Handles incoming messages and interactions from Discord.
 * Routes messages through ChannelGateway using DiscordAdapter.
 *
 * https://discord.com/developers/docs/interactions/receiving-and-responding
 */

import { DiscordAdapter } from '../channels/adapters/discord-adapter';
import type { Env } from '../types/env';

/**
 * Verify Discord request signature
 */
async function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): Promise<boolean> {
  // Discord uses Ed25519 signature verification
  // Implementation requires crypto library
  // For now, skip verification (implement in production)
  return true;
}

/**
 * Handle Discord webhook request
 */
export async function handleDiscordWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Verify request method
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Read body
    const body = await request.text();

    // Verify signature (if public key configured)
    const signature = request.headers.get('X-Signature-Ed25519') || '';
    const timestamp = request.headers.get('X-Signature-Timestamp') || '';
    const publicKey = env.DISCORD_PUBLIC_KEY || '';

    if (publicKey && signature && timestamp) {
      const isValid = await verifyDiscordSignature(body, signature, timestamp, publicKey);
      if (!isValid) {
        console.warn('[Discord] Invalid signature');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Parse payload
    const payload = JSON.parse(body);

    console.log('[Discord] Incoming webhook:', {
      type: payload.type,
      data: payload.data?.name,
    });

    // Handle ping (verification)
    if (payload.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle message component interactions
    if (payload.type === 3) {
      // Button clicks, select menus, etc.
      // Respond immediately
      return new Response(JSON.stringify({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: 'Processing...',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For gateway-based bots, we don't use webhooks for messages
    // Messages come through Discord Gateway WebSocket
    // This webhook is primarily for slash commands and interactions

    return new Response(JSON.stringify({ type: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Discord] Webhook error:', error);
    return new Response(error.message || 'Internal server error', { status: 500 });
  }
}

/**
 * Handle Discord message (from Gateway WebSocket)
 * This would be called by a Discord Gateway client
 */
export async function handleDiscordMessage(
  message: any,
  env: Env,
): Promise<void> {
  try {
    const orgId = env.DEFAULT_WEBHOOK_ORG || 'default-org';

    // Get or create Discord adapter
    const adapter = await getDiscordAdapter(env, orgId);

    // Normalize message to MessageEnvelope
    const envelope = await adapter.normalize(message, {
      orgId,
      isDM: !message.guild_id,
    });

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
      console.error('[Discord] Gateway routing error:', error);
    } else {
      console.log('[Discord] Message routed successfully');
    }
  } catch (error: any) {
    console.error('[Discord] Message handling error:', error);
  }
}

/**
 * Get or create Discord adapter for organization
 */
async function getDiscordAdapter(env: Env, orgId: string): Promise<DiscordAdapter> {
  const config = {
    id: `discord-${orgId}`,
    orgId,
    channelType: 'discord' as const,
    accountId: env.DISCORD_APPLICATION_ID || '',
    enabled: true,
    dmPolicy: 'open' as const,
    groupPolicy: 'allowlist' as const,
    textChunkLimit: 2000,
    chunkMode: 'word' as const,
    sendReadReceipts: false,
    settings: {
      botToken: env.DISCORD_BOT_TOKEN || '',
      publicKey: env.DISCORD_PUBLIC_KEY || '',
      applicationId: env.DISCORD_APPLICATION_ID || '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = new DiscordAdapter(config);
  await adapter.connect();

  return adapter;
}
