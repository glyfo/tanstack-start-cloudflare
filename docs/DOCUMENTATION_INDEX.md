# Documentation Index

## 📚 Essential Documentation

### 1. **[Main README](../README.md)** - Project Overview
**What it covers:**
- Project description and features
- Architecture overview
- Getting started guide
- Tech stack and deployment
- UI components overview

**When to read:** First thing - understand what the project is about

---

### 2. **[UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)** - Design System Reference ⭐ MANDATORY
**What it covers:**
- Complete color palette (stone-*, gray-*, sky-*)
- Typography standards
- Spacing and layout patterns
- Component patterns (cards, buttons, forms, icons)
- Design checklist
- Accessibility guidelines

**When to read:** Before creating ANY new UI component

---

### 3. **[Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)** - Forms & Interactions
**What it covers:**
- How to use ContactFormCard and OpportunityFormCard
- Validation rules and patterns
- Progressive disclosure patterns
- User flow examples
- Integration with ChatEngine
- Best practices for forms

**When to read:** When implementing interactive forms or user inputs

---

### 4. **[Interactive CRM Complete](guides/INTERACTIVE_CRM_COMPLETE.md)** - Implementation Overview
**What it covers:**
- Complete feature list
- Before/after comparisons
- User flow examples
- Technical implementation details
- Benefits and results

**When to read:** To understand the full scope of the CRM implementation

---

### 5. **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - Quick Lookup
**What it covers:**
- Import statements
- Component prop types
- Common patterns
- Code snippets
- Quick examples
- Debug tips

**When to read:** When coding - quick reference for syntax and patterns

---

### 6. **[Quick Start](guides/QUICK_START.md)** - Rapid Setup
**What it covers:**
- Quick start commands
- Environment setup
- Development workflow
- Common tasks

**When to read:** When setting up the project for the first time

---

### 7. **[MCP Apps Pattern](guides/MCP_APPS_PATTERN.md)** - Component Development ⭐ MANDATORY
**What it covers:**
- Direct tool invocation pattern
- Model context awareness
- Creating interactive card components
- Adding tools to registry
- Message types (tool-invoke, context-update)
- Integration with ChatEngine
- Complete implementation checklist

**When to read:** Before creating ANY new interactive card component

---

### 8. **[Social Media Setup](guides/SOCIAL_MEDIA_SETUP.md)** - OAuth Credentials Guide
**What it covers:**
- Meta Facebook Lead Ads setup (App, tokens, webhooks)
- WhatsApp Business API setup (phone numbers, templates)
- TikTok Lead Generation setup (app, webhooks)
- Setting production secrets with Wrangler
- Token rotation schedule
- Troubleshooting common issues

**When to read:** When setting up social media platform integrations

---

### 10. **[CRM MVP Social Media TODO](CRM_MVP_SOCIAL_MEDIA_TODO.md)** - Integration Roadmap
**What it covers:**
- Complete TODO list for social media integrations
- Implementation phases (TikTok, Facebook Lead Ads, WhatsApp)
- Architecture patterns and code structure
- Priority matrix and timeline estimates
- Acceptance criteria for each platform

**When to read:** When implementing social media integrations (Meta, TikTok, WhatsApp)

---

### 11. **[Social Media Best Practices](guides/SOCIAL_MEDIA_BEST_PRACTICES.md)** - Integration Guidelines
**What it covers:**
- Webhook signature verification patterns
- Token management and security
- Rate limiting strategies
- Deduplication and data storage
- Platform-specific best practices (Facebook, WhatsApp, TikTok)
- Error handling and monitoring
- Testing and production checklist

**When to read:** Before connecting to any social media platform APIs

---

## 🗂️ Documentation Organization

### For New Developers:
1. Start with **[Main README](../README.md)** - understand the project
2. Read **[Quick Start](guides/QUICK_START.md)** - get up and running
3. Review **[UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)** - learn the design system
4. Check **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - bookmark for quick lookups

### For UI/UX Work:
1. **[UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)** - design system (MANDATORY)
2. **[Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)** - forms and interactions
3. **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - code patterns

### For Feature Development:
1. **[Interactive CRM Complete](guides/INTERACTIVE_CRM_COMPLETE.md)** - understand what exists
2. **[MCP Apps Pattern](guides/MCP_APPS_PATTERN.md)** - component development pattern (MANDATORY)
3. **[Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)** - how forms work
4. **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - coding patterns
5. **[UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)** - stay consistent

### For Social Media Integration:
1. **[Social Media Setup](guides/SOCIAL_MEDIA_SETUP.md)** - OAuth credentials and setup
2. **[Social Media Best Practices](guides/SOCIAL_MEDIA_BEST_PRACTICES.md)** - security and patterns
3. **[Webhook API Reference](reference/WEBHOOK_API.md)** - endpoint contracts, async mode, response semantics
4. **[Social Media Architecture](reference/SOCIAL_MEDIA_ARCHITECTURE.md)** - idempotency, SocialHub ingestion, data flow
5. **[CRM MVP Social Media TODO](CRM_MVP_SOCIAL_MEDIA_TODO.md)** - implementation roadmap
6. **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - code patterns
7. **Review existing:** `backend/src/server/webhooks/tiktok.ts`, `backend/src/server/webhooks/facebook.ts`, `backend/src/server/webhooks/instagram.ts`

---

## 🎯 Quick Navigation

### Need to...

**Create a new interactive card?**
→ [MCP Apps Pattern](guides/MCP_APPS_PATTERN.md) ⭐ **MANDATORY**

**Create a new UI component?**
→ [UI Design Guidelines - Component Patterns](reference/UI_DESIGN_GUIDELINES.md#component-patterns)

**Add a form?**
→ [Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)

**Set up social media OAuth?**
→ [Social Media Setup](guides/SOCIAL_MEDIA_SETUP.md)

**Check color usage?**
→ [UI Design Guidelines - Color Palette](reference/UI_DESIGN_GUIDELINES.md#color-palette)

**See example code?**
→ [Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)

**Understand architecture?**
→ [Main README - Architecture](../README.md#architecture-overview)

**Learn about forms?**
→ [Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)

**See what's been built?**
→ [Interactive CRM Complete](guides/INTERACTIVE_CRM_COMPLETE.md)

**Integrate social media platforms?**
→ [Social Media Setup](guides/SOCIAL_MEDIA_SETUP.md) - OAuth credentials
→ [Social Media Best Practices](guides/SOCIAL_MEDIA_BEST_PRACTICES.md) - Patterns and security

---

## 📝 Documentation Principles

### ✅ DO:
- Include code examples
- Show before/after comparisons
- Provide visual descriptions
- Link related sections
- Use checklists
- Keep it practical

### ❌ DON'T:
- Duplicate information
- Write long essays
- Leave outdated examples
- Skip code snippets
- Overcomplicate

---

**Remember:** Great documentation is code that explains itself. Keep it simple, practical, and up-to-date!
