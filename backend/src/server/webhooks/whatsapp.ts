/**
 * WhatsApp Business API Webhook Handler (Refactored for Multi-Channel Architecture)
 *
 * Handles incoming messages and status updates from WhatsApp Cloud API.
 * Routes messages through ChannelGateway using WhatsAppAdapter.
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

import { createLogger } from '../utils/logger';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import { verifyMetaSignature } from '../utils/webhook-verification';
import { type WhatsAppMessage } from '../services/whatsapp-message-parser';
import { getOrgIdForWebhook } from '../utils/webhook-routing';
import { WhatsAppAdapter } from '../channels/adapters/whatsapp-adapter';
import type { Env } from '../types/env';

const logger = createLogger('WhatsAppWebhook');

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string; // WhatsApp ID (phone number)
}

export interface WhatsAppMessageValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: Array<{
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
    conversation?: {
      id: string;
      origin: {
        type: string;
      };
    };
    pricing?: {
      billable: boolean;
      pricing_model: string;
      category: string;
    };
  }>;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data: {
      details: string;
    };
  }>;
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: WhatsAppMessageValue;
    field: 'messages';
  }>;
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppWebhookEntry[];
}

/**
 * Verify WhatsApp webhook (GET request)
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/verification
 */
export function handleWhatsAppVerification(
  request: Request,
  env: any
): Response {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = env.WHATSAPP_VERIFY_TOKEN || 'dev-whatsapp-verify-token';

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[WhatsAppWebhook] Webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  logger.warn('[WhatsAppWebhook] Webhook verification failed', { mode, token });
  return new Response('Forbidden', { status: 403 });
}

/**
 * Process incoming WhatsApp message (Refactored for Multi-Channel Architecture)
 * Routes through ChannelGateway using WhatsAppAdapter
 */
export async function processWhatsAppMessage(
  message: WhatsAppMessage,
  contact: WhatsAppContact,
  phoneNumberId: string,
  env: Env,
  orgId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const waId = contact.wa_id;
    const contactName = contact.profile.name;

    logger.info('[WhatsAppWebhook] Processing message (via ChannelGateway)', {
      waId,
      orgId,
      messageId: message.id,
      type: message.type,
      from: message.from,
    });

    // Get or create WhatsApp adapter
    const adapter = await getWhatsAppAdapter(env, orgId);

    // Normalize WhatsApp message to MessageEnvelope
    const envelope = await adapter.normalize(message, {
      orgId,
      isGroup: false, // TODO: Detect group messages
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
      logger.error('[WhatsAppWebhook] Gateway routing error:', error);
      return {
        success: false,
        error: `Gateway error: ${error}`,
      };
    }

    logger.info('[WhatsAppWebhook] Message routed successfully via ChannelGateway', {
      waId,
      messageId: message.id,
    });

    return { success: true };
  } catch (error: any) {
    logger.error('[WhatsAppWebhook] Error processing message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process message status update
 * Multi-tenant: Uses org-scoped DO keys
 */
export async function processStatusUpdate(
  status: any,
  phoneNumberId: string,
  env: any,
  orgId: string
): Promise<void> {
  try {
    const { id, status: statusType, recipient_id } = status;
    // Org-scoped key for multi-tenant isolation
    const scopedRecipientId = scopedKey(orgId, recipient_id);

    logger.info('[WhatsAppWebhook] Processing status update', {
      messageId: id,
      status: statusType,
      recipientId: recipient_id,
      orgId,
    });

    // Get conversation DO (org-scoped)
    const conversationId = env.WHATSAPP_CONVERSATION.idFromName(scopedRecipientId);
    const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

    // Update message status
    await conversationDO.fetch(
      new Request('https://internal/updateMessageStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: id,
          status: statusType,
          timestamp: status.timestamp,
        }),
      })
    );

    logger.info('[WhatsAppWebhook] Status updated', {
      messageId: id,
      status: statusType,
    });
  } catch (error) {
    logger.error('[WhatsAppWebhook] Error processing status update', error);
  }
}

/**
 * Handle WhatsApp webhook request
 */
export async function handleWhatsAppWebhook(
  request: Request,
  env: any
): Promise<Response> {
  try {
    // Handle verification (GET)
    if (request.method === 'GET') {
      return handleWhatsAppVerification(request, env);
    }

    // Handle webhook events (POST)
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Check rate limit (allow 200 requests per minute per IP)
    const clientId = getClientId(request);
    const rateLimit = await checkRateLimit(
      env,
      clientId,
      '/webhooks/whatsapp',
      200,
      60
    );

    if (!rateLimit.allowed) {
      logger.warn('[WhatsAppWebhook] Rate limit exceeded', { clientId });
      return rateLimitResponse(rateLimit.retryAfter || 60);
    }

    // Read body
    const body = await request.text();

    // Verify webhook signature
    const signature = request.headers.get('X-Hub-Signature-256') || '';
    const appSecret = env.FACEBOOK_APP_SECRET;

    if (appSecret) {
      const isValid = await verifyMetaSignature(body, signature, appSecret);
      if (!isValid) {
        logger.warn('[WhatsAppWebhook] Invalid signature', {
          hasSignature: !!signature,
          signatureLength: signature.length
        });
        return new Response('Unauthorized', { status: 401 });
      }
    } else {
      logger.warn('[WhatsAppWebhook] FACEBOOK_APP_SECRET not configured, skipping signature verification');
    }

    // Parse payload
    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      logger.error('[WhatsAppWebhook] Invalid JSON payload', error);
      return new Response('Invalid payload', { status: 400 });
    }

    logger.info('[WhatsAppWebhook] Received webhook', {
      object: payload.object,
      entries: payload.entry?.length || 0,
    });

    // Process each entry
    const results: any[] = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const phoneNumberId = value.metadata.phone_number_id;

        // Get organization ID from webhook routing (multi-tenant)
        const orgId = await getOrgIdForWebhook(env, 'whatsapp', phoneNumberId);
        if (!orgId) {
          logger.error('[WhatsAppWebhook] No organization found for phone_number_id', {
            phoneNumberId,
          });
          // Continue processing but log the error - WhatsApp requires 200 response
          results.push({
            status: 'error',
            error: 'Organization not configured for this WhatsApp number',
          });
          continue;
        }

        logger.info('[WhatsAppWebhook] Routing to organization', { orgId, phoneNumberId });

        // Process incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            const contact = value.contacts?.[0];
            if (!contact) {
              logger.warn('[WhatsAppWebhook] No contact info for message', {
                messageId: message.id,
              });
              continue;
            }

            const result = await processWhatsAppMessage(
              message,
              contact,
              phoneNumberId,
              env,
              orgId
            );

            results.push({
              message_id: message.id,
              wa_id: contact.wa_id,
              status: result.success ? 'processed' : 'error',
              error: result.error,
            });
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await processStatusUpdate(status, phoneNumberId, env, orgId);

            results.push({
              message_id: status.id,
              status: 'status_updated',
              new_status: status.status,
            });
          }
        }

        // Log errors
        if (value.errors) {
          for (const error of value.errors) {
            logger.error('[WhatsAppWebhook] Webhook error', {
              code: error.code,
              title: error.title,
              message: error.message,
            });

            results.push({
              status: 'error',
              code: error.code,
              message: error.message,
            });
          }
        }
      }
    }

    // WhatsApp requires 200 OK response within 5 seconds
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('[WhatsAppWebhook] Webhook handler error', error);

    // Still return 200 to prevent WhatsApp from retrying
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Get or create WhatsApp adapter for organization
 */
async function getWhatsAppAdapter(env: Env, orgId: string): Promise<WhatsAppAdapter> {
  // In a real implementation, you would:
  // 1. Fetch channel config from ChannelGateway
  // 2. Create adapter with config
  // 3. Cache adapter instance

  // For now, create a simple config from environment variables
  const config = {
    id: `whatsapp-${orgId}`,
    orgId,
    channelType: 'whatsapp' as const,
    accountId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    enabled: true,
    dmPolicy: 'pairing' as const,
    groupPolicy: 'allowlist' as const,
    textChunkLimit: 4000,
    chunkMode: 'newline' as const,
    sendReadReceipts: true,
    settings: {
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const adapter = new WhatsAppAdapter(config);
  await adapter.connect();

  return adapter;
}
