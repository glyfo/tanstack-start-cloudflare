# External Integrations Guide - Complete Setup

**Complete guide for connecting all external systems to SuperHuman CRM**

This document covers setup for all 10+ integrations in one place:
- WhatsApp Business API
- Slack
- Discord
- Telegram
- Twilio SMS
- Email (Cloudflare Email Workers)
- Facebook/Instagram
- TikTok
- Gmail

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [WhatsApp Business API](#1-whatsapp-business-api)
3. [Slack](#2-slack)
4. [Discord](#3-discord)
5. [Telegram](#4-telegram)
6. [Twilio SMS](#5-twilio-sms)
7. [Email (Cloudflare)](#6-email-cloudflare-email-workers)
8. [Facebook & Instagram](#7-facebook--instagram)
9. [TikTok](#8-tiktok)
10. [Gmail](#9-gmail)
11. [Testing Integrations](#testing-integrations)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Cloudflare account (Workers & Pages)
- Access to deployed backend: `https://tanstack-start-cloudflare-backend.glyfo.workers.dev`
- Wrangler CLI installed: `npm install -g wrangler`

### Your Webhook Base URL
```
https://tanstack-start-cloudflare-backend.glyfo.workers.dev
```

All webhook URLs will use this base URL + specific endpoint.

---

## 1. WhatsApp Business API

### Overview
Connect WhatsApp Business to receive and send messages through the CRM.

### Step 1: Create Facebook Developer App

1. Go to https://developers.facebook.com
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as app type
4. Fill in:
   - **App Name:** "SuperHuman CRM WhatsApp"
   - **App Contact Email:** your-email@domain.com
   - **Business Account:** Select or create one

### Step 2: Set Up WhatsApp Product

1. In your app dashboard, click **"Add Product"**
2. Find **"WhatsApp"** → Click **"Set Up"**
3. Under **"API Setup"**, you'll see:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Temporary Access Token**

**Save these values!**

### Step 3: Get Permanent Access Token

**Temporary token expires in 24 hours.** Get a permanent one:

1. In Meta Developer Console, go to **"App Settings" → "Basic"**
2. Copy your **App ID** and **App Secret**
3. Get user access token:
   - Go to https://developers.facebook.com/tools/explorer/
   - Select your app
   - Get token with these permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
   - Click **"Generate Access Token"**

4. Exchange for long-lived token:
```bash
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=YOUR_APP_ID&\
client_secret=YOUR_APP_SECRET&\
fb_exchange_token=SHORT_LIVED_TOKEN"
```

5. Get permanent system user token:
   - Go to **Business Settings** → **System Users**
   - Create system user or use existing
   - Assign assets: WhatsApp Business Account
   - Generate new token with same permissions
   - **This token never expires!**

### Step 4: Configure Webhook

1. In WhatsApp Product page, go to **"Configuration"**
2. Click **"Edit"** next to Webhook
3. Enter:
   - **Callback URL:**
     ```
     https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/whatsapp
     ```
   - **Verify Token:** Create a secret string (e.g., `whatsapp_verify_token_2024`)

4. Click **"Verify and Save"**

5. Subscribe to webhook fields:
   - ✅ `messages`
   - ✅ `message_template_status_update`
   - Click **"Save"**

### Step 5: Set Cloudflare Secrets

```bash
cd backend

# WhatsApp Access Token (permanent token from Step 3)
pnpm wrangler secret put WHATSAPP_ACCESS_TOKEN
# Paste your permanent token

# Phone Number ID (from API Setup)
pnpm wrangler secret put WHATSAPP_PHONE_NUMBER_ID
# Paste: 123456789012345

# Verify Token (same as webhook verify token)
pnpm wrangler secret put WHATSAPP_VERIFY_TOKEN
# Paste: whatsapp_verify_token_2024

# App Secret (for webhook signature verification)
pnpm wrangler secret put FACEBOOK_APP_SECRET
# Paste your app secret
```

### Step 6: Test Integration

1. Send a test message to your WhatsApp Business number
2. Check backend logs:
```bash
pnpm wrangler tail
```

3. Verify webhook received message
4. Check admin dashboard: `/admin/channels`

### WhatsApp Configuration Summary

| Setting | Value |
|---------|-------|
| Webhook URL | `https://.../api/webhooks/whatsapp` |
| Verify Token | Your custom verify token |
| Subscribed Fields | `messages`, `message_template_status_update` |
| API Version | v18.0 or later |

---

## 2. Slack

### Overview
Integrate Slack to receive messages from channels and DMs.

### Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter:
   - **App Name:** "SuperHuman CRM"
   - **Workspace:** Select your workspace

### Step 2: Configure Bot Permissions

1. Go to **"OAuth & Permissions"**
2. Under **"Scopes" → "Bot Token Scopes"**, add:
   - `app_mentions:read` - Read mentions
   - `channels:history` - Read public channel messages
   - `channels:read` - View public channels
   - `chat:write` - Send messages
   - `groups:history` - Read private channel messages
   - `groups:read` - View private channels
   - `im:history` - Read DM messages
   - `im:read` - View DMs
   - `im:write` - Send DMs
   - `users:read` - Read user info

3. Click **"Install to Workspace"**
4. Authorize the app
5. **Copy the Bot User OAuth Token** (starts with `xoxb-`)

### Step 3: Enable Events API

1. Go to **"Event Subscriptions"**
2. Toggle **"Enable Events"** to ON
3. Enter **Request URL:**
   ```
   https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/slack
   ```

4. Wait for **"Verified ✓"** checkmark

5. Under **"Subscribe to bot events"**, add:
   - `app_mention` - When someone @mentions your bot
   - `message.channels` - Messages in public channels
   - `message.groups` - Messages in private channels
   - `message.im` - Direct messages

6. Click **"Save Changes"**

### Step 4: Enable Interactivity (Optional)

For buttons and interactive messages:

1. Go to **"Interactivity & Shortcuts"**
2. Toggle ON
3. Enter **Request URL:**
   ```
   https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/slack
   ```

### Step 5: Set Cloudflare Secrets

```bash
cd backend

# Bot OAuth Token (from OAuth & Permissions)
pnpm wrangler secret put SLACK_BOT_TOKEN
# Paste: xoxb-your-token-here

# Signing Secret (from Basic Information → App Credentials)
pnpm wrangler secret put SLACK_SIGNING_SECRET
# Paste your signing secret
```

### Step 6: Configure Channel Access

**Option A: Invite bot to channels**
```
/invite @SuperHuman CRM
```

**Option B: Auto-join configuration**
Add to `backend/wrangler.jsonc`:
```json
{
  "vars": {
    "SLACK_AUTO_JOIN_CHANNELS": "true"
  }
}
```

### Step 7: Test Integration

1. Send a DM to your bot
2. Mention your bot in a channel: `@SuperHuman CRM hello`
3. Check logs: `pnpm wrangler tail`
4. Verify in admin dashboard

### Slack Configuration Summary

| Setting | Value |
|---------|-------|
| Event Subscriptions URL | `https://.../api/webhooks/slack` |
| Interactivity URL | Same as above |
| Bot Scopes | 10 permissions (see above) |
| Required Events | `app_mention`, `message.*` |

---

## 3. Discord

### Overview
Connect Discord to receive messages from servers and DMs.

### Step 1: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Enter name: **"SuperHuman CRM"**
4. Click **"Create"**

### Step 2: Create Bot

1. Go to **"Bot"** tab
2. Click **"Add Bot"** → **"Yes, do it!"**
3. Under **Token**, click **"Copy"** to copy bot token
4. **Save this token securely!**

### Step 3: Configure Bot Permissions

1. Under **"Privileged Gateway Intents"**, enable:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
   - ✅ **Presence Intent** (optional)

2. Click **"Save Changes"**

### Step 4: Set Up Interactions Endpoint

1. Go to **"General Information"** tab
2. Under **"Interactions Endpoint URL"**, enter:
   ```
   https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/discord
   ```

3. **Copy Public Key** (needed for webhook verification)

### Step 5: Invite Bot to Server

1. Go to **"OAuth2" → "URL Generator"**
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`

3. Select bot permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Add Reactions

4. Copy the generated URL
5. Open URL in browser and select your server
6. Click **"Authorize"**

### Step 6: Set Cloudflare Secrets

```bash
cd backend

# Bot Token (from Bot tab)
pnpm wrangler secret put DISCORD_BOT_TOKEN
# Paste: your-bot-token

# Public Key (from General Information)
pnpm wrangler secret put DISCORD_PUBLIC_KEY
# Paste: your-public-key

# Application ID (from General Information)
pnpm wrangler secret put DISCORD_APPLICATION_ID
# Paste: your-app-id
```

### Step 7: Configure Gateway (if needed)

For real-time events (optional, webhooks are primary):

Add to your backend code or use Discord Gateway directly.

### Step 8: Test Integration

1. Send a message in Discord server where bot is present
2. Mention the bot: `@SuperHuman CRM hello`
3. Send DM to the bot
4. Check logs and admin dashboard

### Discord Configuration Summary

| Setting | Value |
|---------|-------|
| Interactions Endpoint | `https://.../api/webhooks/discord` |
| Gateway Intents | Server Members, Message Content |
| Required Permissions | Read/Send Messages, Read History |

---

## 4. Telegram

### Overview
Connect Telegram Bot to receive and send messages.

### Step 1: Create Telegram Bot

1. Open Telegram app
2. Search for **@BotFather**
3. Send `/newbot`
4. Follow prompts:
   - **Bot name:** SuperHuman CRM Bot
   - **Username:** superhuman_crm_bot (must end with 'bot')

5. BotFather will reply with:
   - Bot token (e.g., `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
   - **Save this token!**

### Step 2: Configure Bot Settings

Optional but recommended:

```
# Set bot description
/setdescription
# Enter: "SuperHuman CRM - Your AI-powered customer relationship assistant"

# Set about text
/setabouttext
# Enter: "Manage customers, leads, and conversations with AI assistance"

# Set bot commands
/setcommands
# Enter:
start - Start conversation
help - Get help
reset - Reset conversation
```

### Step 3: Set Webhook

Use Telegram Bot API to set webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/telegram",
    "allowed_updates": ["message", "edited_message", "callback_query"],
    "drop_pending_updates": true
  }'
```

**Success response:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### Step 4: Set Cloudflare Secrets

```bash
cd backend

# Bot Token (from BotFather)
pnpm wrangler secret put TELEGRAM_BOT_TOKEN
# Paste: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

### Step 5: Enable Group Privacy (Optional)

If you want bot in groups:

1. Send `/setprivacy` to BotFather
2. Select your bot
3. Choose **"Disable"** - Bot receives all messages
4. Or **"Enable"** - Bot only receives commands and mentions

### Step 6: Test Integration

1. Search for your bot in Telegram: `@superhuman_crm_bot`
2. Click **"Start"**
3. Send a message: "Hello"
4. Bot should respond through your CRM
5. Check admin dashboard

### Telegram Configuration Summary

| Setting | Value |
|---------|-------|
| Webhook URL | `https://.../api/webhooks/telegram` |
| Allowed Updates | `message`, `edited_message`, `callback_query` |
| Privacy Mode | Disabled (for groups) |

---

## 5. Twilio SMS

### Overview
Send and receive SMS messages via Twilio.

### Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up for free trial or paid account
3. Verify your email and phone

### Step 2: Get Twilio Credentials

1. Go to https://console.twilio.com
2. From dashboard, copy:
   - **Account SID** (starts with AC...)
   - **Auth Token** (click to reveal)

### Step 3: Get Phone Number

1. Go to **"Phone Numbers" → "Manage" → "Buy a number"**
2. Select country (e.g., United States)
3. Check **"SMS"** capability
4. Search and purchase a number
5. **Save your Twilio number** (e.g., +15551234567)

### Step 4: Configure Messaging Webhook

1. Go to **"Phone Numbers" → "Manage" → "Active Numbers"**
2. Click on your purchased number
3. Scroll to **"Messaging"** section
4. Under **"A MESSAGE COMES IN"**:
   - Select **"Webhook"**
   - Enter URL:
     ```
     https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/twilio
     ```
   - Method: **HTTP POST**

5. Click **"Save"**

### Step 5: Set Cloudflare Secrets

```bash
cd backend

# Account SID
pnpm wrangler secret put TWILIO_ACCOUNT_SID
# Paste: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Auth Token
pnpm wrangler secret put TWILIO_AUTH_TOKEN
# Paste: your-auth-token

# Phone Number
pnpm wrangler secret put TWILIO_PHONE_NUMBER
# Paste: +15551234567
```

### Step 6: Test Integration

1. Send SMS to your Twilio number from your phone:
   ```
   Text: "Hello from SMS"
   ```

2. Check logs:
   ```bash
   pnpm wrangler tail
   ```

3. Verify message received
4. Bot should respond via SMS

### Twilio Configuration Summary

| Setting | Value |
|---------|-------|
| Webhook URL | `https://.../api/webhooks/twilio` |
| HTTP Method | POST |
| Status Callback | Optional (same URL) |

---

## 6. Email (Cloudflare Email Workers)

### Overview
Receive emails directly through Cloudflare Email Workers.

### Step 1: Prerequisites

- Custom domain configured in Cloudflare
- DNS managed by Cloudflare

### Step 2: Enable Email Routing

1. Go to Cloudflare Dashboard
2. Select your domain
3. Go to **"Email" → "Email Routing"**
4. Click **"Enable Email Routing"**

### Step 3: Configure Email Routing

1. Cloudflare will add MX records automatically
2. Verify DNS records are added:
   - `MX` records pointing to Cloudflare
   - `TXT` record for SPF

### Step 4: Create Routing Rule

1. In Email Routing, go to **"Routes"**
2. Click **"Create Route"**
3. Configure:
   - **Match:** `support@yourdomain.com` (or `*@yourdomain.com` for all)
   - **Action:** Send to Worker
   - **Worker:** Your backend worker

### Step 5: Update wrangler.jsonc

Email handler is already configured in `backend/src/entry.ts`:

```typescript
async email(message: any, env: any, ctx: any) {
  await handleInboundEmail(message, env);
}
```

### Step 6: Deploy with Email Binding

In `backend/wrangler.jsonc`:

```json
{
  "send_email": [
    {
      "name": "EMAIL_SENDER",
      "destination_address": "noreply@yourdomain.com"
    }
  ]
}
```

Deploy:
```bash
cd backend
pnpm wrangler deploy
```

### Step 7: Test Integration

Send test email:
```bash
echo "Test email body" | mail -s "Test Subject" support@yourdomain.com
```

Or use an email client to send to your configured address.

### Email Configuration Summary

| Setting | Value |
|---------|-------|
| Routing Destination | Send to Worker |
| Worker | tanstack-start-cloudflare-backend |
| MX Records | Managed by Cloudflare |

---

## 7. Facebook & Instagram

### Overview
Receive messages from Facebook Page and Instagram Business account.

### Step 1: Create Facebook App (if not done for WhatsApp)

1. Go to https://developers.facebook.com
2. **"My Apps" → "Create App" → "Business"**
3. Name: "SuperHuman CRM Social"

### Step 2: Add Messenger Product

1. In app dashboard, **"Add Product"**
2. Find **"Messenger"** → **"Set Up"**

### Step 3: Add Instagram Product

1. **"Add Product"**
2. Find **"Instagram"** → **"Set Up"**
3. Connect Instagram Business Account

### Step 4: Configure Webhooks

**For Facebook Messenger:**

1. Go to **Messenger → Settings**
2. Under **Webhooks**, click **"Add Callback URL"**
3. Enter:
   - **Callback URL:**
     ```
     https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/facebook
     ```
   - **Verify Token:** Create secret (e.g., `facebook_verify_2024`)

4. Click **"Verify and Save"**

5. Subscribe to fields:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `messaging_optins`

**For Instagram:**

1. Go to **Instagram → Settings**
2. Under **Webhooks**, click **"Add Callback URL"**
3. Enter:
   - **Callback URL:**
     ```
     https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/instagram
     ```
   - **Verify Token:** Create secret (e.g., `instagram_verify_2024`)

4. Subscribe to fields:
   - ✅ `messages`
   - ✅ `messaging_postbacks`

### Step 5: Get Page Access Token

1. Go to **Tools → Graph API Explorer**
2. Select your app
3. Select your Page
4. Get token with permissions:
   - `pages_messaging`
   - `pages_manage_metadata`
   - `instagram_basic`
   - `instagram_manage_messages`

5. Convert to long-lived token (same process as WhatsApp)
6. Generate system user token for permanent access

### Step 6: Subscribe Page/Instagram to Webhook

**Facebook Page:**
```bash
curl -X POST "https://graph.facebook.com/v18.0/{PAGE_ID}/subscribed_apps?\
access_token={PAGE_ACCESS_TOKEN}&\
subscribed_fields=messages,messaging_postbacks"
```

**Instagram:**
```bash
curl -X POST "https://graph.facebook.com/v18.0/{INSTAGRAM_BUSINESS_ID}/subscribed_apps?\
access_token={ACCESS_TOKEN}&\
subscribed_fields=messages"
```

### Step 7: Set Cloudflare Secrets

```bash
cd backend

# Facebook Page Access Token
pnpm wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
# Paste: your-page-token

# Facebook App Secret
pnpm wrangler secret put FACEBOOK_APP_SECRET
# Paste: your-app-secret

# Facebook Verify Token
pnpm wrangler secret put FACEBOOK_VERIFY_TOKEN
# Paste: facebook_verify_2024

# Instagram Access Token
pnpm wrangler secret put INSTAGRAM_ACCESS_TOKEN
# Paste: your-instagram-token

# Instagram Verify Token
pnpm wrangler secret put INSTAGRAM_VERIFY_TOKEN
# Paste: instagram_verify_2024
```

### Step 8: Test Integration

1. Send message to your Facebook Page
2. Send DM to your Instagram Business account
3. Check logs and admin dashboard

### Facebook/Instagram Configuration Summary

| Platform | Webhook URL | Fields |
|----------|-------------|--------|
| Facebook | `https://.../api/webhooks/facebook` | `messages`, `messaging_postbacks` |
| Instagram | `https://.../api/webhooks/instagram` | `messages` |

---

## 8. TikTok

### Overview
Receive lead data from TikTok Lead Generation ads.

### Step 1: Create TikTok Business Account

1. Go to https://ads.tiktok.com
2. Sign up for Business account
3. Complete business verification

### Step 2: Create TikTok Developer App

1. Go to https://developers.tiktok.com
2. **"My Apps" → "Create App"**
3. Fill in app details
4. Submit for review (may take 1-2 days)

### Step 3: Set Up Lead Generation

1. Once app approved, go to **"Developer Portal"**
2. Enable **"Lead Generation"** product
3. Go to **"Webhooks"**

### Step 4: Configure Webhook

1. Click **"Add Webhook Endpoint"**
2. Enter:
   - **URL:**
     ```
     https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/webhooks/tiktok
     ```
   - **Events:** Select `lead.create`

3. **Copy Webhook Secret** (for signature verification)

### Step 5: Set Cloudflare Secrets

```bash
cd backend

# TikTok Webhook Secret
pnpm wrangler secret put TIKTOK_WEBHOOK_SECRET
# Paste: your-webhook-secret

# TikTok Access Token (from app credentials)
pnpm wrangler secret put TIKTOK_ACCESS_TOKEN
# Paste: your-access-token
```

### Step 6: Create Lead Gen Campaign

1. In TikTok Ads Manager, create campaign
2. Select **"Lead Generation"** objective
3. Configure Instant Form
4. Publish campaign

### Step 7: Test Integration

1. Preview your TikTok ad form
2. Submit test lead
3. Webhook should fire
4. Check logs and admin dashboard

### TikTok Configuration Summary

| Setting | Value |
|---------|-------|
| Webhook URL | `https://.../api/webhooks/tiktok` |
| Event | `lead.create` |
| Signature Verification | HMAC SHA-256 |

---

## 9. Gmail

### Overview
Read and process Gmail messages with autonomous review.

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **"Select a Project" → "New Project"**
3. Name: "SuperHuman CRM Gmail"
4. Click **"Create"**

### Step 2: Enable Gmail API

1. Go to **"APIs & Services" → "Library"**
2. Search for **"Gmail API"**
3. Click **"Enable"**

### Step 3: Create OAuth Credentials

1. Go to **"APIs & Services" → "Credentials"**
2. Click **"Create Credentials" → "OAuth client ID"**
3. If needed, configure OAuth consent screen:
   - User Type: **External**
   - App name: **SuperHuman CRM**
   - Scopes: Add `gmail.readonly` and `gmail.modify`

4. Application type: **Web application**
5. Name: **SuperHuman CRM Gmail Client**
6. Authorized redirect URIs:
   ```
   https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/oauth/gmail/callback
   ```

7. Click **"Create"**
8. **Download JSON** or copy Client ID and Client Secret

### Step 4: Set Cloudflare Secrets

```bash
cd backend

# Gmail OAuth Client ID
pnpm wrangler secret put GMAIL_CLIENT_ID
# Paste: your-client-id.apps.googleusercontent.com

# Gmail OAuth Client Secret
pnpm wrangler secret put GMAIL_CLIENT_SECRET
# Paste: your-client-secret
```

### Step 5: Configure Gmail Integration Settings

In `backend/wrangler.jsonc`, add:

```json
{
  "vars": {
    "GMAIL_AUTONOMOUS_ENABLED": "true",
    "GMAIL_AUTONOMOUS_ORGS": "default-org,org-2",
    "GMAIL_AUTONOMOUS_QUERY": "in:inbox is:unread",
    "GMAIL_AUTONOMOUS_MAX_RESULTS": "10"
  }
}
```

Deploy:
```bash
pnpm wrangler deploy
```

### Step 6: Connect Gmail Account

1. Navigate to:
   ```
   https://tanstack-start-cloudflare-frontend.glyfo.workers.dev/connections
   ```

2. Click **"Connect Gmail"**
3. Sign in with Google account
4. Authorize access to Gmail
5. You'll be redirected back

### Step 7: Test Autonomous Review

The system runs every 15 minutes via cron trigger.

Manual test:
```bash
# Trigger autonomous review manually
curl -X POST "https://tanstack-start-cloudflare-backend.glyfo.workers.dev/api/test/gmail-review" \
  -H "X-Org-ID: default-org"
```

### Gmail Configuration Summary

| Setting | Value |
|---------|-------|
| OAuth Callback | `https://.../api/oauth/gmail/callback` |
| Scopes | `gmail.readonly`, `gmail.modify` |
| Cron Schedule | `*/15 * * * *` (every 15 minutes) |
| Query | `in:inbox is:unread` |

---

## Testing Integrations

### Health Check Endpoints

Check all integrations are configured:

```bash
# Overall health
curl https://tanstack-start-cloudflare-backend.glyfo.workers.dev/health

# Webhook status
curl https://tanstack-start-cloudflare-backend.glyfo.workers.dev/health/webhooks

# API configuration
curl https://tanstack-start-cloudflare-backend.glyfo.workers.dev/health/apis
```

### Test Individual Channels

**WhatsApp:**
```bash
# Send test message to your WhatsApp Business number
# Check: /admin/channels dashboard
```

**Slack:**
```bash
# In Slack: @SuperHuman CRM test message
```

**Discord:**
```bash
# In Discord: @SuperHuman CRM test message
```

**Telegram:**
```bash
# Message your bot: /start
# Then: test message
```

**SMS:**
```bash
# Text your Twilio number
```

**Email:**
```bash
echo "Test" | mail -s "Test" support@yourdomain.com
```

### Admin Dashboard Monitoring

Check all channels:
```
https://tanstack-start-cloudflare-frontend.glyfo.workers.dev/admin/channels
```

You should see:
- ✅ Channel health status
- 📊 Message counts
- 🔴 Error indicators
- ⏱️ Last activity timestamps

---

## Troubleshooting

### General Issues

**Problem: Webhook not receiving messages**

✅ **Solution:**
1. Check webhook URL is correct
2. Verify secrets are set: `pnpm wrangler secret list`
3. Check logs: `pnpm wrangler tail`
4. Test webhook endpoint: `curl https://.../health/webhooks`

**Problem: 401 Unauthorized**

✅ **Solution:**
1. Regenerate access tokens
2. Verify secrets match exactly
3. Check token hasn't expired

**Problem: Signature verification failed**

✅ **Solution:**
1. Verify app secret is correct
2. Check webhook secret matches
3. Ensure no extra whitespace in secrets

### WhatsApp Issues

**Problem: Message not delivered**

```bash
# Check phone number is verified
# Verify template message is approved (for first 24 hours)
# Check rate limits aren't exceeded
```

**Problem: Webhook verification failed**

```bash
# Verify token must match exactly
# Check URL is publicly accessible
# Ensure HTTPS (not HTTP)
```

### Slack Issues

**Problem: Bot not responding**

```bash
# Verify bot is in the channel: /invite @bot
# Check Event Subscriptions are enabled
# Verify bot scopes include message permissions
```

### Discord Issues

**Problem: Interactions not working**

```bash
# Verify public key is correct
# Check interactions endpoint URL
# Ensure Message Content Intent is enabled
```

### Telegram Issues

**Problem: Webhook not working**

```bash
# Check webhook is set
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Delete and reset webhook
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://.../api/webhooks/telegram"
```

### Email Issues

**Problem: Emails not received**

```bash
# Check MX records are set correctly
dig MX yourdomain.com

# Verify Email Routing is enabled in Cloudflare
# Check route is configured to send to worker
```

### Gmail Issues

**Problem: OAuth authorization fails**

```bash
# Check redirect URI matches exactly
# Verify OAuth consent screen is published
# Ensure scopes are granted
```

---

## Security Best Practices

### 1. Rotate Secrets Regularly

```bash
# Rotate tokens every 90 days
pnpm wrangler secret put WHATSAPP_ACCESS_TOKEN
pnpm wrangler secret put SLACK_BOT_TOKEN
# etc.
```

### 2. Verify Webhook Signatures

All webhooks verify signatures automatically:
- WhatsApp: HMAC SHA-256
- Slack: HMAC SHA-256
- Discord: Ed25519
- Telegram: Hash verification
- Facebook: HMAC SHA-1

### 3. Use HTTPS Only

All webhook URLs use HTTPS - HTTP webhooks will be rejected.

### 4. Rate Limiting

Configured per channel:
- WhatsApp: 60 msg/min
- Slack: 100 msg/min
- Discord: 50 msg/min
- Telegram: 30 msg/min

### 5. Monitor for Anomalies

Check admin dashboard regularly:
- Unusual spike in messages
- High error rates
- Failed authentications

---

## Environment Variables Summary

Complete list of all required secrets:

```bash
# WhatsApp
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_VERIFY_TOKEN
FACEBOOK_APP_SECRET

# Slack
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET

# Discord
DISCORD_BOT_TOKEN
DISCORD_PUBLIC_KEY
DISCORD_APPLICATION_ID

# Telegram
TELEGRAM_BOT_TOKEN

# Twilio SMS
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER

# Facebook/Instagram
FACEBOOK_PAGE_ACCESS_TOKEN
INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_VERIFY_TOKEN

# TikTok
TIKTOK_WEBHOOK_SECRET
TIKTOK_ACCESS_TOKEN

# Gmail
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
```

---

## Quick Setup Checklist

Use this checklist to track your integration progress:

- [ ] WhatsApp
  - [ ] Created Facebook app
  - [ ] Got permanent access token
  - [ ] Configured webhook
  - [ ] Set Cloudflare secrets
  - [ ] Tested message flow

- [ ] Slack
  - [ ] Created Slack app
  - [ ] Configured bot permissions
  - [ ] Enabled Event Subscriptions
  - [ ] Set secrets
  - [ ] Invited bot to channels

- [ ] Discord
  - [ ] Created Discord app
  - [ ] Created bot
  - [ ] Enabled intents
  - [ ] Set interactions endpoint
  - [ ] Invited to server

- [ ] Telegram
  - [ ] Created bot with BotFather
  - [ ] Set webhook
  - [ ] Configured secrets
  - [ ] Tested messages

- [ ] Twilio SMS
  - [ ] Created Twilio account
  - [ ] Purchased phone number
  - [ ] Configured webhook
  - [ ] Set secrets

- [ ] Email
  - [ ] Enabled Email Routing
  - [ ] Configured routing rules
  - [ ] Tested delivery

- [ ] Facebook/Instagram
  - [ ] Created Facebook app
  - [ ] Connected Page/Instagram
  - [ ] Configured webhooks
  - [ ] Set secrets

- [ ] TikTok
  - [ ] Created developer app
  - [ ] Enabled Lead Generation
  - [ ] Configured webhook
  - [ ] Set secrets

- [ ] Gmail
  - [ ] Created Google Cloud project
  - [ ] Enabled Gmail API
  - [ ] Created OAuth credentials
  - [ ] Connected account

---

## Support & Additional Resources

### Documentation Links

- **WhatsApp:** https://developers.facebook.com/docs/whatsapp
- **Slack:** https://api.slack.com/docs
- **Discord:** https://discord.com/developers/docs
- **Telegram:** https://core.telegram.org/bots/api
- **Twilio:** https://www.twilio.com/docs/sms
- **Cloudflare Email:** https://developers.cloudflare.com/email-routing
- **Gmail API:** https://developers.google.com/gmail/api

### System Documentation

- Architecture: `docs/ARCHITECTURE.md`
- OpenClaw Patterns: `docs/OPENCLAW-PATTERNS-IMPLEMENTED.md`
- Admin UI Guide: `docs/ADMIN-UI-GUIDE.md`
- API Reference: `docs/IMPLEMENTATION-STATUS.md`

### Getting Help

1. Check logs: `pnpm wrangler tail`
2. Check health: `https://.../health`
3. Review admin dashboard: `https://.../admin/channels`
4. Check webhook status: `https://.../health/webhooks`

---

**Document Status:** ✅ Complete - All 10+ Integrations Covered
**Last Updated:** February 17, 2026
**Version:** 1.0
