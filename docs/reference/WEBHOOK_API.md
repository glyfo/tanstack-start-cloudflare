# Webhook API Reference

This document describes the webhook endpoints for receiving events from TikTok, Facebook, Instagram, and WhatsApp.

## Processing Guarantees (Phase 3)

- Event idempotency: TikTok (`event_id`) and Meta leads (`leadgen_id`) are guarded against duplicate processing.
- Unified lead ingestion: TikTok/Facebook/Instagram leads are upserted into `SOCIAL_HUB_DO` for 360 visibility.
- Optional async mode: set `WEBHOOK_ASYNC_PROCESSING=true` to return `202` quickly and process in background with `waitUntil`.

When async mode is disabled (default), handlers process synchronously and return `200`.

## TikTok Webhook

### Endpoint

```
POST /api/webhooks/tiktok
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-TikTok-Signature` | Yes | Base64-encoded HMAC-SHA256 signature |

### Request Body

```json
{
  "event": "lead.create",
  "timestamp": 1705766400000,
  "page_id": "page_123456",
  "page_name": "My Business Page",
  "leads": [
    {
      "event_id": "evt_abc123",
      "event_time": 1705766400,
      "event_type": "FORM_SUBMIT",
      "form_id": "form_123",
      "form_name": "Contact Form",
      "ad_id": "ad_456",
      "ad_name": "Summer Campaign Ad",
      "campaign_id": "camp_789",
      "campaign_name": "Summer Campaign",
      "creative_id": "creative_012",
      "page_id": "page_123456",
      "page_name": "My Business Page",
      "user_details": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+15551234567",
        "company": "Acme Inc",
        "city": "San Francisco",
        "state": "CA",
        "country": "US",
        "zip": "94102",
        "custom_fields": {
          "budget": "$10,000-$25,000",
          "timeline": "1-3 months",
          "role": "Marketing Manager"
        }
      }
    }
  ]
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "lead_id": "tiktok-evt_abc123-form_123",
      "status": "success"
    }
  ]
}
```

**Duplicate (200):**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "lead_id": "existing-lead-id",
      "status": "duplicate"
    }
  ]
}
```

**Accepted Async (202, when `WEBHOOK_ASYNC_PROCESSING=true`):**
```json
{
  "success": true,
  "accepted": true,
  "queued": 1
}
```

**Invalid Signature (401):**
```json
{
  "error": "Invalid signature"
}
```

**Rate Limited (429):**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Facebook Webhook

### Verification Endpoint

```
GET /api/webhooks/facebook
```

#### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `hub.mode` | Yes | Must be `subscribe` |
| `hub.verify_token` | Yes | Must match `FACEBOOK_VERIFY_TOKEN` |
| `hub.challenge` | Yes | Challenge string to return |

#### Response

**Success (200):** Returns the challenge string

**Failure (403):** `Forbidden`

### Event Endpoint

```
POST /api/webhooks/facebook
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Hub-Signature-256` | Yes | `sha256=<hex>` HMAC-SHA256 signature |

### Request Body

```json
{
  "object": "page",
  "entry": [
    {
      "id": "page_123456",
      "time": 1705766400000,
      "changes": [
        {
          "field": "leadgen",
          "value": {
            "ad_id": "ad_456",
            "form_id": "form_789",
            "leadgen_id": "lead_012",
            "created_time": 1705766400,
            "page_id": "page_123456",
            "adgroup_id": "adgroup_345"
          }
        }
      ]
    }
  ]
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "leadgen_id": "lead_012",
      "lead_id": "facebook-lead_012-form_789",
      "status": "success"
    }
  ]
}
```

**Accepted Async (202, when `WEBHOOK_ASYNC_PROCESSING=true`):**
```json
{
  "success": true,
  "accepted": true,
  "queued": 1
}
```

**Invalid Signature (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## Instagram Webhook

### Verification Endpoint

```
GET /api/webhooks/instagram
```

#### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `hub.mode` | Yes | Must be `subscribe` |
| `hub.verify_token` | Yes | Must match `INSTAGRAM_VERIFY_TOKEN` (or Facebook fallback) |
| `hub.challenge` | Yes | Challenge string to return |

#### Response

**Success (200):** Returns the challenge string

**Failure (403):** `Forbidden`

### Event Endpoint

```
POST /api/webhooks/instagram
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Hub-Signature-256` | Yes | `sha256=<hex>` HMAC-SHA256 signature |

### Response

**Success (200):**
```text
EVENT_RECEIVED
```

**Accepted Async (202, when `WEBHOOK_ASYNC_PROCESSING=true`):**
```text
EVENT_ACCEPTED
```

**Invalid Signature (401):**
```text
Unauthorized
```

---

## WhatsApp Webhook

### Verification Endpoint

```
GET /api/webhooks/whatsapp
```

#### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `hub.mode` | Yes | Must be `subscribe` |
| `hub.verify_token` | Yes | Must match `WHATSAPP_VERIFY_TOKEN` |
| `hub.challenge` | Yes | Challenge string to return |

#### Response

**Success (200):** Returns the challenge string

**Failure (403):** `Forbidden`

### Event Endpoint

```
POST /api/webhooks/whatsapp
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Hub-Signature-256` | Yes | `sha256=<hex>` HMAC-SHA256 signature |

### Request Body (Message)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "business_123",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+15551234567",
              "phone_number_id": "phone_123"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "15559876543"
              }
            ],
            "messages": [
              {
                "id": "msg_abc123",
                "from": "15559876543",
                "timestamp": "1705766400",
                "type": "text",
                "text": {
                  "body": "Hello, I'm interested in your services"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Request Body (Status Update)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "business_123",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+15551234567",
              "phone_number_id": "phone_123"
            },
            "statuses": [
              {
                "id": "msg_abc123",
                "status": "delivered",
                "timestamp": "1705766500",
                "recipient_id": "15559876543"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Message Types

| Type | Description |
|------|-------------|
| `text` | Plain text message |
| `image` | Image message |
| `video` | Video message |
| `audio` | Audio message |
| `document` | Document file |
| `location` | Location share |
| `contacts` | Contact card |
| `interactive` | Button/list response |
| `reaction` | Message reaction |

### Status Types

| Status | Description |
|--------|-------------|
| `sent` | Message sent to WhatsApp servers |
| `delivered` | Message delivered to recipient device |
| `read` | Message read by recipient |
| `failed` | Message delivery failed |

### Response

**Success (200):**
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "message_id": "msg_abc123",
      "wa_id": "15559876543",
      "status": "processed"
    }
  ]
}
```

**Note:** WhatsApp requires 200 OK response within 5 seconds. Errors return 200 with error info in body.

---

## Health Check Endpoints

### Basic Health

```
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Webhook Status

```
GET /health/webhooks
```

**Response (200):**
```json
{
  "status": "healthy",
  "webhooks": {
    "tiktok": {
      "endpoint": "/api/webhooks/tiktok",
      "status": "active",
      "secretConfigured": true
    },
    "facebook": {
      "endpoint": "/api/webhooks/facebook",
      "status": "active",
      "secretConfigured": true,
      "verifyTokenConfigured": true
    },
    "whatsapp": {
      "endpoint": "/api/webhooks/whatsapp",
      "status": "active",
      "secretConfigured": true,
      "verifyTokenConfigured": true
    }
  },
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

### API Status

```
GET /health/apis
```

**Response (200):**
```json
{
  "status": "healthy",
  "apis": {
    "facebook": {
      "configured": true,
      "appSecretConfigured": true
    },
    "whatsapp": {
      "configured": true,
      "phoneNumberConfigured": true
    },
    "tiktok": {
      "configured": true
    },
    "durableObjects": {
      "chatAgent": true,
      "leadQualification": true,
      "opportunity": true
    },
    "kv": {
      "leadsKV": true,
      "leadIndexKV": true
    },
    "ai": {
      "configured": true
    }
  },
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

### Readiness Check

```
GET /health/ready
```

**Response (200 - Ready):**
```json
{
  "status": "ready",
  "checks": {
    "chatAgent": true,
    "ai": true
  },
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

**Response (503 - Not Ready):**
```json
{
  "status": "not_ready",
  "checks": {
    "chatAgent": false,
    "ai": true
  },
  "timestamp": "2026-01-20T12:00:00.000Z"
}
```

---

## Export Endpoint

### Export Leads

```
GET /api/export/leads
```

#### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `format` | No | `csv` or `json` (default: `json`) |
| `sources` | No | Comma-separated: `tiktok,facebook,whatsapp` |
| `startDate` | No | ISO date string |
| `endDate` | No | ISO date string |
| `limit` | No | Max records (default: 1000) |

#### Response (JSON)

```json
{
  "success": true,
  "count": 25,
  "leads": [
    {
      "id": "tiktok-evt_abc123",
      "source": "tiktok",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+15551234567",
      "company": "Acme Inc",
      "classification": "hot",
      "qualificationScore": 85,
      "campaignName": "Summer Campaign",
      "timestamp": 1705766400000
    }
  ]
}
```

#### Response (CSV)

```csv
Source,Name,Email,Phone,Company,Classification,Score,Campaign,Date
"tiktok","John Doe","john@example.com","+15551234567","Acme Inc","hot","85","Summer Campaign","2026-01-20T12:00:00.000Z"
```

---

## Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Invalid request body or parameters |
| 401 | Invalid or missing signature |
| 403 | Verification failed |
| 405 | Method not allowed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Signature Verification

### Meta (Facebook/WhatsApp)

```
signature = sha256=<hex(HMAC-SHA256(body, app_secret))>
```

Header: `X-Hub-Signature-256`

### TikTok

```
signature = base64(HMAC-SHA256(body, webhook_secret))
```

Header: `X-TikTok-Signature`
