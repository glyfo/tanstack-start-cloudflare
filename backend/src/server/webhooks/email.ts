/**
 * Email Webhook Handler (Cloudflare Email Workers)
 *
 * Handles incoming emails via Cloudflare Email Routing.
 * Routes emails through ChannelGateway using EmailAdapter.
 *
 * https://developers.cloudflare.com/email-routing/email-workers/
 */

import { EmailAdapter } from '../channels/adapters/email-adapter';
import type { Env } from '../types/env';

/**
 * Email message handler (Cloudflare Email Workers)
 * This is called by the email worker binding in wrangler.jsonc
 */
export async function handleInboundEmail(
  message: any,
  env: Env,
): Promise<void> {
  try {
    console.log('[Email] Incoming email:', {
      from: message.from,
      to: message.to,
      subject: message.headers.get('Subject'),
      size: message.rawSize,
    });

    // Extract organization from recipient email address
    // Format: support@org.example.com -> org
    // For now, use default org
    const orgId = env.DEFAULT_WEBHOOK_ORG || 'default-org';

    // Get or create Email adapter
    const adapter = await getEmailAdapter(env, orgId);

    // Normalize email to MessageEnvelope
    const envelope = await adapter.normalize(message, {
      orgId,
      messageId: message.headers.get('Message-ID'),
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
      console.error('[Email] Gateway routing error:', error);
      throw new Error(`Gateway error: ${error}`);
    }

    console.log('[Email] Email routed successfully');
  } catch (error: any) {
    console.error('[Email] Error processing email:', error);
    // Email Workers don't support rejecting emails, so we log and continue
  }
}

/**
 * Get or create Email adapter for organization
 */
async function getEmailAdapter(env: Env, orgId: string): Promise<EmailAdapter> {
  const config = {
    id: `email-${orgId}`,
    orgId,
    channelType: 'email' as const,
    accountId: env.EMAIL_FROM_ADDRESS || '',
    enabled: true,
    dmPolicy: 'allowlist' as const, // Email should be allowlist by default
    groupPolicy: 'closed' as const,
    textChunkLimit: 100000,
    chunkMode: 'newline' as const,
    sendReadReceipts: false,
    settings: {
      smtpHost: 'smtp.mailchannels.net',
      smtpPort: 587,
      fromAddress: env.EMAIL_FROM_ADDRESS || '',
      fromName: env.EMAIL_FROM_NAME || 'CRM Support',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = new EmailAdapter(config);
  await adapter.connect();

  return adapter;
}

/**
 * Export email handler for Cloudflare Email Workers
 */
export default {
  async email(message: any, env: Env, ctx: ExecutionContext) {
    await handleInboundEmail(message, env);
  },
};
