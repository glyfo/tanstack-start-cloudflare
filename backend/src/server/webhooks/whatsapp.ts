/**
 * WhatsApp Business API Webhook Handler
 *
 * Handles incoming messages and status updates from WhatsApp Cloud API
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 *
 * Multi-tenant: Uses org-scoped DO keys for data isolation
 */

import { createLogger } from '../utils/logger';
import { checkRateLimit, getClientId, rateLimitResponse } from '../middleware/rate-limiter';
import { verifyMetaSignature } from '../utils/webhook-verification';
import { parseWhatsAppMessage, type WhatsAppMessage } from '../services/whatsapp-message-parser';
import { getOrgIdForWebhook, scopedKey } from '../utils/webhook-routing';

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
 * Process incoming WhatsApp message
 * Multi-tenant: All DOs are scoped by orgId
 */
export async function processWhatsAppMessage(
  message: WhatsAppMessage,
  contact: WhatsAppContact,
  phoneNumberId: string,
  env: any,
  orgId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const waId = contact.wa_id;
    const contactName = contact.profile.name;
    // Org-scoped key for multi-tenant isolation
    const scopedWaId = scopedKey(orgId, waId);

    logger.info('[WhatsAppWebhook] Processing message', {
      waId,
      orgId,
      scopedWaId,
      messageId: message.id,
      type: message.type,
      from: message.from,
    });

    // Parse message content
    const parsedMessage = parseWhatsAppMessage(message);

    // Get or create WhatsAppConversationDO (org-scoped)
    const conversationId = env.WHATSAPP_CONVERSATION.idFromName(scopedWaId);
    const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

    // Store message in conversation
    await conversationDO.fetch(
      new Request('https://internal/addMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          from: message.from,
          timestamp: message.timestamp,
          type: message.type,
          content: parsedMessage.content,
          metadata: parsedMessage.metadata,
          contactName,
          phoneNumberId,
        }),
      })
    );

    // Get conversation state
    const stateResponse = await conversationDO.fetch(
      new Request('https://internal/getState', { method: 'GET' })
    );
    const conversationState = await stateResponse.json();

    // Check if within 24-hour messaging window
    const lastInboundTime = new Date(conversationState.lastInboundMessageTime).getTime();
    const now = Date.now();
    const withinWindow = now - lastInboundTime < 24 * 60 * 60 * 1000;

    logger.info('[WhatsAppWebhook] Conversation state', {
      waId,
      messageCount: conversationState.messageCount,
      withinWindow,
    });

    // Route to ChatAgent for AI response
    // Only auto-respond if within 24-hour window
    if (withinWindow && parsedMessage.content) {
      // Get or create ChatAgent for this WhatsApp conversation (org-scoped)
      const sessionId = scopedKey(orgId, `whatsapp-${waId}`);
      const agentId = env.CHAT_AGENT.idFromName(sessionId);
      const chatAgent = env.CHAT_AGENT.get(agentId);

      // Send message to agent
      await chatAgent.fetch(
        new Request('https://internal/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: parsedMessage.content,
            metadata: {
              source: 'whatsapp',
              waId,
              contactName,
              phoneNumberId,
              messageType: message.type,
            },
          }),
        })
      );

      logger.info('[WhatsAppWebhook] Message routed to ChatAgent', {
        waId,
        sessionId,
      });
    } else if (!withinWindow) {
      logger.warn('[WhatsAppWebhook] Outside 24-hour window, cannot auto-respond', {
        waId,
        lastInboundTime: new Date(lastInboundTime).toISOString(),
      });
    }

    return { success: true };
  } catch (error) {
    logger.error('[WhatsAppWebhook] Error processing message', error);
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
