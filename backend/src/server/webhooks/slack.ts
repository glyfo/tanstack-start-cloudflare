/**
 * Slack Events API Webhook Handler
 *
 * Handles incoming messages and events from Slack.
 * Routes messages through ChannelGateway using SlackAdapter.
 *
 * https://api.slack.com/events-api
 */

import { SlackAdapter } from '../channels/adapters/slack-adapter';
import type { Env } from '../types/env';

/**
 * Handle Slack webhook request
 */
export async function handleSlackWebhook(
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

    console.log('[Slack] Incoming webhook:', {
      type: payload.type,
      event: payload.event?.type,
    });

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      return new Response(JSON.stringify({ challenge: payload.challenge }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle event callback
    if (payload.type === 'event_callback') {
      const event = payload.event;

      // Only handle message events
      if (event.type !== 'message') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Ignore bot messages, message edits, and deleted messages
      if (event.subtype && event.subtype !== 'file_share') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get organization from workspace ID
      const orgId = env.DEFAULT_WEBHOOK_ORG || 'default-org';
      const workspaceId = payload.team_id;

      // Get or create Slack adapter
      const adapter = await getSlackAdapter(env, orgId);

      // Normalize message to MessageEnvelope
      const envelope = await adapter.normalize(event, {
        orgId,
        workspaceId,
        channelInfo: {
          id: event.channel,
          is_channel: true, // TODO: Fetch actual channel info
          is_group: false,
          is_im: false,
          is_mpim: false,
        },
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
        console.error('[Slack] Gateway routing error:', error);
        return new Response(JSON.stringify({ ok: false, error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log('[Slack] Message routed successfully');
    }

    // Slack requires quick response (within 3 seconds)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Slack] Webhook error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200, // Always return 200 to prevent retries
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get or create Slack adapter for organization
 */
async function getSlackAdapter(env: Env, orgId: string): Promise<SlackAdapter> {
  const config = {
    id: `slack-${orgId}`,
    orgId,
    channelType: 'slack' as const,
    accountId: env.SLACK_WORKSPACE_ID || '',
    enabled: true,
    dmPolicy: 'open' as const,
    groupPolicy: 'allowlist' as const,
    textChunkLimit: 40000,
    chunkMode: 'newline' as const,
    sendReadReceipts: false,
    settings: {
      botToken: env.SLACK_BOT_TOKEN || '',
      signingSecret: env.SLACK_SIGNING_SECRET || '',
      workspaceId: env.SLACK_WORKSPACE_ID || '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = new SlackAdapter(config);
  await adapter.connect();

  return adapter;
}
