# CRM MVP - Social Media Integration TODO List

## 📋 Overview

This document outlines the implementation plan for integrating Meta Facebook Lead Ads, WhatsApp Business API, and TikTok Lead Generation into the CRM MVP. Tasks are ordered from simplest to most complex, ensuring compatibility with the current Cloudflare stack architecture.

**Current Status:**
- ✅ TikTok Lead Generation - Partially implemented (webhook handler exists)
- ⏳ Meta Facebook Lead Ads - Not started
- ⏳ WhatsApp Business API - Not started

**Architecture:** All integrations use Durable Objects for storage, Cloudflare Workers for webhooks, and follow the existing patterns established in `src/server/webhooks/tiktok.ts` and `src/server/durable-objects/TikTokLeadDO.ts`.

---

## 🎯 Phase 1: Foundation & Configuration (Simple)

### 1.1 Environment Setup
- [ ] **Add environment variables to wrangler.jsonc**
  - `FACEBOOK_APP_SECRET` - For webhook signature verification
  - `FACEBOOK_PAGE_ACCESS_TOKEN` - For Lead Ads API access
  - `WHATSAPP_VERIFY_TOKEN` - For webhook verification
  - `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp Business phone number
  - `WHATSAPP_ACCESS_TOKEN` - WhatsApp API access token
  - `TIKTOK_WEBHOOK_SECRET` - Already exists, verify implementation
  - Files: `wrangler.jsonc`, `worker-configuration.d.ts`

- [ ] **Create environment variable documentation**
  - Document how to obtain each token/secret from Meta Business Manager
  - Add setup guides for TikTok, Facebook, WhatsApp
  - Files: `docs/guides/SOCIAL_MEDIA_SETUP.md`

- [ ] **Update TypeScript types for environment**
  - Add `Env` interface extensions for new secrets
  - Files: `worker-configuration.d.ts`, `src/types/env.d.ts`

### 1.2 Security Implementation
- [ ] **Implement webhook signature verification**
  - Facebook uses HMAC-SHA256 with `X-Hub-Signature-256` header
  - WhatsApp uses same Meta signature format
  - TikTok uses HMAC-SHA256 (update existing placeholder)
  - Files: `src/server/utils/webhook-verification.ts`

- [ ] **Add rate limiting middleware**
  - Protect webhook endpoints from abuse
  - Use Durable Objects Alarms for rate limit tracking
  - Files: `src/server/middleware/rate-limiter.ts`

---

## 🎯 Phase 2: TikTok Enhancement (Medium)

### 2.1 Complete TikTok Implementation
- [ ] **Fix webhook signature verification**
  - Replace placeholder in `verifyTikTokSignature()` with Web Crypto API implementation
  - Test with actual TikTok webhook payloads
  - Files: `src/server/webhooks/tiktok.ts`

- [ ] **Implement deduplication logic**
  - Use KV namespace to track seen email/phone combinations
  - Add 30-day TTL for deduplication records
  - Update `deduplicateLead()` function
  - Files: `src/server/webhooks/tiktok.ts`, `src/server/utils/deduplication.ts`

- [ ] **Add TikTok webhook endpoint to router**
  - Route `POST /webhooks/tiktok` to `handleTikTokWebhook()`
  - Add CORS headers for TikTok webhook calls
  - Files: `src/entry.cloudflare.ts`

- [ ] **Create TikTok setup documentation**
  - How to set up TikTok Lead Generation forms
  - Configure webhook URL in TikTok Business Center
  - Test webhook delivery
  - Files: `docs/guides/TIKTOK_SETUP.md`

### 2.2 TikTok Lead Management
- [ ] **Add TikTok lead dashboard UI component**
  - Display leads from TikTok in chat interface
  - Show campaign, creative, video metadata
  - Files: `src/components/chat/TikTokLeadCard.tsx`

- [ ] **Create TikTok analytics workflow**
  - Track lead count by campaign/video
  - Calculate conversion rate from lead to qualified
  - Files: `src/server/workflows/tiktok-analytics-workflow.ts`

---

## 🎯 Phase 3: Meta Facebook Lead Ads (Medium)

### 3.1 Facebook Webhook Handler
- [ ] **Create Facebook webhook handler**
  - Handle `leadgen` webhook events
  - Parse lead form fields
  - Extract contact information
  - Files: `src/server/webhooks/facebook.ts`

- [ ] **Implement Facebook Lead Ads API client**
  - Fetch lead details using Graph API
  - Get form structure and field mappings
  - Handle pagination for bulk lead retrieval
  - Files: `src/server/services/facebook-api.ts`

- [ ] **Create FacebookLeadDO Durable Object**
  - Similar structure to `TikTokLeadDO`
  - Store lead data, form fields, ad metadata
  - Track lead source (campaign_id, adset_id, ad_id)
  - Files: `src/server/durable-objects/FacebookLeadDO.ts`

### 3.2 Facebook Integration
- [ ] **Add Facebook webhook endpoint**
  - `GET /webhooks/facebook` - Webhook verification
  - `POST /webhooks/facebook` - Lead creation events
  - Verify token matches `FACEBOOK_VERIFY_TOKEN`
  - Files: `src/entry.cloudflare.ts`

- [ ] **Implement lead field mapping**
  - Map Facebook custom fields to CRM fields
  - Support multiple form templates
  - Handle custom questions
  - Files: `src/server/services/facebook-field-mapper.ts`

- [ ] **Connect to lead qualification workflow**
  - Auto-create `LeadQualificationDO` for each Facebook lead
  - Extract BANT data from custom fields
  - Link to `EnhancedConversationDO`
  - Files: `src/server/webhooks/facebook.ts`

### 3.3 Facebook Lead Management
- [ ] **Create Facebook lead UI card**
  - Display Facebook lead data in chat
  - Show ad campaign, creative preview
  - Quick actions: qualify, contact, archive
  - Files: `src/components/chat/FacebookLeadCard.tsx`

- [ ] **Add Facebook Conversions API integration**
  - Send lead events back to Facebook
  - Track conversion from lead to qualified/customer
  - Optimize ad delivery for quality leads
  - Files: `src/server/services/facebook-conversions-api.ts`

- [ ] **Create Facebook setup documentation**
  - App creation and permissions
  - Webhook configuration
  - Page access token generation
  - Files: `docs/guides/FACEBOOK_LEAD_ADS_SETUP.md`

---

## 🎯 Phase 4: WhatsApp Business API (Complex)

### 4.1 WhatsApp Webhook Handler
- [ ] **Create WhatsApp webhook handler**
  - Handle incoming messages (text, media, location)
  - Process message status updates (sent, delivered, read)
  - Handle user profile information
  - Files: `src/server/webhooks/whatsapp.ts`

- [ ] **Implement WhatsApp message parsing**
  - Extract message type and content
  - Handle interactive messages (buttons, lists)
  - Parse media URLs and metadata
  - Files: `src/server/services/whatsapp-message-parser.ts`

- [ ] **Create WhatsAppConversationDO**
  - Manage WhatsApp conversation state per phone number
  - Store message history
  - Track conversation context for AI agent
  - Files: `src/server/durable-objects/WhatsAppConversationDO.ts`

### 4.2 WhatsApp Outbound Messaging
- [ ] **Implement WhatsApp Cloud API client**
  - Send text messages
  - Send template messages (for initial outreach)
  - Send media messages (images, documents)
  - Handle interactive messages
  - Files: `src/server/services/whatsapp-api.ts`

- [ ] **Create message template manager**
  - Store approved WhatsApp templates
  - Handle template parameter substitution
  - Track template approval status
  - Files: `src/server/services/whatsapp-templates.ts`

- [ ] **Add WhatsApp webhook endpoints**
  - `GET /webhooks/whatsapp` - Webhook verification
  - `POST /webhooks/whatsapp` - Incoming messages and status updates
  - Files: `src/entry.cloudflare.ts`

### 4.3 WhatsApp AI Agent Integration
- [ ] **Connect WhatsApp to ChatAgent**
  - Route WhatsApp messages to `ChatAgent` Durable Object
  - Maintain conversation context across messages
  - Handle 24-hour messaging window policy
  - Files: `src/server/webhooks/whatsapp.ts`, `src/server/agents/chat-agent.ts`

- [ ] **Implement WhatsApp-specific agent tools**
  - `sendWhatsAppMessage` - Send reply to user
  - `sendWhatsAppTemplate` - Send pre-approved template
  - `markMessageAsRead` - Update message status
  - `getWhatsAppProfile` - Fetch user profile info
  - Files: `src/server/tools/whatsapp-tools.ts`

- [ ] **Add conversation handoff workflow**
  - Auto-qualify leads via WhatsApp conversation
  - Escalate to human agent when needed
  - Transfer conversation with full context
  - Files: `src/server/workflows/whatsapp-handoff-workflow.ts`

### 4.4 WhatsApp UI Integration
- [ ] **Create WhatsApp conversation UI**
  - Chat-style interface for WhatsApp messages
  - Show message status (sent, delivered, read)
  - Support media preview
  - Files: `src/components/chat/WhatsAppConversationCard.tsx`

- [ ] **Add WhatsApp message composer**
  - Send messages to contacts via WhatsApp
  - Template selector with parameter input
  - Media upload support
  - Files: `src/components/chat/WhatsAppComposer.tsx`

- [ ] **Create WhatsApp setup documentation**
  - Meta Business account setup
  - WhatsApp Business API access
  - Phone number registration and verification
  - Template creation and approval process
  - Files: `docs/guides/WHATSAPP_SETUP.md`

---

## 🎯 Phase 5: Cross-Platform Features (Complex)

### 5.1 Unified Lead Management
- [ ] **Create unified lead aggregator**
  - Consolidate leads from TikTok, Facebook, WhatsApp
  - Deduplicate across platforms using email/phone
  - Merge lead data from multiple sources
  - Files: `src/server/services/unified-lead-aggregator.ts`

- [ ] **Add lead source attribution**
  - Track which platform generated each lead
  - Calculate ROI by platform
  - Store UTM parameters and campaign data
  - Files: `src/server/workflows/lead-attribution-workflow.ts`

- [ ] **Create universal lead scoring**
  - Score leads based on source quality
  - Weight by platform (TikTok, Facebook, WhatsApp)
  - Factor in engagement and response time
  - Files: `src/server/services/lead-scoring.ts`

### 5.2 Analytics & Reporting
- [ ] **Build social media analytics dashboard**
  - Lead volume by platform
  - Conversion rate by source
  - Average qualification time
  - Files: `src/components/analytics/SocialMediaDashboard.tsx`

- [ ] **Create KV-based analytics storage**
  - Store daily metrics per platform
  - Track trends over time
  - Export to CSV/JSON
  - Files: `src/server/services/analytics-storage.ts`

- [ ] **Add real-time notification system**
  - Alert on new high-quality leads
  - Notify on webhook failures
  - Track API quota usage
  - Files: `src/server/workflows/notification-workflow.ts`

### 5.3 Automation Workflows
- [ ] **Build auto-response workflow**
  - Send immediate confirmation message
  - Deliver lead magnet or resource
  - Schedule follow-up reminders
  - Files: `src/server/workflows/auto-response-workflow.ts`

- [ ] **Create lead routing workflow**
  - Assign leads to sales reps based on rules
  - Round-robin or territory-based assignment
  - Consider rep availability and workload
  - Files: `src/server/workflows/lead-routing-workflow.ts`

- [ ] **Implement lead nurture sequences**
  - Multi-step drip campaigns via WhatsApp/Email
  - Triggered by lead actions and time delays
  - Track engagement and adjust cadence
  - Files: `src/server/workflows/nurture-workflow.ts`

---

## 🎯 Phase 6: Testing & Documentation (Critical)

### 6.1 Testing Infrastructure
- [ ] **Create webhook testing suite**
  - Mock webhook payloads for all platforms
  - Test signature verification
  - Validate error handling
  - Files: `src/server/__tests__/webhooks/*.test.ts`

- [ ] **Add integration tests**
  - End-to-end lead capture flow
  - Test deduplication logic
  - Verify Durable Object state management
  - Files: `src/server/__tests__/integration/social-media.test.ts`

- [ ] **Create webhook testing scripts**
  - Send test webhooks to local dev server
  - Simulate Facebook, WhatsApp, TikTok events
  - Files: `backend/scripts/test-webhooks/`

### 6.2 Documentation
- [ ] **Write API integration guide**
  - Architecture overview
  - Data flow diagrams
  - Security best practices
  - Files: `docs/reference/SOCIAL_MEDIA_ARCHITECTURE.md`

- [ ] **Create troubleshooting guide**
  - Common webhook issues
  - Token expiration handling
  - Rate limit errors
  - Files: `docs/guides/SOCIAL_MEDIA_TROUBLESHOOTING.md`

- [ ] **Document webhook endpoints**
  - Request/response formats
  - Required headers
  - Error codes and handling
  - Files: `docs/reference/WEBHOOK_API.md`

### 6.3 Monitoring & Maintenance
- [ ] **Add logging and observability**
  - Log all webhook events
  - Track processing time and errors
  - Monitor Durable Object performance
  - Files: `src/server/utils/logger.ts` (enhance existing)

- [ ] **Create health check endpoints**
  - `/health/webhooks` - Check webhook availability
  - `/health/apis` - Verify external API connections
  - Files: `src/entry.cloudflare.ts`

- [ ] **Set up error alerting**
  - Notify on webhook failures
  - Alert on API quota exhaustion
  - Track Durable Object errors
  - Files: `src/server/services/error-alerting.ts`

---

## 📊 Implementation Priority Matrix

### Must Have (MVP Launch)
1. ✅ Environment configuration (Phase 1.1)
2. ✅ Webhook security (Phase 1.2)
3. ✅ Complete TikTok integration (Phase 2.1)
4. ✅ Facebook Lead Ads webhook (Phase 3.1)
5. ✅ Basic testing suite (Phase 6.1)

### Should Have (Post-MVP)
6. ⏳ WhatsApp basic messaging (Phase 4.1, 4.2)
7. ⏳ Unified lead management (Phase 5.1)
8. ⏳ Facebook Conversions API (Phase 3.3)
9. ⏳ Lead scoring (Phase 5.1)
10. ⏳ Documentation (Phase 6.2)

### Nice to Have (Future Enhancement)
11. 🔮 WhatsApp AI agent (Phase 4.3)
12. 🔮 Advanced analytics (Phase 5.2)
13. 🔮 Automation workflows (Phase 5.3)
14. 🔮 Lead nurture sequences (Phase 5.3)
15. 🔮 Advanced monitoring (Phase 6.3)

---

## 🏗️ Architecture Patterns

### Webhook Handler Pattern
All webhook handlers follow this structure:
```typescript
// src/server/webhooks/{platform}.ts
export async function handle{Platform}Webhook(request: Request, env: Env): Promise<Response> {
  // 1. Verify signature
  // 2. Parse payload
  // 3. Get/create Durable Object
  // 4. Process lead data
  // 5. Trigger workflows
  // 6. Return response
}
```

### Durable Object Pattern
Lead storage Durable Objects follow:
```typescript
// src/server/durable-objects/{Platform}LeadDO.ts
export class {Platform}LeadDO {
  // - Initialize SQL schema
  // - upsertLead() - Create/update lead
  // - getData() - Retrieve lead info
  // - linkQualificationDO() - Connect to qualification
  // - markDuplicate() - Handle deduplication
}
```

### Integration Workflow Pattern
```typescript
// src/server/workflows/{platform}-workflows.ts
export async function process{Platform}Lead(env: Env, leadData: LeadData) {
  // 1. Create lead DO
  // 2. Create qualification DO
  // 3. Create opportunity DO
  // 4. Trigger auto-response
  // 5. Sync to analytics
}
```

---

## 🔐 Security Best Practices

### Webhook Verification
1. **Always verify signatures** - Reject requests with invalid signatures
2. **Use environment variables** - Never hardcode secrets
3. **Implement replay protection** - Check timestamp headers
4. **Rate limit aggressively** - Protect against abuse

### Token Management
1. **Rotate tokens regularly** - Use Meta's token rotation API
2. **Use minimal scopes** - Only request necessary permissions
3. **Store securely** - Use Cloudflare Secrets for production
4. **Monitor expiration** - Alert before tokens expire

### Data Protection
1. **Encrypt sensitive data** - Use Cloudflare's encryption at rest
2. **Minimize data retention** - Delete old leads per policy
3. **Audit access** - Log all lead data access
4. **GDPR compliance** - Support data deletion requests

---

## 📚 External Resources

### Meta Facebook Lead Ads
- [Facebook Lead Ads API Essentials](https://rollout.com/integration-guides/facebook-lead-ads/api-essentials)
- [Facebook Lead Generation API Developer Guide](https://leadsync.me/blog/meta-lead-gen-api-guide/)
- [Facebook Lead Ads Integration Ultimate Guide 2025](https://leadsync.me/blog/facebook-lead-ads-integration-ultimate-guide/)
- [Checklist for Facebook Lead Ads API Setup](https://www.reform.app/blog/checklist-for-facebook-lead-ads-api-setup)

### WhatsApp Business API
- [WhatsApp API 2026: Complete Integration Guide - Unipile](https://www.unipile.com/whatsapp-api-a-complete-guide-to-integration/)
- [WhatsApp Cloud API: Setup & Cost Guide (2026)](https://chatarmin.com/en/blog/whatsapp-cloudapi)
- [How to Get WhatsApp API Access in 2026](https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-access/)
- [WhatsApp Business API Guide 2026](https://trengo.com/blog/whatsapp-business-api-guide)
- [How to Set Up WhatsApp Business API](https://www.socialintents.com/blog/how-to-set-up-whatsapp-business-api/)

### TikTok Lead Generation
- [TikTok Lead Generation API Documentation](https://business-api.tiktok.com/portal/docs?id=1747719780398082)
- Current implementation: `src/server/webhooks/tiktok.ts`

---

## ✅ Acceptance Criteria

### For Each Platform Integration
- [ ] Webhook receives and processes events successfully
- [ ] Signature verification passes for all requests
- [ ] Lead data is stored in Durable Object
- [ ] Deduplication prevents duplicate leads
- [ ] Integration with LeadQualificationDO works
- [ ] UI displays platform-specific lead cards
- [ ] Tests cover happy path and error cases
- [ ] Documentation includes setup guide
- [ ] Error logging captures all failures
- [ ] Performance meets SLA (<500ms webhook response)

---

## 🚀 Getting Started

1. **Start with Phase 1**: Set up environment variables and security
2. **Complete TikTok**: Finish the partially implemented TikTok integration
3. **Add Facebook**: Implement Facebook Lead Ads (most similar to TikTok)
4. **Tackle WhatsApp**: Build WhatsApp integration (most complex)
5. **Unify**: Connect all platforms with cross-platform features
6. **Test & Document**: Ensure production readiness

**Estimated Timeline:**
- Phase 1: 1-2 days
- Phase 2: 2-3 days
- Phase 3: 3-4 days
- Phase 4: 5-7 days
- Phase 5: 4-5 days
- Phase 6: 2-3 days

**Total: ~3-4 weeks for full implementation**

---

*Last Updated: 2026-01-19*
*Architecture: Cloudflare Workers + Durable Objects + AI SDK*
*Framework: TanStack React Start*
