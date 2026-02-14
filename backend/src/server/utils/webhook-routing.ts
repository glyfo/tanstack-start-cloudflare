/**
 * Webhook Organization Routing
 *
 * Maps platform account IDs (page_id, phone_number_id) to organization IDs
 * for multi-tenant webhook routing.
 *
 * Storage: Uses KV for fast lookups
 * Format: webhook:platform:accountId -> orgId
 */

import { createLogger } from './logger';

const logger = createLogger('WebhookRouting');

export type WebhookPlatform = 'tiktok' | 'facebook' | 'whatsapp' | 'instagram';

/**
 * Get organization ID for a webhook based on platform account
 */
export async function getOrgIdForWebhook(
  env: any,
  platform: WebhookPlatform,
  accountId: string
): Promise<string | null> {
  if (!env.WEBHOOK_ROUTING_KV) {
    logger.warn('[WebhookRouting] WEBHOOK_ROUTING_KV not configured, using default org');
    return env.DEFAULT_WEBHOOK_ORG || null;
  }

  try {
    const key = `webhook:${platform}:${accountId}`;
    const orgId = await env.WEBHOOK_ROUTING_KV.get(key);

    if (orgId) {
      logger.info('[WebhookRouting] Found org for webhook', { platform, accountId, orgId });
      return orgId;
    }

    // Fallback to default org if configured
    if (env.DEFAULT_WEBHOOK_ORG) {
      logger.info('[WebhookRouting] Using default org for webhook', {
        platform,
        accountId,
        orgId: env.DEFAULT_WEBHOOK_ORG
      });
      return env.DEFAULT_WEBHOOK_ORG;
    }

    logger.warn('[WebhookRouting] No org found for webhook', { platform, accountId });
    return null;
  } catch (error) {
    logger.error('[WebhookRouting] Error looking up org', { error });
    return env.DEFAULT_WEBHOOK_ORG || null;
  }
}

/**
 * Register a platform account for an organization
 * Called when OAuth connection is established
 */
export async function registerWebhookRoute(
  env: any,
  platform: WebhookPlatform,
  accountId: string,
  orgId: string
): Promise<void> {
  if (!env.WEBHOOK_ROUTING_KV) {
    logger.warn('[WebhookRouting] WEBHOOK_ROUTING_KV not configured, skipping registration');
    return;
  }

  try {
    const key = `webhook:${platform}:${accountId}`;
    await env.WEBHOOK_ROUTING_KV.put(key, orgId);
    logger.info('[WebhookRouting] Registered webhook route', { platform, accountId, orgId });
  } catch (error) {
    logger.error('[WebhookRouting] Error registering webhook route', { error });
  }
}

/**
 * Unregister a platform account (when disconnecting)
 */
export async function unregisterWebhookRoute(
  env: any,
  platform: WebhookPlatform,
  accountId: string
): Promise<void> {
  if (!env.WEBHOOK_ROUTING_KV) {
    return;
  }

  try {
    const key = `webhook:${platform}:${accountId}`;
    await env.WEBHOOK_ROUTING_KV.delete(key);
    logger.info('[WebhookRouting] Unregistered webhook route', { platform, accountId });
  } catch (error) {
    logger.error('[WebhookRouting] Error unregistering webhook route', { error });
  }
}

/**
 * Generate org-scoped DO key
 * Format: {orgId}:{resourceId}
 */
export function scopedKey(orgId: string, resourceId: string): string {
  return `${orgId}:${resourceId}`;
}

/**
 * Parse org-scoped DO key
 */
export function parseKey(scopedKey: string): { orgId: string; resourceId: string } | null {
  const parts = scopedKey.split(':');
  if (parts.length < 2) return null;
  return {
    orgId: parts[0],
    resourceId: parts.slice(1).join(':'),
  };
}
