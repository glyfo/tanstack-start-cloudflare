# Social Media Integration Troubleshooting Guide

This guide helps diagnose and resolve common issues with the TikTok, Facebook, and WhatsApp integrations.

## Quick Diagnostics

### Health Check Endpoints

Use these endpoints to quickly diagnose issues:

```bash
# Basic health check
curl https://your-domain.com/health

# Webhook configuration status
curl https://your-domain.com/health/webhooks

# External API status
curl https://your-domain.com/health/apis

# Readiness check
curl https://your-domain.com/health/ready
```

## Common Issues

### Webhook Signature Verification Failed

**Symptoms:**
- 401 Unauthorized responses from webhook endpoints
- Logs show "Invalid signature" or "Signature verification failed"

**Causes and Solutions:**

1. **Incorrect secret configured**
   - Verify `TIKTOK_WEBHOOK_SECRET` matches TikTok dashboard
   - Verify `FACEBOOK_APP_SECRET` matches Meta App Dashboard
   - Check `/health/webhooks` to confirm secrets are configured

2. **Request body was modified**
   - Ensure no middleware is modifying the raw request body
   - Signature is computed on the exact bytes received

3. **Secret contains special characters**
   - Ensure proper escaping in wrangler.jsonc
   - Use Cloudflare Secrets for production

**Debug steps:**
```bash
# Test webhook with known payload
node scripts/test-tiktok-webhook.js
node scripts/test-facebook-webhook.js
```

### Webhook Verification Challenge Failing

**Symptoms:**
- Cannot subscribe to Facebook/WhatsApp webhooks
- Meta dashboard shows "Callback verification failed"

**Causes and Solutions:**

1. **Incorrect verify token**
   - `FACEBOOK_VERIFY_TOKEN` must match what you entered in Meta dashboard
   - `WHATSAPP_VERIFY_TOKEN` must match WhatsApp configuration

2. **Endpoint not accessible**
   - Ensure your worker is deployed and accessible
   - Test: `curl "https://your-domain.com/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"`

3. **Wrong endpoint configured**
   - Facebook: `/api/webhooks/facebook`
   - WhatsApp: `/api/webhooks/whatsapp`

### Rate Limiting Issues

**Symptoms:**
- 429 Too Many Requests responses
- Leads are being dropped

**Causes and Solutions:**

1. **Legitimate high traffic**
   - Increase rate limits in `rate-limiter.ts`
   - Default: TikTok=60, Facebook=100, WhatsApp=200 per minute

2. **Abuse or attack**
   - Check logs for suspicious IPs
   - Add IP blocking if needed

3. **Rate limiter DO not working**
   - Verify `RATE_LIMITER` binding in wrangler.jsonc
   - Check Durable Object metrics in Cloudflare dashboard

### Duplicate Leads

**Symptoms:**
- Same lead appearing multiple times
- Cross-platform duplicates not detected

**Causes and Solutions:**

1. **LEADS_KV not configured**
   - Add `LEADS_KV` binding to wrangler.jsonc
   - Check `/health/apis` for KV status

2. **Different email formats**
   - Email normalization handles most cases
   - Check logs for normalization issues

3. **Phone number formatting**
   - Ensure international format (+1XXXXXXXXXX)
   - 10-digit numbers assumed US (+1)

### Facebook Lead Data Not Fetching

**Symptoms:**
- Webhook received but lead data empty
- Logs show "Failed to fetch lead data"

**Causes and Solutions:**

1. **Invalid or expired access token**
   - Refresh `FACEBOOK_PAGE_ACCESS_TOKEN`
   - Use long-lived page token (60 days)
   - Set up token refresh automation

2. **Missing permissions**
   - App needs `leads_retrieval` permission
   - App needs `pages_read_engagement` permission
   - Page must be connected to the app

3. **Lead expired**
   - Facebook deletes lead data after 90 days
   - Process webhooks immediately

**Debug steps:**
```bash
# Test Facebook API access
curl "https://graph.facebook.com/v18.0/me/leadgen_forms?access_token=YOUR_TOKEN"
```

### WhatsApp Messages Not Processing

**Symptoms:**
- Messages received but not processed
- No AI response sent

**Causes and Solutions:**

1. **Outside 24-hour window**
   - WhatsApp only allows free-form messages within 24 hours
   - Must use template messages outside window
   - Check logs for "Outside 24-hour window"

2. **ChatAgent not configured**
   - Verify `CHAT_AGENT` binding exists
   - Check AI model availability

3. **Missing contact info**
   - Ensure `contacts` array is in webhook payload
   - Check for malformed webhook data

### WhatsApp Template Messages Failing

**Symptoms:**
- Template messages not sending
- Error: "Template not found" or "Template not approved"

**Causes and Solutions:**

1. **Template not approved**
   - Check template status in WhatsApp Manager
   - Wait for approval (can take 24 hours)

2. **Wrong template name**
   - Template names are case-sensitive
   - Include language code if using translations

3. **Invalid parameters**
   - Ensure all template placeholders have values
   - Check parameter order matches template

### TikTok Leads Not Processing

**Symptoms:**
- Webhook received but leads not created
- Logs show processing errors

**Causes and Solutions:**

1. **Missing Durable Object bindings**
   - Verify all DO bindings in wrangler.jsonc:
     - `LEAD_QUALIFICATION`
     - `ENHANCED_CONVERSATION`
     - `OPPORTUNITY`

2. **Invalid lead data**
   - Check TikTok form configuration
   - Verify required fields are collected

## Logging and Monitoring

### Enable Verbose Logging

Logs are structured with prefixes for easy filtering:

```
[TikTokWebhook] - TikTok webhook events
[FacebookWebhook] - Facebook webhook events
[WhatsAppWebhook] - WhatsApp webhook events
[Deduplication] - Dedup service events
[RateLimiter] - Rate limiting events
```

### Cloudflare Dashboard

1. Go to Workers & Pages > Your Worker > Logs
2. Filter by:
   - Status code (4xx, 5xx)
   - Webhook endpoint path
   - Time range

### Common Log Patterns

**Successful lead processing:**
```
[TikTokWebhook] Processing lead { leadId: "..." }
[TikTokWebhook] Lead processed successfully { leadId: "..." }
```

**Duplicate detected:**
```
[Deduplication] Found duplicate by email { email: "...", existingLeadId: "..." }
```

**Signature failure:**
```
[TikTokWebhook] Invalid signature
[FacebookWebhook] Signature verification failed
```

## Configuration Checklist

### TikTok

- [ ] `TIKTOK_WEBHOOK_SECRET` set in environment
- [ ] Webhook URL configured in TikTok Business Center
- [ ] Lead form created and active
- [ ] Ad account has Lead Generation objective enabled

### Facebook

- [ ] `FACEBOOK_APP_SECRET` set in environment
- [ ] `FACEBOOK_VERIFY_TOKEN` set in environment
- [ ] `FACEBOOK_PAGE_ACCESS_TOKEN` set in environment
- [ ] Webhook subscribed to `leadgen` field
- [ ] App has `leads_retrieval` permission
- [ ] Page connected to app

### WhatsApp

- [ ] `FACEBOOK_APP_SECRET` set in environment
- [ ] `WHATSAPP_VERIFY_TOKEN` set in environment
- [ ] `WHATSAPP_ACCESS_TOKEN` set in environment
- [ ] `WHATSAPP_PHONE_NUMBER_ID` set in environment
- [ ] Webhook subscribed to `messages` field
- [ ] Business phone number verified

## Testing Webhooks Manually

### TikTok Test

```bash
cd scripts
node test-tiktok-webhook.js
```

### Facebook Test

```bash
cd scripts
node test-facebook-webhook.js
```

### WhatsApp Test

```bash
cd scripts
node test-whatsapp-webhook.js
```

## Getting Help

1. Check this troubleshooting guide first
2. Review logs in Cloudflare dashboard
3. Run health check endpoints
4. Test with manual webhook scripts
5. Check platform-specific documentation:
   - [TikTok Lead Generation API](https://business-api.tiktok.com/portal/docs?id=1747719780398082)
   - [Facebook Lead Ads API](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/)
   - [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
