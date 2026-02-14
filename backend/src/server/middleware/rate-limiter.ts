/**
 * Rate Limiting Middleware
 *
 * Protects webhook endpoints from abuse using Durable Objects Alarms.
 * Implements sliding window rate limiting with automatic reset.
 */

import { DurableObject } from 'cloudflare:workers';
import { createLogger } from '../utils/logger';

const logger = createLogger('RateLimiter');

/**
 * Rate Limiter Durable Object
 *
 * Each instance tracks requests for a specific IP address or client ID.
 * Uses Durable Objects Alarms to automatically reset counters.
 */
export class RateLimiterDO extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Create requests table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        endpoint TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create config table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Index for fast lookups
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp DESC)
    `);
  }

  /**
   * Check if request should be rate limited
   *
   * @param request - Request object with client_id and optional endpoint
   * @returns Response with allow/deny decision
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/check') {
      return this.checkRateLimit(request);
    } else if (url.pathname === '/reset') {
      return this.resetRateLimit();
    } else if (url.pathname === '/stats') {
      return this.getStats();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Check if client is within rate limit
   */
  private async checkRateLimit(request: Request): Promise<Response> {
    const body = await request.json<{
      clientId: string;
      endpoint?: string;
      limit?: number;
      windowSeconds?: number;
    }>();

    const {
      clientId,
      endpoint,
      limit = 100, // Default: 100 requests
      windowSeconds = 60, // Default: per minute
    } = body;

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Count requests in current window
    const result = this.sql.exec(`
      SELECT COUNT(*) as count
      FROM requests
      WHERE client_id = ?
        AND timestamp >= ?
    `, clientId, windowStart).toArray()[0] as any;

    const currentCount = result.count || 0;

    // Check if over limit
    if (currentCount >= limit) {
      const oldestRequest = this.sql.exec(`
        SELECT timestamp
        FROM requests
        WHERE client_id = ?
        ORDER BY timestamp ASC
        LIMIT 1
      `, clientId).toArray()[0] as any;

      const retryAfter = oldestRequest
        ? Math.ceil((oldestRequest.timestamp + windowSeconds * 1000 - now) / 1000)
        : windowSeconds;

      logger.warn('[RateLimiter] Rate limit exceeded', {
        clientId,
        currentCount,
        limit,
        retryAfter,
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          limit,
          remaining: 0,
          resetAt: now + retryAfter * 1000,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(now + retryAfter * 1000).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // Record this request
    this.sql.exec(`
      INSERT INTO requests (client_id, timestamp, endpoint)
      VALUES (?, ?, ?)
    `, clientId, now, endpoint || 'unknown');

    // Set alarm to clean up old requests
    const alarmTime = now + windowSeconds * 1000;
    await this.ctx.storage.setAlarm(alarmTime);

    const remaining = limit - currentCount - 1;

    logger.info('[RateLimiter] Request allowed', {
      clientId,
      currentCount: currentCount + 1,
      remaining,
    });

    return new Response(
      JSON.stringify({
        allowed: true,
        limit,
        remaining,
        resetAt: alarmTime,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(alarmTime).toISOString(),
        },
      }
    );
  }

  /**
   * Reset rate limit for a client (admin function)
   */
  private async resetRateLimit(): Promise<Response> {
    this.sql.exec('DELETE FROM requests');

    logger.info('[RateLimiter] Rate limits reset');

    return new Response(
      JSON.stringify({ success: true, message: 'Rate limits reset' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get rate limiter statistics
   */
  private async getStats(): Promise<Response> {
    const stats = this.sql.exec(`
      SELECT
        client_id,
        COUNT(*) as request_count,
        MAX(timestamp) as last_request,
        MIN(timestamp) as first_request
      FROM requests
      GROUP BY client_id
      ORDER BY request_count DESC
    `).toArray();

    return new Response(JSON.stringify({ stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Alarm handler - clean up old requests
   */
  async alarm(): Promise<void> {
    const cutoff = Date.now() - 60 * 1000; // Keep last 60 seconds

    this.sql.exec(`
      DELETE FROM requests
      WHERE timestamp < ?
    `, cutoff);

    logger.info('[RateLimiter] Cleaned up old requests');
  }
}

/**
 * Rate limiter middleware function
 *
 * Use this in your webhook handlers to check rate limits.
 *
 * @param env - Cloudflare environment
 * @param clientId - Client identifier (usually IP address)
 * @param endpoint - Optional endpoint name for tracking
 * @param limit - Maximum requests (default: 100)
 * @param windowSeconds - Time window in seconds (default: 60)
 * @returns Promise<{ allowed: boolean; remaining: number; retryAfter?: number }>
 *
 * @example
 * const result = await checkRateLimit(env, clientIP, '/webhooks/facebook');
 * if (!result.allowed) {
 *   return new Response('Rate limit exceeded', { status: 429 });
 * }
 */
export async function checkRateLimit(
  env: any,
  clientId: string,
  endpoint?: string,
  limit: number = 100,
  windowSeconds: number = 60
): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  headers?: Record<string, string>;
}> {
  try {
    // Get or create rate limiter DO for this client
    const doId = env.RATE_LIMITER?.idFromName(clientId);
    if (!doId) {
      logger.warn('[RateLimiter] RATE_LIMITER binding not configured, allowing request');
      return { allowed: true, remaining: limit };
    }

    const rateLimiterDO = env.RATE_LIMITER.get(doId);

    // Check rate limit
    const response = await rateLimiterDO.fetch(
      new Request('https://internal/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, endpoint, limit, windowSeconds }),
      })
    );

    const result = await response.json() as {
      allowed: boolean;
      limit: number;
      remaining: number;
      resetAt?: number;
      retryAfter?: number;
    };

    // Extract headers for passing to response
    const headers: Record<string, string> = {};
    if (response.headers.has('X-RateLimit-Limit')) {
      headers['X-RateLimit-Limit'] = response.headers.get('X-RateLimit-Limit')!;
    }
    if (response.headers.has('X-RateLimit-Remaining')) {
      headers['X-RateLimit-Remaining'] = response.headers.get('X-RateLimit-Remaining')!;
    }
    if (response.headers.has('X-RateLimit-Reset')) {
      headers['X-RateLimit-Reset'] = response.headers.get('X-RateLimit-Reset')!;
    }
    if (response.headers.has('Retry-After')) {
      headers['Retry-After'] = response.headers.get('Retry-After')!;
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfter: result.retryAfter,
      headers,
    };
  } catch (error) {
    logger.error('[RateLimiter] Error checking rate limit', error);
    // On error, allow request (fail open)
    return { allowed: true, remaining: limit };
  }
}

/**
 * Get client identifier from request
 *
 * Uses CF-Connecting-IP header (Cloudflare's real IP) or falls back to request IP.
 *
 * @param request - Request object
 * @returns Client identifier (IP address)
 */
export function getClientId(request: Request): string {
  // Cloudflare provides real IP in CF-Connecting-IP header
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Fallback to X-Real-IP or X-Forwarded-For
  const realIP = request.headers.get('X-Real-IP');
  if (realIP) return realIP;

  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Last resort: use URL (not ideal but prevents crashes)
  return 'unknown';
}

/**
 * Rate limit response helper
 *
 * Creates a 429 response with proper headers.
 *
 * @param retryAfter - Seconds until rate limit resets
 * @returns Response
 */
export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
