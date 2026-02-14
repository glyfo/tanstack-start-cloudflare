# Social Media Integration Architecture

This document describes the architecture of the social media integration system for TikTok, Facebook Lead Ads, Instagram Lead Ads, and WhatsApp Business API.

## Overview

The CRM integrates with three major social media platforms to capture leads and manage conversations:

- **TikTok Lead Generation** - Capture leads from TikTok advertising campaigns
- **Facebook Lead Ads** - Capture leads from Facebook/Instagram lead generation forms
- **Instagram Lead Ads** - Capture leads from Instagram lead forms via Meta webhooks
- **WhatsApp Business API** - Two-way messaging with customers

## Architecture Diagram

```
                              ┌─────────────────┐
                              │  Social Media   │
                              │   Platforms     │
                              └────────┬────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│    TikTok     │  │   Facebook    │  │   Instagram   │  │   WhatsApp    │
│   Webhook     │  │   Webhook     │  │   Webhook     │  │   Webhook     │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        └──────────────┬────┴───────────┬──────┘                 │
                       ▼                ▼                         ▼
             ┌──────────────────────────────────┐        ┌──────────────────┐
             │ Verification + Rate limit +      │        │ WhatsApp message │
             │ idempotency + dedup checks       │        │ processing       │
             └─────────────────┬────────────────┘        └─────────┬────────┘
                               ▼                                   ▼
                    ┌─────────────────────┐               ┌─────────────────────┐
                    │   SOCIAL_HUB_DO     │               │ WhatsAppConversation│
                    │   upsertLead()      │               │ DO + ChatAgent      │
                    └──────────┬──────────┘               └─────────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ LeadQualificationDO │
                    │ + OpportunityDO     │
                    └─────────────────────┘
```

## Components

### Webhook Handlers

Each platform has a dedicated webhook handler in `src/server/webhooks/`:

| File | Purpose |
|------|---------|
| `tiktok.ts` | Handles TikTok Lead Generation webhook events |
| `facebook.ts` | Handles Facebook Lead Ads webhook events |
| `instagram.ts` | Handles Instagram Lead Ads webhook events |
| `whatsapp.ts` | Handles WhatsApp Cloud API webhook events |

### Security Layer

#### Signature Verification (`src/server/utils/webhook-verification.ts`)

All webhook requests are verified using HMAC-SHA256 signatures:

- **Meta (Facebook/WhatsApp)**: `X-Hub-Signature-256` header with `sha256=<hex>` format
- **TikTok**: `X-TikTok-Signature` header with base64-encoded signature

#### Rate Limiting (`src/server/middleware/rate-limiter.ts`)

Rate limiting is implemented using Durable Objects with sliding window algorithm:

| Platform | Default Limit |
|----------|---------------|
| TikTok | 60 req/min |
| Facebook | 100 req/min |
| WhatsApp | 200 req/min |

### Deduplication (`src/server/utils/deduplication.ts`)

Cross-platform deduplication prevents duplicate leads using:

- Email normalization (lowercase, Gmail dot removal)
- Phone normalization (digits only, country code handling)
- KV storage with 30-day TTL

### Webhook Idempotency (`src/server/utils/webhook-idempotency.ts`)

Event-level idempotency prevents duplicate processing from provider retries:

- TikTok uses `event_id`
- Facebook/Instagram use `leadgen_id`
- KV key pattern: `webhook:event:<platform>:<eventId>` (24h TTL)

### Durable Objects

| Durable Object | Purpose |
|----------------|---------|
| `SocialHubDO` | Unified social lead store + contact linkage + webhook event log |
| `WhatsAppConversationDO` | Manages WhatsApp conversation state and message history |
| `LeadQualificationDO` | BANT scoring and lead qualification |
| `OpportunityDO` | Sales opportunity tracking |
| `RateLimiterDO` | Rate limiting state per client |

### Services

| Service | Purpose |
|---------|---------|
| `facebook-api.ts` | Facebook Graph API client for fetching lead data |
| `whatsapp-api.ts` | WhatsApp Cloud API client for sending messages |
| `whatsapp-message-parser.ts` | Parses different WhatsApp message types |
| `unified-lead-service.ts` | Cross-platform lead aggregation and search |
| `lead-analytics.ts` | Analytics tracking and reporting |

## Data Flow

### TikTok Lead Flow

1. User submits lead form on TikTok
2. TikTok sends webhook to `/api/webhooks/tiktok`
3. Verify signature using HMAC-SHA256
4. Check rate limit
5. Check for duplicate by email/phone
6. Idempotency guard checks `event_id`
7. Upsert lead into `SocialHubDO`
8. Create `LeadQualificationDO` with initial BANT data
9. Create `OpportunityDO` linked to qualification
10. Return success response

### Facebook Lead Flow

1. User submits lead form on Facebook/Instagram
2. Facebook sends webhook to `/api/webhooks/facebook`
3. Verify signature using HMAC-SHA256
4. Check rate limit
5. Fetch full lead data from Facebook Graph API
6. Extract contact info and BANT data from fields
7. Check for duplicate
8. Idempotency guard checks `leadgen_id`
9. Upsert lead into `SocialHubDO`
10. Create `LeadQualificationDO` and `OpportunityDO`
11. Return success response

### Instagram Lead Flow

1. User submits lead form on Instagram
2. Meta sends webhook to `/api/webhooks/instagram`
3. Verify signature using HMAC-SHA256
4. Check rate limit
5. Idempotency guard checks `leadgen_id`
6. Fetch full lead data from Graph API
7. Parse contact info and deduplicate
8. Upsert lead into `SocialHubDO`
9. Create opportunity workflow
10. Return `200` (or `202` in async mode)

### WhatsApp Message Flow

1. User sends message via WhatsApp
2. WhatsApp sends webhook to `/api/webhooks/whatsapp`
3. Verify signature using HMAC-SHA256
4. Check rate limit
5. Parse message type (text, media, location, etc.)
6. Get or create `WhatsAppConversationDO`
7. Store message in conversation
8. Check 24-hour messaging window
9. If within window, route to `ChatAgent` for AI response
10. Return success response

## Environment Variables

| Variable | Platform | Purpose |
|----------|----------|---------|
| `TIKTOK_WEBHOOK_SECRET` | TikTok | Webhook signature verification |
| `FACEBOOK_APP_SECRET` | Facebook/WhatsApp | Webhook signature verification |
| `FACEBOOK_VERIFY_TOKEN` | Facebook | Webhook subscription verification |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Facebook | Graph API access |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp | Webhook subscription verification |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp | Cloud API access |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp | Business phone number ID |
| `WEBHOOK_ASYNC_PROCESSING` | TikTok/Facebook/Instagram | Set to `true` for fast `202` ACK + background processing |

## Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health check |
| `GET /health/webhooks` | Webhook configuration status |
| `GET /health/apis` | External API connection status |
| `GET /health/ready` | Readiness probe for Kubernetes |

## Error Handling

- All webhook handlers return appropriate HTTP status codes
- WhatsApp webhook always returns 200 (platform requirement)
- Errors are logged with structured logging
- Failed lead processing doesn't block other leads in batch
- TikTok/Facebook/Instagram can return 202 when async mode is enabled

## Testing

### Unit Tests

Located in `src/server/__tests__/webhooks/`:

- `webhook-verification.test.ts` - Signature verification tests
- `deduplication.test.ts` - Deduplication service tests
- `tiktok.test.ts` - TikTok webhook tests
- `facebook.test.ts` - Facebook webhook tests
- `whatsapp.test.ts` - WhatsApp webhook tests

### Integration Tests

Located in `src/server/__tests__/integration/`:

- `social-media.test.ts` - End-to-end lead capture flow tests

### Manual Testing Scripts

Located in `scripts/`:

- `test-tiktok-webhook.js` - Send test TikTok webhook
- `test-facebook-webhook.js` - Send test Facebook webhook
- `test-whatsapp-webhook.js` - Send test WhatsApp webhook
