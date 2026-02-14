# Quick Start - Deploy & Test

## 🚀 Deploy in 5 Minutes

### 1. Set Secrets (First Time Only)
```bash
wrangler secret put TIKTOK_WEBHOOK_SECRET
# Enter your TikTok webhook secret

wrangler secret put ORGANIZATION_ID
# Enter your org ID (or use 'default-org')
```

### 2. Deploy
```bash
pnpm deploy
```

Your app will be deployed to: `https://your-app.workers.dev`

### 3. Test Webhook
```bash
# Easy way (with test script)
./backend/scripts/test-webhook.sh https://your-app.workers.dev/api/webhooks/tiktok your-secret

# Manual way (with curl)
curl -X POST https://your-app.workers.dev/api/webhooks/tiktok \
  -H "Content-Type: application/json" \
  -d @test-tiktok-webhook.json
```

### 4. View Logs
```bash
wrangler tail
```

Look for:
- ✓ `[TikTokWebhook] Webhook received`
- ✓ `[LeadQualificationDO] Initialized`
- ✓ `[OpportunityDO] Initialized`
- ✓ `[TikTokWebhook] Opportunity created`

---

## 🎯 What Gets Created

Each TikTok lead creates:

1. **LeadQualificationDO** - BANT scoring
2. **OpportunityDO** - Pipeline tracking (NEW!)
3. **EnhancedConversationDO** - AI conversation

---

## 📊 Expected Flow

```
TikTok Lead
  ↓
Webhook POST
  ↓
LeadQualificationDO (Score: 0-100)
  ↓
OpportunityDO (Stage: lead, Probability: 10%)
  ↓
Auto-transitions based on score
```

---

## 🔍 Troubleshooting

**401 Error?**
- Check webhook secret matches TikTok config

**500 Error?**
- Check `wrangler tail` for details
- Verify all DOs are bound in wrangler.jsonc

**No logs?**
- Make sure you deployed: `pnpm deploy`
- Check worker is active in Cloudflare dashboard

---

## 📚 Full Documentation

- **Deployment**: See `DEPLOYMENT_STEPS.md`
- **TikTok Integration**: See `TIKTOK_INTEGRATION_SUMMARY.md`
- **Opportunity Pipeline**: See `OPPORTUNITY_PIPELINE_SUMMARY.md`

---

## ✅ Success Checklist

- [ ] Secrets configured
- [ ] Deployed successfully
- [ ] Test webhook returns 200
- [ ] Logs show opportunity created
- [ ] TikTok webhook configured (production)

---

**Ready to go? Run:** `pnpm deploy` 🚀
