# Backend - TanStack Start Cloudflare

Backend workspace for the SuperHuman CRM application, deployed as a Cloudflare Worker.

## Directory Structure

```
backend/
├── src/                    # Source code
│   ├── entry.ts           # Worker entry point
│   ├── server/            # Server logic (agents, DOs, routes)
│   └── types/             # TypeScript type definitions
│
├── migrations/            # SQL migrations for D1 database
│   └── 0001_create_contacts_table.sql
│
├── scripts/               # Test and utility scripts
│   ├── test-agent.ts              # Test agent functionality
│   ├── test-intents.ts            # Test intent detection
│   ├── test-facebook-webhook.js   # Facebook webhook tests
│   ├── test-tiktok-webhook.js     # TikTok webhook tests
│   ├── test-whatsapp-webhook.js   # WhatsApp webhook tests
│   ├── test-phase5-features.js    # Phase 5 feature tests
│   └── test-webhook.sh            # Generic webhook test script
│
├── test-fixtures/         # Test data and fixtures
│   └── test-tiktok-webhook.json
│
├── package.json           # Backend dependencies
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Vitest test configuration
└── wrangler.jsonc         # Cloudflare Worker configuration

```

## Key Technologies

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: TanStack Start (SSR)
- **Agent SDK**: `@cloudflare/ai-chat` (AIChatAgent)
- **Database**: Durable Objects with SQLite storage
- **AI**: Workers AI (GLM-4.7-Flash)

## Durable Objects

This worker uses 9 Durable Objects for stateful coordination:

1. **ChatAgent** - Main agent with WebSocket, LLM, persistence
2. **ContactDO** - Organization-scoped contact management
3. **OpportunityDO** - Sales pipeline management
4. **RateLimiterDO** - Rate limiting with sliding window
5. **SocialConnectionsDO** - OAuth token management
6. **LeadQualificationDO** - BANT-based lead scoring
7. **EnhancedConversationDO** - FSM with intent/sentiment tracking
8. **WhatsAppConversationDO** - WhatsApp conversation state
9. **SocialHubDO** - Social media integration hub

See `wrangler.jsonc` for full configuration.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Test webhooks
./scripts/test-webhook.sh <endpoint> <secret>
node scripts/test-tiktok-webhook.js
node scripts/test-facebook-webhook.js

# Test intents
pnpm tsx scripts/test-intents.ts
```

## Deployment

```bash
# Deploy to Cloudflare
wrangler deploy

# Set secrets
wrangler secret put FACEBOOK_APP_SECRET
wrangler secret put TIKTOK_APP_SECRET
```

## Environment Variables

See `.dev.vars.example` for required environment variables.

## Documentation

- **Architecture**: `/docs/ARCHITECTURE.md`
- **Setup Guide**: `/docs/PLATFORM-SETUP.md`
- **API Reference**: `/docs/reference/`

## Related

- Frontend: `../frontend/`
- Documentation: `../docs/`
