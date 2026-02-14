# SuperHuman CRM Documentation

Welcome to the SuperHuman CRM documentation! This guide will help you navigate all available documentation.

## 📚 Documentation Structure

```
docs/
├── README.md                          ← You are here
├── DOCUMENTATION_INDEX.md             ← Detailed navigation guide
├── guides/                            ← How-to guides and tutorials
│   ├── QUICK_START.md                ← Get started quickly
│   ├── INTERACTIVE_FORMS_GUIDE.md    ← Forms and user interactions
│   └── INTERACTIVE_CRM_COMPLETE.md   ← Complete implementation overview
└── reference/                         ← Technical reference docs
    ├── UI_DESIGN_GUIDELINES.md       ← Design system (MANDATORY)
    └── DEVELOPER_QUICK_REFERENCE.md  ← Code patterns and snippets
```

## 🚀 Quick Links

### For New Developers
1. **[Quick Start](guides/QUICK_START.md)** - Set up and run the project
2. **[Documentation Index](DOCUMENTATION_INDEX.md)** - Understand all available docs
3. **[UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)** - Learn the design system

### For UI/UX Work
1. **[UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)** ⭐ **MANDATORY**
2. **[Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)** - Forms and interactions
3. **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - Code patterns

### For Feature Development
1. **[Interactive CRM Complete](guides/INTERACTIVE_CRM_COMPLETE.md)** - What exists
2. **[Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)** - How forms work
3. **[Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)** - Coding patterns

## 📖 Documentation Categories

### Guides (How-To)
Located in `/docs/guides/` - Step-by-step instructions and tutorials

- **QUICK_START.md** - Environment setup, first run, common tasks
- **INTERACTIVE_FORMS_GUIDE.md** - Creating forms, validation, user flows
- **INTERACTIVE_CRM_COMPLETE.md** - Full feature overview with examples
- **MCP_APPS_PATTERN.md** - MCP Apps pattern for component development (MANDATORY for new cards)
- **SOCIAL_MEDIA_SETUP.md** - OAuth credentials for Facebook, WhatsApp, TikTok, Instagram

### Reference (Look-Up)
Located in `/docs/reference/` - Technical specifications and patterns

- **UI_DESIGN_GUIDELINES.md** - Colors, typography, components, patterns
- **DEVELOPER_QUICK_REFERENCE.md** - Imports, props, code snippets

### Workers AI Streaming
Located in `/docs/` - Implementation guides for Workers AI streaming

- **WORKERS-AI-STREAMING-GUIDE.md** - Complete streaming implementation guide
- **STREAMING-QUICK-REFERENCE.md** - One-page cheat sheet for streaming
- **STREAMING-TROUBLESHOOTING.md** - Debugging and problem-solving guide

## 🎯 Find What You Need

### "I want to..."

**Start developing**
→ [Quick Start Guide](guides/QUICK_START.md)

**Create a new interactive card**
→ [MCP Apps Pattern](guides/MCP_APPS_PATTERN.md) ⭐ **MANDATORY**

**Create a new UI component**
→ [UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md)

**Add a form**
→ [Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)

**Set up social media integrations**
→ [Social Media Setup Guide](guides/SOCIAL_MEDIA_SETUP.md)

**Configure OAuth credentials**
→ [Social Media Setup - Setting Secrets](guides/SOCIAL_MEDIA_SETUP.md#setting-production-secrets)

**Check color/styling**
→ [UI Design Guidelines - Color Palette](reference/UI_DESIGN_GUIDELINES.md#color-palette)

**See code examples**
→ [Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)

**Understand the architecture**
→ [Main README](../README.md)

**Learn about existing features**
→ [Interactive CRM Complete](guides/INTERACTIVE_CRM_COMPLETE.md)

**Implement AI streaming**
→ [Workers AI Streaming Guide](WORKERS-AI-STREAMING-GUIDE.md)

**Fix streaming issues**
→ [Streaming Troubleshooting](STREAMING-TROUBLESHOOTING.md)

**Quick streaming reference**
→ [Streaming Quick Reference](STREAMING-QUICK-REFERENCE.md)

## 🎨 Design System

The UI follows a strict design system documented in [UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md).

**Key colors:**
- Background: `#F5F5F0` (warm off-white)
- Text: `stone-*` family (900, 700, 600, 500, 400)
- Actions: `sky-500` / `sky-600` (blue)
- Structure: `gray-*` for borders and backgrounds

**Before creating any UI component, read the design guidelines!**

## 📱 Interactive Components

The CRM features interactive cards and forms for a modern conversational UI:

- **ContactCard** - Display contact info
- **OpportunityCard** - Show deals/opportunities
- **ContactFormCard** - Create/edit contacts inline
- **OpportunityFormCard** - Create/edit opportunities
- **ContactDetailView** - Full details without leaving chat

Learn more in [Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)

## 🔧 Development Workflow

1. Read [Quick Start](guides/QUICK_START.md) to set up
2. Review [UI Design Guidelines](reference/UI_DESIGN_GUIDELINES.md) before coding
3. Reference [Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md) while coding
4. Follow patterns from [Interactive Forms Guide](guides/INTERACTIVE_FORMS_GUIDE.md)

## 🆘 Getting Help

1. **Check the docs** - Start with [Documentation Index](DOCUMENTATION_INDEX.md)
2. **Search for patterns** - Use [Developer Quick Reference](reference/DEVELOPER_QUICK_REFERENCE.md)
3. **Review examples** - See [Interactive CRM Complete](guides/INTERACTIVE_CRM_COMPLETE.md)
4. **Check main README** - Architecture overview in [../README.md](../README.md)

## 📝 Contributing to Docs

When making changes to the project:

- **UI changes** → Update `reference/UI_DESIGN_GUIDELINES.md`
- **New components** → Update `reference/DEVELOPER_QUICK_REFERENCE.md`
- **New features** → Update `guides/INTERACTIVE_CRM_COMPLETE.md`
- **Form changes** → Update `guides/INTERACTIVE_FORMS_GUIDE.md`
- **Setup changes** → Update `guides/QUICK_START.md`

## ✅ Documentation Standards

All docs follow these principles:
- **Practical** - Focus on "how to" not "what is"
- **Examples** - Include code snippets and visuals
- **Organized** - Clear sections with headers
- **Searchable** - Keywords and cross-references
- **Up-to-date** - Reflects current implementation

---

**Need help navigating? See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for detailed guidance.**
