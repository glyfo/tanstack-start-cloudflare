import { createLogger } from './logger';

const logger = createLogger('WebhookIdempotency');

/**
 * Best-effort webhook idempotency guard.
 * Returns false when an event has already been processed.
 */
export async function checkAndMarkWebhookEvent(
  env: any,
  platform: 'tiktok' | 'facebook' | 'instagram',
  eventId: string | undefined | null,
  ttlSeconds = 24 * 60 * 60
): Promise<boolean> {
  if (!eventId) {
    return true;
  }

  if (!env?.LEADS_KV) {
    return true;
  }

  const eventKey = `webhook:event:${platform}:${eventId}`;

  try {
    const existing = await env.LEADS_KV.get(eventKey);
    if (existing) {
      return false;
    }

    await env.LEADS_KV.put(eventKey, new Date().toISOString(), {
      expirationTtl: ttlSeconds,
    });

    return true;
  } catch (error) {
    logger.warn('Idempotency check failed, allowing processing', {
      platform,
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

