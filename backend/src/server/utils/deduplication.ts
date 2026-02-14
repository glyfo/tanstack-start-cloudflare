/**
 * Lead Deduplication Service
 *
 * Prevents duplicate leads from multiple webhook deliveries or cross-platform submissions.
 * Uses Cloudflare KV for fast lookups with 30-day TTL.
 */

import { createLogger } from './logger';

const logger = createLogger('Deduplication');

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingLeadId?: string;
  matchedOn?: 'email' | 'phone' | 'both';
}

/**
 * Check if a lead is a duplicate based on email and/or phone
 *
 * @param env - Cloudflare environment with KV namespace
 * @param email - Lead email address (optional)
 * @param phone - Lead phone number (optional)
 * @param platform - Source platform ('tiktok', 'facebook', 'whatsapp')
 * @returns DeduplicationResult
 *
 * @example
 * const result = await checkForDuplicate(
 *   env,
 *   'john@example.com',
 *   '+15551234567',
 *   'facebook'
 * );
 * if (result.isDuplicate) {
 *   console.log(`Duplicate of lead: ${result.existingLeadId}`);
 * }
 */
export async function checkForDuplicate(
  env: any,
  email?: string,
  phone?: string,
  platform?: string,
  orgId?: string
): Promise<DeduplicationResult> {
  // Normalize inputs
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    logger.warn('[Dedup] No email or phone provided');
    return { isDuplicate: false };
  }

  // Check if KV namespace is available
  if (!env.LEADS_KV) {
    logger.warn('[Dedup] LEADS_KV namespace not configured, skipping deduplication');
    return { isDuplicate: false };
  }

  try {
    // Check for existing lead by email
    if (normalizedEmail) {
      const emailKey = getDedupKey('email', normalizedEmail, orgId);
      const existingLeadId = await env.LEADS_KV.get(emailKey);

      if (existingLeadId) {
        logger.info('[Dedup] Found duplicate by email', {
          email: normalizedEmail,
          existingLeadId,
          platform,
        });
        return {
          isDuplicate: true,
          existingLeadId,
          matchedOn: 'email',
        };
      }
    }

    // Check for existing lead by phone
    if (normalizedPhone) {
      const phoneKey = getDedupKey('phone', normalizedPhone, orgId);
      const existingLeadId = await env.LEADS_KV.get(phoneKey);

      if (existingLeadId) {
        logger.info('[Dedup] Found duplicate by phone', {
          phone: normalizedPhone,
          existingLeadId,
          platform,
        });
        return {
          isDuplicate: true,
          existingLeadId,
          matchedOn: 'phone',
        };
      }
    }

    // Not a duplicate
    return { isDuplicate: false };
  } catch (error) {
    logger.error('[Dedup] Error checking for duplicate', error);
    // On error, assume not duplicate to avoid blocking legitimate leads
    return { isDuplicate: false };
  }
}

/**
 * Register a new lead in the deduplication store
 *
 * @param env - Cloudflare environment with KV namespace
 * @param leadId - Unique lead identifier
 * @param email - Lead email address (optional)
 * @param phone - Lead phone number (optional)
 * @param platform - Source platform
 * @returns Promise<void>
 *
 * @example
 * await registerLead(
 *   env,
 *   'lead-abc123',
 *   'john@example.com',
 *   '+15551234567',
 *   'facebook'
 * );
 */
export async function registerLead(
  env: any,
  leadId: string,
  email?: string,
  phone?: string,
  platform?: string,
  orgId?: string
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    logger.warn('[Dedup] No email or phone to register', { leadId });
    return;
  }

  if (!env.LEADS_KV) {
    logger.warn('[Dedup] LEADS_KV namespace not configured, skipping registration');
    return;
  }

  try {
    // 30 days TTL (in seconds)
    const ttl = 30 * 24 * 60 * 60;

    // Register email
    if (normalizedEmail) {
      const emailKey = getDedupKey('email', normalizedEmail, orgId);
      await env.LEADS_KV.put(emailKey, leadId, { expirationTtl: ttl });
      logger.info('[Dedup] Registered lead by email', {
        leadId,
        email: normalizedEmail,
        platform,
      });
    }

    // Register phone
    if (normalizedPhone) {
      const phoneKey = getDedupKey('phone', normalizedPhone, orgId);
      await env.LEADS_KV.put(phoneKey, leadId, { expirationTtl: ttl });
      logger.info('[Dedup] Registered lead by phone', {
        leadId,
        phone: normalizedPhone,
        platform,
      });
    }
  } catch (error) {
    logger.error('[Dedup] Error registering lead', error);
    // Don't throw - registration failure shouldn't block lead processing
  }
}

/**
 * Update lead registration (when merging duplicates)
 *
 * @param env - Cloudflare environment
 * @param oldLeadId - Old lead ID to replace
 * @param newLeadId - New lead ID to use
 * @param email - Lead email
 * @param phone - Lead phone
 * @returns Promise<void>
 */
export async function updateLeadRegistration(
  env: any,
  oldLeadId: string,
  newLeadId: string,
  email?: string,
  phone?: string,
  orgId?: string
): Promise<void> {
  // Simply re-register with new ID (will overwrite)
  await registerLead(env, newLeadId, email, phone, undefined, orgId);
  logger.info('[Dedup] Updated lead registration', { oldLeadId, newLeadId });
}

/**
 * Delete lead from deduplication store
 *
 * @param env - Cloudflare environment
 * @param email - Lead email
 * @param phone - Lead phone
 * @returns Promise<void>
 */
export async function deleteLead(
  env: any,
  email?: string,
  phone?: string,
  orgId?: string
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!env.LEADS_KV) {
    return;
  }

  try {
    if (normalizedEmail) {
      await env.LEADS_KV.delete(getDedupKey('email', normalizedEmail, orgId));
    }
    if (normalizedPhone) {
      await env.LEADS_KV.delete(getDedupKey('phone', normalizedPhone, orgId));
    }
    logger.info('[Dedup] Deleted lead from dedup store', { email, phone });
  } catch (error) {
    logger.error('[Dedup] Error deleting lead', error);
  }
}

/**
 * Normalize email address for consistent matching
 *
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove dots from Gmail addresses (user.name@gmail.com === username@gmail.com)
 *
 * @param email - Email address
 * @returns Normalized email or undefined
 */
export function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;

  let normalized = email.toLowerCase().trim();

  // Gmail-specific normalization (dots are ignored)
  if (normalized.includes('@gmail.com')) {
    const [localPart, domain] = normalized.split('@');
    const withoutDots = localPart.replace(/\./g, '');
    normalized = `${withoutDots}@${domain}`;
  }

  return normalized;
}

/**
 * Normalize phone number for consistent matching
 *
 * - Remove all non-digit characters
 * - Add country code if missing (assumes +1 for US/Canada)
 *
 * @param phone - Phone number
 * @returns Normalized phone or undefined
 */
export function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;

  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');

  // If 10 digits (US/Canada without country code), add +1
  if (normalized.length === 10) {
    normalized = `1${normalized}`;
  }

  // Must have at least 10 digits
  if (normalized.length < 10) {
    logger.warn('[Dedup] Phone number too short', { phone });
    return undefined;
  }

  return normalized;
}

/**
 * Check if two leads are duplicates based on contact info
 *
 * @param lead1 - First lead
 * @param lead2 - Second lead
 * @returns boolean - True if duplicates
 */
export function areDuplicates(
  lead1: { email?: string; phone?: string },
  lead2: { email?: string; phone?: string }
): boolean {
  const email1 = normalizeEmail(lead1.email);
  const email2 = normalizeEmail(lead2.email);
  const phone1 = normalizePhone(lead1.phone);
  const phone2 = normalizePhone(lead2.phone);

  // Match on email
  if (email1 && email2 && email1 === email2) {
    return true;
  }

  // Match on phone
  if (phone1 && phone2 && phone1 === phone2) {
    return true;
  }

  return false;
}

function getDedupKey(
  kind: 'email' | 'phone',
  normalizedValue: string,
  orgId?: string
): string {
  // Keep backward compatibility for existing global dedup data while enabling
  // tenant isolation when orgId is available.
  return orgId
    ? `lead:org:${orgId}:${kind}:${normalizedValue}`
    : `lead:${kind}:${normalizedValue}`;
}
