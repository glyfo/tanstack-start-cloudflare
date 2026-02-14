# Social Media Integration Best Practices

## 📋 Overview

This guide covers best practices for integrating Meta Facebook Lead Ads, WhatsApp Business API, and TikTok Lead Generation with your Cloudflare-based CRM. These patterns ensure security, reliability, and scalability.

---

## 🔐 Security Best Practices

### 1. Webhook Signature Verification

**Always verify webhook signatures** before processing any payload. Each platform uses HMAC-SHA256.

#### Meta (Facebook/WhatsApp)
```typescript
import { createHmac } from 'crypto';

export async function verifyMetaSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  // Meta sends: X-Hub-Signature-256: sha256=<signature>
  const expectedSignature = signature.replace('sha256=', '');

  // Create HMAC using Web Crypto API (Cloudflare compatible)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === expectedSignature;
}
```

#### TikTok
```typescript
export async function verifyTikTokSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // TikTok sends base64(hmac-sha256(payload, secret))
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  // Convert to base64
  const base64Signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  return base64Signature === signature;
}
```

**🚨 Security Rules:**
- ✅ Reject any request with missing or invalid signature
- ✅ Use constant-time comparison to prevent timing attacks
- ✅ Rotate secrets regularly (every 90 days)
- ✅ Store secrets in Cloudflare environment variables, never in code
- ❌ Never log secrets or signatures
- ❌ Never skip verification in "dev mode"

---

### 2. Token Management

#### Access Token Lifecycle
```typescript
interface TokenManager {
  // Store in KV with expiration
  async getToken(platform: 'facebook' | 'whatsapp' | 'tiktok'): Promise<string | null>;
  async refreshToken(platform: string): Promise<string>;
  async revokeToken(platform: string): Promise<void>;
}

// Example implementation
export async function getAccessToken(env: Env, platform: string): Promise<string> {
  const key = `token:${platform}`;

  // Check KV cache first
  let token = await env.TOKENS_KV.get(key);

  if (!token) {
    // Fetch from environment variable (production)
    token = env[`${platform.toUpperCase()}_ACCESS_TOKEN`];

    // Cache with 1 hour TTL
    if (token) {
      await env.TOKENS_KV.put(key, token, { expirationTtl: 3600 });
    }
  }

  return token || '';
}
```

**🔑 Token Best Practices:**
- ✅ Use Page Access Tokens (not User tokens) for better rate limits
- ✅ Request minimal permissions/scopes
- ✅ Cache tokens in KV with appropriate TTL
- ✅ Monitor token expiration and alert 7 days before
- ✅ Implement automatic token refresh where supported
- ❌ Never commit tokens to version control
- ❌ Never log tokens in production
- ❌ Never share tokens across environments

---

### 3. Rate Limiting

Protect your webhook endpoints from abuse and respect platform rate limits.

```typescript
export class WebhookRateLimiter extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const clientId = request.headers.get('X-Real-IP') || 'unknown';
    const key = `rate:${clientId}`;

    // Get current count
    const count = (await this.ctx.storage.get<number>(key)) || 0;

    // Limit: 100 requests per minute
    if (count >= 100) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Increment counter
    await this.ctx.storage.put(key, count + 1);

    // Set alarm to reset counter after 60 seconds
    await this.ctx.storage.setAlarm(Date.now() + 60000);

    return new Response('OK');
  }

  async alarm(): Promise<void> {
    // Reset all rate limit counters
    await this.ctx.storage.deleteAll();
  }
}
```

**⚡ Rate Limit Strategy:**
- ✅ Platform webhooks: 100 requests/minute per IP
- ✅ API calls to platforms: Respect published rate limits
  - Facebook: 200 calls/hour per user token
  - WhatsApp: 1000 messages per 24 hours (varies by tier)
  - TikTok: 10,000 calls/day per app
- ✅ Implement exponential backoff for retries
- ✅ Queue requests during rate limit windows
- ❌ Never hammer APIs when rate limited

---

## 📊 Data Management Best Practices

### 1. Deduplication Strategy

Prevent duplicate leads from multiple webhook deliveries or cross-platform submissions.

```typescript
interface DeduplicationService {
  async checkDuplicate(
    email: string,
    phone: string,
    platform: string
  ): Promise<{ isDuplicate: boolean; existingLeadId?: string }>;
}

export async function checkForDuplicate(
  env: Env,
  email?: string,
  phone?: string,
  platform?: string
): Promise<{ isDuplicate: boolean; existingLeadId?: string }> {
  // Normalize inputs
  const normalizedEmail = email?.toLowerCase().trim();
  const normalizedPhone = phone?.replace(/\D/g, ''); // Remove non-digits

  if (!normalizedEmail && !normalizedPhone) {
    return { isDuplicate: false };
  }

  // Check KV for existing lead
  const keys = [];
  if (normalizedEmail) keys.push(`lead:email:${normalizedEmail}`);
  if (normalizedPhone) keys.push(`lead:phone:${normalizedPhone}`);

  for (const key of keys) {
    const existingLeadId = await env.LEADS_KV.get(key);
    if (existingLeadId) {
      return { isDuplicate: true, existingLeadId };
    }
  }

  // Not a duplicate - store for future checks
  const leadId = crypto.randomUUID();
  const ttl = 30 * 24 * 60 * 60; // 30 days

  if (normalizedEmail) {
    await env.LEADS_KV.put(`lead:email:${normalizedEmail}`, leadId, { expirationTtl: ttl });
  }
  if (normalizedPhone) {
    await env.LEADS_KV.put(`lead:phone:${normalizedPhone}`, leadId, { expirationTtl: ttl });
  }

  return { isDuplicate: false };
}
```

**🔍 Deduplication Rules:**
- ✅ Use normalized email (lowercase, trimmed) as primary key
- ✅ Use normalized phone (digits only, country code included) as secondary key
- ✅ Check across all platforms, not just within one
- ✅ Store deduplication records with 30-day TTL
- ✅ Log duplicate events for analytics
- ❌ Never silently drop duplicates without logging
- ❌ Don't deduplicate too aggressively (allow intentional re-submissions)

---

### 2. Data Storage Patterns

#### Lead Data Storage (Durable Object)
```typescript
export class LeadDO {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState) {
    this.sql = ctx.storage.sql;
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS lead (
        id TEXT PRIMARY KEY DEFAULT 'current',
        platform TEXT NOT NULL,
        external_id TEXT NOT NULL,

        -- Contact Info
        email TEXT,
        phone TEXT,
        name TEXT,
        company TEXT,

        -- Status
        status TEXT DEFAULT 'new',
        qualification_score INTEGER DEFAULT 0,

        -- Source Attribution
        source_campaign_id TEXT,
        source_campaign_name TEXT,
        source_ad_id TEXT,
        source_creative_id TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,

        -- Timestamps
        platform_created_at INTEGER,
        received_at INTEGER NOT NULL,
        processed_at INTEGER,

        -- Metadata
        raw_payload TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Indexes for deduplication and search
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_email ON lead(email) WHERE email IS NOT NULL
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_phone ON lead(phone) WHERE phone IS NOT NULL
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_platform_external
      ON lead(platform, external_id)
    `);
  }
}
```

**💾 Storage Best Practices:**
- ✅ One Durable Object per lead (isolated state)
- ✅ Store raw webhook payload for debugging
- ✅ Index email and phone for fast deduplication
- ✅ Use ISO timestamp for platform_created_at
- ✅ Store source attribution for ROI tracking
- ❌ Don't store unnecessary data (GDPR compliance)
- ❌ Avoid storing PII in logs or analytics

---

### 3. Error Handling & Retry Logic

```typescript
export async function processWebhookWithRetry<T>(
  handler: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await handler();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors
      if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));

      console.warn(`[Webhook] Retry ${attempt}/${maxRetries}`, {
        error: error.message
      });
    }
  }

  throw lastError;
}
```

**🔄 Error Handling Rules:**
- ✅ Retry transient errors (network, timeout, 5xx)
- ✅ Use exponential backoff (1s, 2s, 4s, 8s)
- ✅ Max 3 retries for webhook processing
- ✅ Log all errors with context
- ✅ Return 200 to platform after successful storage (even if downstream fails)
- ❌ Don't retry validation errors (400, 401, 403)
- ❌ Don't retry with same parameters if business logic failed
- ❌ Never infinite retry loop

---

## 🚀 Performance Best Practices

### 1. Webhook Response Time

**Target: <500ms response time**

```typescript
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Verify signature (fast)
    const signature = request.headers.get('X-Hub-Signature-256') || '';
    const body = await request.text();
    const isValid = await verifySignature(body, signature, env.APP_SECRET);

    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    // 2. Parse and validate (fast)
    const payload = JSON.parse(body);

    // 3. Store in Durable Object (async, no wait)
    const leadId = env.LEAD_DO.idFromName(payload.leadId);
    const leadDO = env.LEAD_DO.get(leadId);

    // Fire and forget - don't await
    leadDO.fetch(new Request('https://internal/store', {
      method: 'POST',
      body: JSON.stringify(payload)
    }));

    // 4. Return success immediately
    const responseTime = Date.now() - startTime;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('[Webhook] Error', { error, responseTime });
    return new Response('Internal error', { status: 500 });
  }
}
```

**⚡ Performance Tips:**
- ✅ Return 200 OK as quickly as possible
- ✅ Process heavy operations asynchronously
- ✅ Use Durable Objects for fast state access
- ✅ Cache frequently accessed data in KV
- ✅ Minimize external API calls in webhook handler
- ❌ Don't wait for AI processing before responding
- ❌ Don't make synchronous calls to external APIs
- ❌ Avoid complex business logic in webhook handler

---

### 2. Batch Processing

For platforms that support it, use batch APIs:

```typescript
// Facebook Graph API batch request
export async function fetchLeadsBatch(
  env: Env,
  leadIds: string[]
): Promise<LeadData[]> {
  const batchRequests = leadIds.map((id, index) => ({
    method: 'GET',
    relative_url: `/${id}?fields=id,created_time,field_data`,
    name: `lead_${index}`
  }));

  const response = await fetch('https://graph.facebook.com/v18.0/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.FACEBOOK_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ batch: batchRequests })
  });

  const results = await response.json();
  return results.map(r => JSON.parse(r.body));
}
```

**📦 Batching Strategy:**
- ✅ Batch up to 50 API calls per request (Meta limit)
- ✅ Use batch APIs for initial lead sync
- ✅ Process webhook events individually for low latency
- ✅ Implement queue for batch processing of non-urgent tasks

---

## 🎯 Platform-Specific Best Practices

### Meta Facebook Lead Ads

#### 1. Page Access Tokens
```typescript
// Get long-lived Page access token
async function getPageAccessToken(
  userToken: string,
  pageId: string
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${userToken}`
  );

  const data = await response.json();
  return data.access_token;
}
```

**📱 Facebook Best Practices:**
- ✅ Use Page tokens (not User tokens) for better rate limits
- ✅ Subscribe to `leadgen` webhook for real-time leads
- ✅ Implement Facebook Conversions API for optimization
- ✅ Request minimal permissions: `leads_retrieval`, `pages_manage_ads`
- ✅ Store lead form structure to map custom fields
- ❌ Never use short-lived tokens in production
- ❌ Don't poll for leads (use webhooks)

#### 2. Webhook Verification
```typescript
// Facebook webhook verification endpoint
export async function verifyFacebookWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.FACEBOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verification failed', { status: 403 });
}
```

**✅ Verification Requirements:**
- Respond to GET request with `hub.challenge` value
- Verify `hub.verify_token` matches your stored token
- Return challenge as plain text (not JSON)
- Respond within 5 seconds

---

### WhatsApp Business API

#### 1. Message Templates
```typescript
// Send WhatsApp template message
export async function sendTemplateMessage(
  env: Env,
  to: string,
  templateName: string,
  parameters: string[]
): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: parameters.map(text => ({ type: 'text', text }))
            }
          ]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.statusText}`);
  }
}
```

**💬 WhatsApp Best Practices:**
- ✅ Use templates for initial outreach (24-hour window doesn't apply)
- ✅ Get templates pre-approved before use
- ✅ Include clear opt-out instructions
- ✅ Mark messages as read to improve user experience
- ✅ Handle media messages (images, documents, audio)
- ❌ Don't send promotional messages without opt-in
- ❌ Never spam users (follow WhatsApp Commerce Policy)
- ❌ Don't exceed messaging limits (varies by tier)

#### 2. 24-Hour Window Policy
```typescript
export async function canSendMessage(
  env: Env,
  conversationId: string
): Promise<boolean> {
  const lastInboundKey = `last_inbound:${conversationId}`;
  const lastInboundTime = await env.CONVERSATIONS_KV.get(lastInboundKey);

  if (!lastInboundTime) {
    return false; // No inbound message, can't send free-form
  }

  const hoursSinceLastInbound = (Date.now() - parseInt(lastInboundTime)) / (1000 * 60 * 60);
  return hoursSinceLastInbound < 24;
}
```

**⏰ 24-Hour Window Rules:**
- ✅ Track last inbound message timestamp per conversation
- ✅ Allow free-form messages within 24 hours
- ✅ Use templates outside 24-hour window
- ✅ Consider user time zone for template sending

---

### TikTok Lead Generation

#### 1. Form Field Mapping
```typescript
export interface TikTokFormField {
  field_name: string;
  field_value: string;
}

export function mapTikTokFields(fields: TikTokFormField[]): ContactData {
  const contact: Partial<ContactData> = {};

  for (const field of fields) {
    const name = field.field_name.toLowerCase();

    // Standard fields
    if (name.includes('email')) contact.email = field.field_value;
    else if (name.includes('phone')) contact.phone = field.field_value;
    else if (name.includes('full_name') || name === 'name') contact.name = field.field_value;

    // Custom fields - store in metadata
    else {
      contact.customFields = contact.customFields || {};
      contact.customFields[field.field_name] = field.field_value;
    }
  }

  return contact as ContactData;
}
```

**🎵 TikTok Best Practices:**
- ✅ Map standard fields (name, email, phone) automatically
- ✅ Store custom fields in metadata for flexibility
- ✅ Track video/campaign/creative IDs for attribution
- ✅ Consider TikTok user demographics in lead scoring
- ✅ Test forms before launching campaigns
- ❌ Don't assume field names (they vary by form)
- ❌ Don't ignore custom fields (they often have business logic)

---

## 📈 Monitoring & Observability

### 1. Logging Best Practices

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('FacebookWebhook');

export async function handleFacebookWebhook(request: Request, env: Env) {
  const startTime = Date.now();

  try {
    logger.info('[Webhook] Received', {
      platform: 'facebook',
      headers: Object.fromEntries(request.headers)
    });

    // Process webhook...

    logger.info('[Webhook] Processed successfully', {
      platform: 'facebook',
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error('[Webhook] Failed', {
      platform: 'facebook',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    throw error;
  }
}
```

**📊 What to Log:**
- ✅ All webhook events (with sanitized payloads)
- ✅ Processing duration
- ✅ API call results (success/failure)
- ✅ Deduplication events
- ✅ Rate limit hits
- ❌ Never log access tokens or secrets
- ❌ Never log full PII in production
- ❌ Don't log at DEBUG level in production (performance)

---

### 2. Metrics to Track

```typescript
interface WebhookMetrics {
  // Volume
  webhooksReceived: number;
  leadsCreated: number;
  leadsDuplicated: number;

  // Performance
  averageProcessingTime: number;
  p95ProcessingTime: number;

  // Errors
  signatureVerificationFailures: number;
  processingErrors: number;

  // Business
  leadsByPlatform: Record<string, number>;
  leadsBySource: Record<string, number>;
  conversionRate: number;
}

export async function trackMetric(
  env: Env,
  metric: string,
  value: number,
  tags: Record<string, string> = {}
): Promise<void> {
  const key = `metrics:${metric}:${new Date().toISOString().split('T')[0]}`;
  const tagStr = Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(',');

  // Store in KV with daily aggregation
  const current = await env.METRICS_KV.get<number>(key) || 0;
  await env.METRICS_KV.put(key, (current + value).toString(), {
    expirationTtl: 30 * 24 * 60 * 60 // 30 days
  });
}
```

**📊 Monitoring Strategy:**
- ✅ Track webhook success/failure rate
- ✅ Monitor API quota usage
- ✅ Alert on error spikes (>5% error rate)
- ✅ Dashboard for real-time lead volume
- ✅ Track end-to-end latency (webhook to CRM)

---

## 🧪 Testing Best Practices

### 1. Webhook Testing

```typescript
// Test script: scripts/test-webhook.sh
export async function sendTestWebhook(
  platform: 'facebook' | 'whatsapp' | 'tiktok',
  payload: any
): Promise<void> {
  const webhookUrl = `http://localhost:3000/webhooks/${platform}`;

  // Generate test signature
  const signature = await generateTestSignature(platform, payload);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
      'X-Test-Mode': 'true'
    },
    body: JSON.stringify(payload)
  });

  console.log('Response:', response.status, await response.text());
}
```

**🧪 Testing Checklist:**
- ✅ Test valid webhook payloads
- ✅ Test invalid signatures
- ✅ Test malformed payloads
- ✅ Test duplicate webhooks
- ✅ Test rate limiting
- ✅ Test error recovery
- ✅ Load test (100 concurrent webhooks)

---

## 🔗 Quick Reference Links

### Meta Platform APIs
- [Facebook Lead Ads API Essentials](https://rollout.com/integration-guides/facebook-lead-ads/api-essentials)
- [WhatsApp Cloud API Guide 2026](https://chatarmin.com/en/blog/whatsapp-cloudapi)
- [Meta Webhook Security](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)

### Platform Documentation
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [WhatsApp Business Platform](https://business.whatsapp.com/products/business-platform)
- [TikTok Lead Generation API](https://business-api.tiktok.com/portal/docs?id=1747719780398082)

### Cloudflare Resources
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Workers KV Documentation](https://developers.cloudflare.com/kv/)
- [Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

---

## ✅ Checklist for Production Launch

### Pre-Launch
- [ ] All webhook signatures verified
- [ ] Access tokens configured in production
- [ ] Rate limiting implemented
- [ ] Deduplication tested
- [ ] Error alerting configured
- [ ] Monitoring dashboard live
- [ ] Load testing completed
- [ ] Documentation reviewed
- [ ] Security audit passed

### Post-Launch
- [ ] Monitor error rates (first 24 hours)
- [ ] Verify lead flow end-to-end
- [ ] Check API quota usage
- [ ] Review webhook response times
- [ ] Test failover scenarios
- [ ] Document any issues

---

*Last Updated: 2026-01-19*
*For implementation details, see: [CRM_MVP_SOCIAL_MEDIA_TODO.md](../CRM_MVP_SOCIAL_MEDIA_TODO.md)*
