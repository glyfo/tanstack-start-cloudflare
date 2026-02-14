# Social Media Platform Setup Guide

This guide explains how to obtain and configure API credentials for Meta Facebook Lead Ads, WhatsApp Business API, and TikTok Lead Generation.

---

## 🔐 Security Best Practices

### Development vs Production

**Development (local testing):**
- Use placeholder values in `wrangler.jsonc` dev section
- Never commit real secrets to git

**Production (deployed):**
- Use `wrangler secret put` command to set secrets
- Secrets are encrypted and never exposed in code

### Setting Production Secrets

```bash
# Meta Facebook
wrangler secret put FACEBOOK_APP_SECRET
wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
wrangler secret put FACEBOOK_VERIFY_TOKEN

# WhatsApp Business
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put WHATSAPP_PHONE_NUMBER_ID
wrangler secret put WHATSAPP_ACCESS_TOKEN

# TikTok
wrangler secret put TIKTOK_WEBHOOK_SECRET
```

---

## 📱 Meta Facebook Lead Ads Setup

### 1. Create Facebook App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Choose app type: **"Business"**
4. Fill in app details:
   - App Name: "Your CRM Name"
   - Contact Email: your@email.com
   - Business Portfolio: Select or create one

### 2. Add Products

In your app dashboard, add these products:
- **Webhooks** - For real-time lead notifications
- **Lead Ads RTU** - For lead retrieval

### 3. Generate App Secret

1. In App Dashboard → **Settings** → **Basic**
2. Find **"App Secret"** → Click **"Show"**
3. Copy and save securely
4. Use for: `FACEBOOK_APP_SECRET`

### 4. Get Page Access Token

#### Option A: Graph API Explorer (Development)
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Click **"Get Token"** → **"Get Page Access Token"**
4. Select your Facebook Page
5. Grant permissions:
   - `pages_manage_ads`
   - `pages_read_engagement`
   - `leads_retrieval`
6. Copy the token
7. **Important:** Convert to long-lived token (see below)

#### Option B: Manual Process (Production)
```bash
# Step 1: Get user access token with required permissions
# Visit this URL (replace YOUR_APP_ID and YOUR_REDIRECT_URI):
https://www.facebook.com/v18.0/dialog/oauth?client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&scope=pages_manage_ads,pages_read_engagement,leads_retrieval

# Step 2: Exchange for long-lived user token
curl "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"

# Step 3: Get page access token (using long-lived user token)
curl "https://graph.facebook.com/v18.0/PAGE_ID?fields=access_token&access_token=LONG_LIVED_USER_TOKEN"
```

Use the final token for: `FACEBOOK_PAGE_ACCESS_TOKEN`

### 5. Create Webhook Verify Token

1. Generate a random string (32+ characters):
   ```bash
   openssl rand -base64 32
   ```
2. Save this token
3. Use for: `FACEBOOK_VERIFY_TOKEN`

### 6. Configure Webhook

1. In App Dashboard → **Webhooks**
2. Click **"Configure"** next to **Pages**
3. Set Callback URL: `https://your-worker.workers.dev/webhooks/facebook`
4. Set Verify Token: (use the token from step 5)
5. Subscribe to fields:
   - `leadgen` ← This is the critical one!
6. Click **"Verify and Save"**

### 7. Subscribe Page to App

```bash
curl -X POST "https://graph.facebook.com/v18.0/PAGE_ID/subscribed_apps?subscribed_fields=leadgen&access_token=PAGE_ACCESS_TOKEN"
```

### 8. Test Your Setup

```bash
# Send test lead (use Facebook's test tool)
# Or create a test lead ad and submit a test form
```

---

## 💬 WhatsApp Business API Setup

### 1. Prerequisites

- Meta Business Account (same as Facebook)
- Verified business identity
- Phone number NOT currently on WhatsApp

### 2. Access WhatsApp Business Platform

#### Option A: Through Meta Business Manager (Recommended)
1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Click **"Settings"** → **"WhatsApp Accounts"**
3. Click **"Add"** → **"Create a WhatsApp Business Account"**

#### Option B: Through App Dashboard
1. Go to your Facebook App
2. Add product: **"WhatsApp"**
3. Click **"Get Started"**

### 3. Set Up Phone Number

1. In WhatsApp Business Platform → **"Phone Numbers"**
2. Click **"Add Phone Number"**
3. Choose option:
   - Use Meta test number (for development)
   - Add your own business number
4. Complete verification process
5. Copy **Phone Number ID**
6. Use for: `WHATSAPP_PHONE_NUMBER_ID`

### 4. Generate Access Token

1. In App Dashboard → **WhatsApp** → **"Getting Started"**
2. Copy **"Temporary access token"** (valid 24 hours)
3. For production, create **System User** token:
   - Go to Business Settings → System Users
   - Create system user
   - Generate token with permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
4. Use for: `WHATSAPP_ACCESS_TOKEN`

### 5. Create Webhook Verify Token

```bash
# Generate random string
openssl rand -base64 32
```

Use for: `WHATSAPP_VERIFY_TOKEN`

### 6. Configure Webhook

1. In App Dashboard → **WhatsApp** → **"Configuration"**
2. Click **"Edit"** next to Webhook
3. Set Callback URL: `https://your-worker.workers.dev/webhooks/whatsapp`
4. Set Verify Token: (from step 5)
5. Click **"Verify and Save"**
6. Subscribe to fields:
   - `messages`
   - `message_template_status_update`

### 7. Create Message Templates

WhatsApp requires pre-approved templates for initial outreach:

1. Go to **WhatsApp Manager** → **"Message Templates"**
2. Click **"Create Template"**
3. Example template:
   - Name: `welcome_message`
   - Category: `UTILITY`
   - Language: English
   - Body: "Hi {{1}}, thanks for your interest! We'll be in touch soon."
4. Submit for approval (usually takes 1-24 hours)

### 8. Test Setup

```bash
# Send test message using curl
curl -X POST "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "YOUR_TEST_PHONE",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": { "code": "en_US" }
    }
  }'
```

---

## 🎵 TikTok Lead Generation Setup

### 1. Create TikTok Business Account

1. Go to [TikTok for Business](https://ads.tiktok.com/)
2. Sign up or log in
3. Complete business verification

### 2. Create TikTok App

1. Go to [TikTok Developer Portal](https://developers.tiktok.com/)
2. Click **"Create an App"**
3. Fill in app details:
   - App Name
   - Description
   - Category: Business Tools
4. Submit for review

### 3. Enable Lead Generation API

1. In App Dashboard → **"Products"**
2. Find **"Lead Generation"**
3. Click **"Enable"**
4. Complete setup wizard

### 4. Get Webhook Secret

1. In App Dashboard → **"Webhooks"**
2. Click **"Create Webhook"**
3. Set Callback URL: `https://your-worker.workers.dev/webhooks/tiktok`
4. TikTok will provide a **Webhook Secret**
5. Use for: `TIKTOK_WEBHOOK_SECRET`

### 5. Subscribe to Events

1. In Webhooks configuration
2. Subscribe to events:
   - `lead.create`
   - `lead.update`

### 6. Create Lead Generation Form

1. Go to [TikTok Ads Manager](https://ads.tiktok.com/)
2. Create new campaign
3. Choose **"Lead Generation"** objective
4. Create Instant Form:
   - Add standard fields (name, email, phone)
   - Add custom questions if needed
   - Configure form settings

### 7. Link Form to Webhook

1. In TikTok Business Center
2. Go to **"Assets"** → **"Lead Download"**
3. Select form
4. Enable webhook delivery
5. Select your webhook endpoint

### 8. Test Setup

```bash
# TikTok provides a test tool in the developer portal
# Or submit a test form entry to generate a webhook
```

---

## ✅ Verification Checklist

### Meta Facebook Lead Ads
- [ ] App created and configured
- [ ] App Secret saved
- [ ] Page Access Token (long-lived) obtained
- [ ] Verify token created
- [ ] Webhook configured and verified
- [ ] Page subscribed to app
- [ ] Test lead generated successfully

### WhatsApp Business API
- [ ] WhatsApp Business Account created
- [ ] Phone number added and verified
- [ ] Phone Number ID obtained
- [ ] Access Token generated
- [ ] Verify token created
- [ ] Webhook configured
- [ ] Message template created and approved
- [ ] Test message sent successfully

### TikTok Lead Generation
- [ ] TikTok Business Account created
- [ ] App created and approved
- [ ] Lead Generation enabled
- [ ] Webhook Secret obtained
- [ ] Webhook configured
- [ ] Lead form created
- [ ] Form linked to webhook
- [ ] Test lead submitted successfully

---

## 🔄 Token Rotation Schedule

### Recommended Rotation Frequency

| Token | Rotation Frequency | Priority |
|-------|-------------------|----------|
| Facebook Page Token | 60 days | High |
| WhatsApp Access Token | 90 days | High |
| App Secrets | 90 days | Critical |
| Verify Tokens | 180 days | Medium |
| TikTok Webhook Secret | Never (unless compromised) | Low |

### How to Rotate Tokens

```bash
# 1. Generate new token (follow platform instructions above)
# 2. Update production secret
wrangler secret put TOKEN_NAME
# 3. Test that new token works
# 4. Monitor for any failures
# 5. Update documentation with rotation date
```

---

## 🚨 Troubleshooting

### Facebook Lead Ads

**Problem:** Webhook not receiving events
- Check webhook configuration in App Dashboard
- Verify page is subscribed: `GET /PAGE_ID/subscribed_apps`
- Check token has `leadgen` permission
- Verify webhook signature validation is working

**Problem:** Token expired
- Page tokens expire after 60 days
- Generate new long-lived token
- Update `FACEBOOK_PAGE_ACCESS_TOKEN`

### WhatsApp Business API

**Problem:** Cannot send messages
- Check 24-hour messaging window policy
- Verify template is approved
- Check phone number is not blocked
- Verify access token has correct permissions

**Problem:** Webhook not receiving messages
- Check webhook configuration
- Verify phone number is subscribed to webhook
- Test with test message to yourself

### TikTok Lead Generation

**Problem:** Not receiving leads
- Check webhook is subscribed to correct events
- Verify form is linked to webhook
- Check signature verification is working
- Test with form submission

---

## 📚 Additional Resources

### Meta Platform
- [Facebook Lead Ads API](https://developers.facebook.com/docs/marketing-api/guides/lead-ads)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)
- [Meta Business Help Center](https://www.facebook.com/business/help)

### TikTok
- [TikTok for Business](https://ads.tiktok.com/)
- [TikTok Developer Docs](https://developers.tiktok.com/)
- [Lead Generation API](https://business-api.tiktok.com/portal/docs?id=1747719780398082)

### Tools
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- [Webhook Testing Tool](https://webhook.site/) - For testing webhook delivery

---

*Last Updated: 2026-01-19*
*Keep this guide up to date as APIs evolve!*
