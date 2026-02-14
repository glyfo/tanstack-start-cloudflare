/**
 * Webhook Signature Verification Utilities
 *
 * Provides secure webhook signature verification for Meta (Facebook/WhatsApp) and TikTok platforms.
 * Uses Web Crypto API for HMAC-SHA256 verification (Cloudflare Workers compatible).
 */

import { createLogger } from './logger';

const logger = createLogger('WebhookVerification');

/**
 * Verify Meta (Facebook/WhatsApp) webhook signature
 *
 * Meta sends signatures in the format: sha256=<hex_signature>
 * Header: X-Hub-Signature-256
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from X-Hub-Signature-256 header
 * @param appSecret - Facebook App Secret or WhatsApp App Secret
 * @returns Promise<boolean> - True if signature is valid
 *
 * @example
 * const isValid = await verifyMetaSignature(
 *   requestBody,
 *   request.headers.get('X-Hub-Signature-256'),
 *   env.FACEBOOK_APP_SECRET
 * );
 */
export async function verifyMetaSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  try {
    if (!signature || !appSecret) {
      logger.warn('[Meta] Missing signature or app secret');
      return false;
    }

    // Meta signature format: "sha256=<hex>"
    const expectedSignature = signature.replace('sha256=', '');

    // Convert strings to Uint8Array
    const encoder = new TextEncoder();
    const secretData = encoder.encode(appSecret);
    const payloadData = encoder.encode(payload);

    // Import secret as HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      secretData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute HMAC-SHA256
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert to hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    const isValid = constantTimeCompare(computedSignature, expectedSignature);

    if (!isValid) {
      logger.warn('[Meta] Signature verification failed', {
        expectedLength: expectedSignature.length,
        computedLength: computedSignature.length,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('[Meta] Signature verification error', error);
    return false;
  }
}

/**
 * Verify TikTok webhook signature
 *
 * TikTok sends signatures as base64-encoded HMAC-SHA256
 * Header: X-TikTok-Signature
 *
 * @param payload - Raw request body as string
 * @param signature - Base64-encoded signature from X-TikTok-Signature header
 * @param secret - TikTok webhook secret
 * @returns Promise<boolean> - True if signature is valid
 *
 * @example
 * const isValid = await verifyTikTokSignature(
 *   requestBody,
 *   request.headers.get('X-TikTok-Signature'),
 *   env.TIKTOK_WEBHOOK_SECRET
 * );
 */
export async function verifyTikTokSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    if (!signature || !secret) {
      logger.warn('[TikTok] Missing signature or secret');
      return false;
    }

    // Convert strings to Uint8Array
    const encoder = new TextEncoder();
    const secretData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    // Import secret as HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      secretData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute HMAC-SHA256
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert to base64
    const computedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer))
    );

    // Constant-time comparison
    const isValid = constantTimeCompare(computedSignature, signature);

    if (!isValid) {
      logger.warn('[TikTok] Signature verification failed', {
        expectedLength: signature.length,
        computedLength: computedSignature.length,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('[TikTok] Signature verification error', error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns boolean - True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  // Different lengths = not equal (but still compare to prevent timing analysis)
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    let result = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }

  // Compare each character with XOR (constant time)
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Verify webhook signature for any platform
 *
 * @param platform - Platform name ('facebook', 'whatsapp', 'tiktok')
 * @param payload - Raw request body
 * @param signature - Signature from header
 * @param secret - Platform secret
 * @returns Promise<boolean> - True if valid
 */
export async function verifyWebhookSignature(
  platform: 'facebook' | 'whatsapp' | 'tiktok',
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  switch (platform) {
    case 'facebook':
    case 'whatsapp':
      return verifyMetaSignature(payload, signature, secret);
    case 'tiktok':
      return verifyTikTokSignature(payload, signature, secret);
    default:
      logger.error(`[WebhookVerification] Unknown platform: ${platform}`);
      return false;
  }
}

/**
 * Extract signature from request headers
 *
 * @param request - Request object
 * @param platform - Platform name
 * @returns string - Signature or empty string
 */
export function extractSignature(
  request: Request,
  platform: 'facebook' | 'whatsapp' | 'tiktok'
): string {
  switch (platform) {
    case 'facebook':
    case 'whatsapp':
      return (
        request.headers.get('X-Hub-Signature-256') ||
        request.headers.get('x-hub-signature-256') ||
        ''
      );
    case 'tiktok':
      return (
        request.headers.get('X-TikTok-Signature') ||
        request.headers.get('x-tiktok-signature') ||
        ''
      );
    default:
      return '';
  }
}
