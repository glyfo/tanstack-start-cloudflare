# Platform Integration Setup Guide

One-time setup for connecting social media platforms to your SuperHuman instance.

---

## Overview

| Platform | API | Auth Type | Token Expiry |
|----------|-----|-----------|--------------|
| Gmail | Google Gmail API | OAuth 2.0 + PKCE | 1 hour (auto-refresh) |
| Facebook | Meta Graph API | OAuth 2.0 | 60 days |
| Instagram | Meta Graph API | OAuth 2.0 | 60 days |
| WhatsApp | WhatsApp Business API | OAuth 2.0 | 60 days |
| TikTok | TikTok Lead Generation | OAuth 2.0 + PKCE | 24 hours (auto-refresh) |

---

## 1. Gmail Setup

### Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API:
   - **APIs & Services** → **Library**
   - Search "Gmail API" → **Enable**

### OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. Select User Type: **External**
3. Fill App Information:
   - App name: `SuperHuman`
   - User support email: your email
   - Developer contact: your email
4. Add Scopes:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```
5. Add Test Users (while in testing mode)
6. Submit for verification (for production)

### Create OAuth Credentials

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `SuperHuman Web`
5. Authorized redirect URIs:
   ```
   https://your-domain.workers.dev/api/oauth/gmail/callback
   ```
6. Copy **Client ID** and **Client Secret**

### Set Secrets

```bash
wrangler secret put GMAIL_CLIENT_ID
# Paste: your-client-id.apps.googleusercontent.com

wrangler secret put GMAIL_CLIENT_SECRET
# Paste: your-client-secret
```

---

## 2. Facebook Setup

### Meta Developer Console

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. **My Apps** → **Create App**
3. Select **Business** type
4. Fill app details and create

### Configure Facebook Login

1. In your app, go to **Add Products**
2. Add **Facebook Login for Business**
3. Go to **Facebook Login** → **Settings**
4. Add Valid OAuth Redirect URIs:
   ```
   https://your-domain.workers.dev/api/oauth/facebook/callback
   ```

### App Permissions

1. Go to **App Review** → **Permissions and Features**
2. Request these permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `leads_retrieval`
   - `pages_manage_metadata`

### Webhooks Setup

1. Go to **Webhooks** → **Add Product**
2. Select **Page** subscription
3. Callback URL:
   ```
   https://your-domain.workers.dev/api/webhooks/facebook
   ```
4. Verify Token: Generate a random string
5. Subscribe to: `leadgen`, `messages`, `feed`

### Set Secrets

```bash
wrangler secret put FACEBOOK_APP_ID
# Paste: your-app-id

wrangler secret put FACEBOOK_APP_SECRET
# Paste: your-app-secret

wrangler secret put FACEBOOK_VERIFY_TOKEN
# Paste: your-webhook-verify-token
```

---

## 3. Instagram Setup

> Instagram uses the same Meta app as Facebook

### Additional Permissions

1. In your Meta app, go to **App Review** → **Permissions and Features**
2. Request these additional permissions:
   - `instagram_basic`
   - `instagram_manage_messages`

### Configure Redirect URI

1. Go to **Facebook Login** → **Settings**
2. Add redirect URI:
   ```
   https://your-domain.workers.dev/api/oauth/instagram/callback
   ```

### Webhooks Setup

1. Go to **Webhooks**
2. Add **Instagram** subscription
3. Callback URL:
   ```
   https://your-domain.workers.dev/api/webhooks/instagram
   ```
4. Subscribe to: `messages`, `comments`, `mentions`

> Note: Instagram Business accounts must be connected to a Facebook Page

---

## 4. WhatsApp Setup

### Prerequisites

- Meta Business Account
- WhatsApp Business Account
- Verified business phone number

### Meta Developer Console

1. In your Meta app, go to **Add Products**
2. Add **WhatsApp**
3. Go to **WhatsApp** → **Getting Started**
4. Follow the setup wizard to connect your business

### Permissions

1. Go to **App Review** → **Permissions and Features**
2. Request:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`

### Configure Redirect URI

1. Go to **Facebook Login** → **Settings**
2. Add redirect URI:
   ```
   https://your-domain.workers.dev/api/oauth/whatsapp/callback
   ```

### Webhooks Setup

1. Go to **WhatsApp** → **Configuration**
2. Callback URL:
   ```
   https://your-domain.workers.dev/api/webhooks/whatsapp
   ```
3. Verify Token: Use same as Facebook or generate new
4. Subscribe to: `messages`

### Set Secrets

```bash
wrangler secret put WHATSAPP_VERIFY_TOKEN
# Paste: your-webhook-verify-token

wrangler secret put WHATSAPP_PHONE_NUMBER_ID
# Paste: your-phone-number-id (from WhatsApp dashboard)
```

---

## 5. TikTok Setup

### TikTok Developer Portal

1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. **Manage Apps** → **Create App**
3. Select **Lead Generation** product

### Configure App

1. App name: `SuperHuman`
2. Add product: **Login Kit** + **Lead Generation**
3. Redirect URI:
   ```
   https://your-domain.workers.dev/api/oauth/tiktok/callback
   ```

### Permissions

Request these scopes:
- `user.info.basic`
- `lead.read`

### Webhooks Setup

1. Go to **Webhooks** in your app settings
2. Add endpoint:
   ```
   https://your-domain.workers.dev/api/webhooks/tiktok
   ```
3. Subscribe to: `lead` events

### Set Secrets

```bash
wrangler secret put TIKTOK_CLIENT_KEY
# Paste: your-client-key

wrangler secret put TIKTOK_CLIENT_SECRET
# Paste: your-client-secret

wrangler secret put TIKTOK_WEBHOOK_SECRET
# Paste: your-webhook-secret
```

---

## 6. Token Encryption

Set a strong encryption secret for storing OAuth tokens:

```bash
# Generate a secure random string (32+ characters)
openssl rand -base64 32

wrangler secret put TOKEN_ENCRYPTION_SECRET
# Paste: your-generated-secret
```

---

## Summary: All Secrets

```bash
# Gmail
wrangler secret put GMAIL_CLIENT_ID
wrangler secret put GMAIL_CLIENT_SECRET

# Facebook/Instagram/WhatsApp (shared Meta app)
wrangler secret put FACEBOOK_APP_ID
wrangler secret put FACEBOOK_APP_SECRET
wrangler secret put FACEBOOK_VERIFY_TOKEN

# WhatsApp specific
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put WHATSAPP_PHONE_NUMBER_ID

# TikTok
wrangler secret put TIKTOK_CLIENT_KEY
wrangler secret put TIKTOK_CLIENT_SECRET
wrangler secret put TIKTOK_WEBHOOK_SECRET

# Encryption
wrangler secret put TOKEN_ENCRYPTION_SECRET
```

---

## Redirect URIs Reference

| Platform | Redirect URI |
|----------|--------------|
| Gmail | `https://your-domain.workers.dev/api/oauth/gmail/callback` |
| Facebook | `https://your-domain.workers.dev/api/oauth/facebook/callback` |
| Instagram | `https://your-domain.workers.dev/api/oauth/instagram/callback` |
| WhatsApp | `https://your-domain.workers.dev/api/oauth/whatsapp/callback` |
| TikTok | `https://your-domain.workers.dev/api/oauth/tiktok/callback` |

---

## Webhook URLs Reference

| Platform | Webhook URL |
|----------|-------------|
| Facebook | `https://your-domain.workers.dev/api/webhooks/facebook` |
| Instagram | `https://your-domain.workers.dev/api/webhooks/instagram` |
| WhatsApp | `https://your-domain.workers.dev/api/webhooks/whatsapp` |
| TikTok | `https://your-domain.workers.dev/api/webhooks/tiktok` |

---

## Testing

After setup, test each connection:

1. Go to `/settings/connections`
2. Click **Connect** for each platform
3. Complete OAuth flow
4. Verify status shows **Connected**

For webhooks, check `/settings/webhooks` for endpoint status.

---

## Autonomous Gmail Review (Scheduled Worker)

The backend supports autonomous Gmail inbox scans using Cloudflare Cron Triggers.

1. Configure backend vars in `backend/wrangler.jsonc` (or `wrangler secret/vars` in your env):
   - `GMAIL_AUTONOMOUS_ENABLED`: `true` or `false`
   - `GMAIL_AUTONOMOUS_ORGS`: comma-separated org IDs (example: `default-org,acme-org`)
   - `GMAIL_AUTONOMOUS_QUERY`: Gmail search query (example: `in:inbox is:unread`)
   - `GMAIL_AUTONOMOUS_MAX_RESULTS`: max emails per org per run (`1-20`)
2. Configure cron schedule in `backend/wrangler.jsonc`:
   ```jsonc
   "triggers": {
     "crons": ["*/15 * * * *"]
   }
   ```
3. Deploy backend:
   ```bash
   cd backend
   pnpm wrangler deploy
   ```

Current behavior: scheduled runs review inboxes and write per-org results to Worker logs.

---

## Troubleshooting

### OAuth Errors

| Error | Solution |
|-------|----------|
| `redirect_uri_mismatch` | Check redirect URI matches exactly in platform console |
| `invalid_client` | Verify Client ID and Secret are correct |
| `access_denied` | User denied permission or app not approved |
| `invalid_scope` | Request required permissions in App Review |

### Webhook Errors

| Error | Solution |
|-------|----------|
| Verification failed | Check Verify Token matches |
| Events not received | Ensure subscriptions are active |
| 401 Unauthorized | Token expired, reconnect the platform |

---

## Production Checklist

- [ ] All secrets set via `wrangler secret put`
- [ ] OAuth consent screen submitted for verification (Gmail)
- [ ] App Review completed (Meta platforms)
- [ ] Webhooks verified and subscribed
- [ ] Test connections working
- [ ] Token refresh working (check after 1 hour for Gmail)
