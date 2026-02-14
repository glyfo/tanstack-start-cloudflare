# SuperHuman CRM: Architecture & Evolution Plan

> Single source of truth for project structure, splitting strategy, and distributed agent vision.

**Last reviewed**: 2026-02-14

---

## Architecture Decision (Effective 2026-02-14)

Primary CRM chat remains on Cloudflare Agents + WebSocket.

### Non-Negotiable Defaults

1. Keep the existing `useAgent`/PartySocket connection model for primary chat sessions.
2. Keep chat orchestration, streaming, and tool execution in backend Agents and Durable Objects.
3. Do not migrate the core CRM chat runtime unless there is an explicit architecture decision with measured benefits and rollback steps.

### Change Control Checklist (Before Any Core Chat Migration)

1. Demonstrate equal or better streaming latency under production-like load.
2. Demonstrate no regression in tool invocation and multi-step workflow behavior.
3. Demonstrate parity for session continuity/reconnect behavior.
4. Provide a phased rollout plan with fast rollback path.
5. Update this document and `README.md` in the same change.

---

## 1. Actual State of the Codebase

### What exists today (single Worker)

```
src/
├── components/chat/        # 30 files, 7,578 lines total
│   ├── ChatEngine.tsx      # 1,467 lines ← THE REAL MONOLITH
│   ├── 22 card/form components (72-570 lines each)
│   ├── MessageContent.tsx, ThinkingIndicator.tsx, utils.tsx
│   └── SchemaForm.tsx (417 lines)
│
├── components/auth/        # LoginForm.tsx
├── components/settings/    # Settings UI
├── hooks/                  # useConnections.ts (single hook)
├── routes/                 # TanStack file-based routing
│
├── server/
│   ├── agents/
│   │   ├── chat-agent.ts           # 2,048 lines (orchestrator)
│   │   ├── services/               # 6 extracted services (1,079 lines total)
│   │   ├── interfaces/             # IChatAgent
│   │   ├── agent-state-machine.ts  # 194 lines
│   │   ├── chat-agent-types.ts     # 148 lines
│   │   └── chat-agent-storage.ts   # 169 lines
│   │
│   ├── tools/              # JSON-driven registry + executors
│   ├── durable-objects/    # 9 DO classes (5 bound, 7 orphaned exports)
│   ├── services/           # Platform APIs (facebook, whatsapp, gmail, oauth)
│   ├── webhooks/           # 4 handlers (tiktok, facebook, whatsapp, instagram)
│   ├── workflows/          # Conversational flows
│   ├── middleware/         # Rate limiter
│   ├── api/                # API endpoints
│   ├── schemas/            # Zod schemas
│   └── utils/              # Logger, dedup, webhook routing
│
├── entry.cloudflare.ts     # 308 lines - gateway router
├── types/                  # Shared types
└── styles/
```

### Key technical facts

| Fact | Detail |
|------|--------|
| **Base class** | `ChatAgent extends AIChatAgent<any, ChatAgentState>` from `@cloudflare/ai-chat` |
| **Message persistence** | `AIChatAgent` provides SQLite-backed persistence automatically |
| **Build** | Single Vite build → single Cloudflare Worker via `@cloudflare/vite-plugin` |
| **Server functions** | **Zero.** No `createServerFn` calls. Frontend only uses WebSocket via `useAgent`. |
| **Frontend coupling** | Only 2 `import type` statements from server (compile-time only) + WebSocket URL |
| **Entry point** | `entry.cloudflare.ts` routes: webhooks → OAuth → health → agents → TanStack SSR |
| **AI Model** | `@cf/zai-org/glm-4.7-flash` via Workers AI |

### Why splitting IS feasible

The previous version of this doc said "Cannot split." That was wrong. Here's why it can split:

1. **No server functions**: `grep -r "createServerFn\|createAPIFileRoute" src/` returns nothing. The frontend never calls the backend via RPC.

2. **Single integration point**: The only frontend→backend connection is:
   ```typescript
   // ChatEngine.tsx line 116
   const connection = useAgent({ agent: "ChatAgent", name: sessionId });
   ```
   This is a WebSocket connection to `/agents/ChatAgent/{sessionId}`. Point it at a different host and it works.

3. **Type-only imports**: The frontend imports only types from `@/server` — these are erased at compile time and create zero runtime dependency:
   ```typescript
   import type { ChatAgentState } from "@/server/agents/types";
   import type { CardType } from "@/server/agents/chat-agent-types";
   ```

4. **TanStack Start without server functions** is just SSR React. It can run as its own Worker that only serves HTML/JS/CSS.

---

## 2. Project Splitting Strategy

### The three options

```
┌─────────────────────────────────────────────────────────────┐
│  Option A: 2 Projects (Frontend + Backend)                  │
│  Simplest. Highest impact. Start here.                      │
│                                                              │
│  ┌─────────────┐         ┌───────────────────────────────┐ │
│  │  frontend/   │ ──WS──▶│  backend/                     │ │
│  │  TanStack SSR│         │  ChatAgent DO                 │ │
│  │  Worker      │         │  CRM DOs                      │ │
│  │              │         │  Webhooks (FB, WA, TT)        │ │
│  │              │         │  Tools, Services              │ │
│  │              │         │  Gmail, OAuth                 │ │
│  └─────────────┘         └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Option B: 3 Projects (Frontend + Core + Connectors)        │
│  Good balance. Connectors deploy independently.             │
│                                                              │
│  ┌─────────────┐         ┌───────────────────────────────┐ │
│  │  frontend/   │ ──WS──▶│  core/                        │ │
│  │  TanStack SSR│         │  ChatAgent DO                 │ │
│  │  Worker      │         │  ContactDO, OpportunityDO     │ │
│  │              │         │  Tools, Workflows             │ │
│  │              │         │  SocialConnectionsDO (tokens) │ │
│  └─────────────┘         └───────────────────────────────┘ │
│                                    ▲                        │
│                           Service Bindings                  │
│                                    │                        │
│                           ┌────────┴────────────────────┐  │
│                           │  connectors/                 │  │
│                           │  /webhooks/facebook          │  │
│                           │  /webhooks/whatsapp          │  │
│                           │  /webhooks/tiktok            │  │
│                           │  /webhooks/instagram         │  │
│                           │  /oauth/{platform}/*         │  │
│                           │  Gmail API calls             │  │
│                           └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Option C: 5 Projects (Full independence)                   │
│  Maximum isolation. Each connector deploys alone.           │
│                                                              │
│  ┌─────────────┐         ┌───────────────────────────────┐ │
│  │  frontend/   │ ──WS──▶│  core/                        │ │
│  └─────────────┘         │  ChatAgent, CRM DOs, Tools    │ │
│                           │  SocialConnectionsDO          │ │
│                           └───────┬──────────────────────┘ │
│                          Service Bindings                   │
│                     ┌─────────┼──────────┐                 │
│               ┌─────▼───┐ ┌──▼────┐ ┌───▼─────┐           │
│               │connector│ │connect│ │connector│           │
│               │-social/ │ │-gmail/│ │-agents/ │           │
│               │FB,WA,TT │ │       │ │Support  │           │
│               │Instagram│ │       │ │Health   │           │
│               └─────────┘ └───────┘ │Churn    │           │
│                                      └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Recommended: Option B (Frontend + Core + Connectors)

Option B is the sweet spot because:

| Criteria | Option A (2) | Option B (3) | Option C (5) |
|----------|:---:|:---:|:---:|
| **Effort to split** | Low | Medium | High |
| **Deploy frontend independently** | ✅ | ✅ | ✅ |
| **Deploy connectors independently** | ❌ | ✅ | ✅ |
| **Update WhatsApp without redeploying core** | ❌ | ✅ | ✅ |
| **Service Binding complexity** | None | 1 binding | 3+ bindings |
| **Shared secrets management** | Simple | Moderate | Complex |
| **Independent connector scaling** | ❌ | ✅ | ✅ |
| **Connector team can work in isolation** | ❌ | ✅ | ✅ |
| **Worth the overhead** | Yes | Yes | Only at scale |

Option A is a good first step if you want to start simple. Option C is premature — you don't have separate teams per connector yet, and the distributed agents (Support, Health, Churn) don't exist as features.

---

## 3. Monorepo Structure (Option B)

### Directory layout

```
superhuman-crm/
├── packages/
│   ├── frontend/                    # Deploys as: crm.example.com
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── chat/            # ChatEngine, cards, forms
│   │   │   │   ├── auth/
│   │   │   │   └── settings/
│   │   │   ├── hooks/
│   │   │   ├── routes/              # TanStack file-based routing
│   │   │   ├── styles/
│   │   │   └── entry.cloudflare.ts  # Only SSR, no backend routes
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── wrangler.jsonc           # Worker: superhuman-frontend
│   │   └── tsconfig.json
│   │
│   ├── core/                        # Deploys as: api.example.com
│   │   ├── src/
│   │   │   ├── agents/              # ChatAgent + services
│   │   │   ├── tools/               # Tool registry + executors
│   │   │   ├── durable-objects/     # ContactDO, OpportunityDO
│   │   │   ├── services/            # AI service, business logic
│   │   │   ├── workflows/           # Conversational flows
│   │   │   ├── middleware/          # Rate limiter
│   │   │   └── entry.ts             # Agent routes + health + API
│   │   ├── package.json
│   │   ├── wrangler.jsonc           # Worker: superhuman-core
│   │   └── tsconfig.json
│   │
│   ├── connectors/                  # Deploys as: hooks.example.com
│   │   ├── src/
│   │   │   ├── webhooks/            # facebook, whatsapp, tiktok, instagram
│   │   │   ├── oauth/               # OAuth start/callback handlers
│   │   │   ├── services/            # Platform API clients
│   │   │   │   ├── facebook-api.ts
│   │   │   │   ├── whatsapp-api.ts
│   │   │   │   ├── gmail-api.ts
│   │   │   │   └── token-encryption.ts
│   │   │   ├── tools/               # gmail-tools, whatsapp-tools
│   │   │   └── entry.ts             # Webhook routes + OAuth routes
│   │   ├── package.json
│   │   ├── wrangler.jsonc           # Worker: superhuman-connectors
│   │   └── tsconfig.json
│   │
│   └── shared/                      # NOT deployed — shared types only
│       ├── src/
│       │   ├── types/
│       │   │   ├── agent.types.ts   # ChatAgentState, CardType, etc.
│       │   │   ├── crm.types.ts     # Contact, Opportunity, etc.
│       │   │   ├── message.types.ts # Message, ToolCall, etc.
│       │   │   └── trace.types.ts   # Trace (for Phase 2)
│       │   └── constants/
│       │       └── message-types.ts
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── package.json                     # Root scripts
└── turbo.json                       # Optional: Turborepo config
```

### pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
```

### How the three projects communicate

```
┌──────────────────────────────────────────────────────────────────┐
│                         RUNTIME CONNECTIONS                      │
│                                                                  │
│  ┌────────────┐    WebSocket (PartySocket)    ┌────────────────┐│
│  │  frontend   │ ───────────────────────────▶ │  core          ││
│  │  Worker     │    wss://api.example.com     │  Worker        ││
│  │             │    /agents/ChatAgent/{id}     │                ││
│  │             │                               │  Owns:         ││
│  │  Serves:    │                               │  - ChatAgent   ││
│  │  - HTML/SSR │                               │  - ContactDO   ││
│  │  - JS/CSS   │                               │  - OpportunityDO│
│  │  - Static   │                               │  - RateLimiterDO│
│  └────────────┘                               │  - SocialConDO ││
│                                                └───────┬────────┘│
│                                                        │         │
│                                               Service Binding    │
│                                                (CORE_SERVICE)    │
│                                                        │         │
│  ┌─────────────────────────────────────────────────────▼───────┐│
│  │  connectors Worker                                          ││
│  │                                                              ││
│  │  Receives:                    Calls core for:                ││
│  │  - POST /webhooks/facebook    - Forward lead to ChatAgent    ││
│  │  - POST /webhooks/whatsapp    - Store/get OAuth tokens       ││
│  │  - POST /webhooks/tiktok      - Notify agent of new leads   ││
│  │  - GET/POST /oauth/*                                         ││
│  │                                                              ││
│  │  Also provides (via Service Binding FROM core):              ││
│  │  - Gmail API calls (sendEmail, listEmails)                  ││
│  │  - WhatsApp API calls (sendMessage, templates)               ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Wrangler configs

**packages/frontend/wrangler.jsonc**
```jsonc
{
  "name": "superhuman-frontend",
  "main": "src/entry.cloudflare.ts",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  // No DOs, no KV, no AI — just SSR
  "vars": {
    "CORE_API_URL": "https://api.superhuman-crm.com"
  }
}
```

**packages/core/wrangler.jsonc**
```jsonc
{
  "name": "superhuman-core",
  "main": "src/entry.ts",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  "ai": { "binding": "AI" },
  "durable_objects": {
    "bindings": [
      { "name": "CHAT_AGENT", "class_name": "ChatAgent" },
      { "name": "CONTACT_DO", "class_name": "ContactDO" },
      { "name": "OPPORTUNITY_DO", "class_name": "OpportunityDO" },
      { "name": "RATE_LIMITER", "class_name": "RateLimiterDO" },
      { "name": "SOCIAL_CONNECTIONS_DO", "class_name": "SocialConnectionsDO" }
    ]
  },
  "kv_namespaces": [
    { "binding": "LEADS_KV", "id": "..." }
  ],
  "services": [
    // Bind to connectors worker so ChatAgent can call gmail/whatsapp tools
    { "binding": "CONNECTORS_SERVICE", "service": "superhuman-connectors" }
  ],
  "vars": {
    "AI_MODEL": "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  }
}
```

**packages/connectors/wrangler.jsonc**
```jsonc
{
  "name": "superhuman-connectors",
  "main": "src/entry.ts",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    { "binding": "WEBHOOK_ROUTING_KV", "id": "..." }
  ],
  "services": [
    // Bind to core worker for DO access (tokens, leads)
    { "binding": "CORE_SERVICE", "service": "superhuman-core" }
  ],
  // Platform secrets (set via `wrangler secret put`)
  "dev": {
    "vars": {
      "FACEBOOK_APP_SECRET": "dev-secret",
      "FACEBOOK_PAGE_ACCESS_TOKEN": "dev-token",
      "WHATSAPP_VERIFY_TOKEN": "dev-token",
      "WHATSAPP_ACCESS_TOKEN": "dev-token",
      "GMAIL_CLIENT_ID": "dev-id",
      "GMAIL_CLIENT_SECRET": "dev-secret",
      "TIKTOK_WEBHOOK_SECRET": "dev-secret",
      "TOKEN_ENCRYPTION_SECRET": "dev-encryption-key"
    }
  }
}
```

### What changes in the frontend

Only one file needs a real change — `ChatEngine.tsx` (or the hook that wraps `useAgent`):

```typescript
// Before (same-origin)
const connection = useAgent({
  agent: "ChatAgent",
  name: sessionId,
});

// After (cross-origin)
const connection = useAgent({
  agent: "ChatAgent",
  name: sessionId,
  host: import.meta.env.VITE_CORE_API_URL, // "https://api.superhuman-crm.com"
});
```

The `agents/react` package supports a `host` parameter for PartySocket cross-origin connections. The core Worker needs CORS headers for WebSocket upgrade:

```typescript
// packages/core/src/entry.ts
if (request.method === "OPTIONS") {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://crm.superhuman-crm.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
```

### What changes in connectors

Connectors call core via Service Binding instead of direct function imports:

```typescript
// Before (direct import)
import { handleOAuthCallback } from "../services/oauth-services";
const tokenDO = env.SOCIAL_CONNECTIONS_DO.get(id);
await tokenDO.storeToken(platform, tokens);

// After (Service Binding)
const response = await env.CORE_SERVICE.fetch(
  new Request("https://internal/api/tokens/store", {
    method: "POST",
    body: JSON.stringify({ platform, tokens }),
  })
);
```

Core exposes internal API routes for connector use:

```typescript
// packages/core/src/entry.ts
if (url.pathname.startsWith("/api/tokens/")) {
  return handleTokenRequest(request, env);
}
if (url.pathname.startsWith("/api/leads/")) {
  return handleLeadIngestion(request, env);
}
```

### Tool integration (how ChatAgent calls connector services)

When ChatAgent wants to send a WhatsApp message or read Gmail, it calls the connectors Worker via Service Binding:

```typescript
// packages/core/src/agents/chat-agent-tools.ts
const gmailTool = {
  description: "Send an email via Gmail",
  parameters: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
  execute: async ({ to, subject, body }) => {
    const response = await env.CONNECTORS_SERVICE.fetch(
      new Request("https://internal/api/gmail/send", {
        method: "POST",
        body: JSON.stringify({ to, subject, body, accountId }),
      })
    );
    return response.json();
  },
};
```

---

## 4. Connector Grouping Decision

### Should WhatsApp, Facebook, TikTok be one project or separate?

**Recommendation: Group them in one `connectors` project.**

| Factor | Grouped (1 project) | Separate (3 projects) |
|--------|:---:|:---:|
| **Shared code** | token-encryption.ts, oauth-services.ts, webhook-routing.ts all shared naturally | Must duplicate or create another shared package |
| **Shared KV** | Single `WEBHOOK_ROUTING_KV` binding | Each needs the same KV binding |
| **Shared secrets pattern** | One `wrangler secret put` workflow | 3 separate secret management workflows |
| **Deploy speed** | ~10 seconds | ~10 seconds each, but 3 deploys |
| **Blast radius** | Facebook deploy affects WhatsApp (risk) | Fully isolated (safer) |
| **Dev overhead** | 1 wrangler.jsonc | 3 wrangler.jsonc files |
| **When to separate** | When you have dedicated teams per platform | N/A |

**Group now. Separate later when it hurts.** The connectors share so much code (encryption, OAuth flows, KV routing) that splitting them creates more duplication than isolation.

### Should Gmail be in connectors or separate?

**Keep Gmail in connectors.** Reason:

- Gmail shares the same OAuth flow as other platforms (`oauth-services.ts`)
- Gmail tokens stored in the same `SocialConnectionsDO` (via core Service Binding)
- Gmail uses the same `token-encryption.ts`
- It's just another platform connector

The only difference is Gmail is tool-initiated (ChatAgent calls it) vs webhook-initiated (Facebook pushes to it). But the connector Worker handles both patterns — it receives webhook pushes AND responds to Service Binding calls from core.

### Should distributed agents (Support, Health, Churn) be separate?

**Yes, when they exist.** They would be a 4th project (`packages/agents/`):

- Separate Worker with Queue consumers
- Own wrangler.jsonc with Queue bindings, cron triggers
- Service Binding to core for Context Graph DOs
- Can deploy independently — different scaling needs
- Different team can own it

But this is Phase 2 — don't create the project until the domain model exists.

---

## 5. Migration Path

### Step 1: Create the monorepo (Day 1)

```bash
# Initialize workspace
mkdir -p packages/{frontend,core,connectors,shared}

# Move shared types first
mv src/types/ packages/shared/src/types/
mv src/server/agents/types.ts packages/shared/src/types/agent.types.ts
mv src/server/agents/chat-agent-types.ts packages/shared/src/types/chat-agent.types.ts

# Create workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "packages/*"
EOF
```

### Step 2: Extract shared types (Day 1-2)

```bash
# packages/shared/package.json
{
  "name": "@superhuman/shared",
  "version": "0.0.1",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

Move types used by both frontend and backend:
- `ChatAgentState`, `CardType` → `packages/shared/src/types/`
- `Message`, `ToolCall`, `ToolResult` → `packages/shared/src/types/`
- Keep server-only types in `packages/core/`

### Step 3: Extract frontend (Day 2-3)

```bash
# Move frontend files
mv src/components/ packages/frontend/src/components/
mv src/hooks/ packages/frontend/src/hooks/
mv src/routes/ packages/frontend/src/routes/
mv src/styles/ packages/frontend/src/styles/
mv src/router.tsx packages/frontend/src/router.tsx

# Create frontend entry (SSR only, no backend routes)
# packages/frontend/src/entry.cloudflare.ts
```

Frontend entry point — just TanStack Start SSR:
```typescript
// packages/frontend/src/entry.cloudflare.ts
import { handleRequest } from "@tanstack/react-start/server-entry";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request);
  },
};
```

Update `useAgent` to use configurable host:
```typescript
// packages/frontend/src/components/chat/hooks/useChatConnection.ts
const coreUrl = import.meta.env.VITE_CORE_API_URL || "";

const connection = useAgent({
  agent: "ChatAgent",
  name: sessionId,
  host: coreUrl || undefined, // undefined = same origin (for local dev)
});
```

### Step 4: Extract core backend (Day 3-4)

```bash
# Move server files
mv src/server/agents/ packages/core/src/agents/
mv src/server/tools/ packages/core/src/tools/
mv src/server/workflows/ packages/core/src/workflows/
mv src/server/middleware/ packages/core/src/middleware/
mv src/server/durable-objects/ContactDO.ts packages/core/src/durable-objects/
mv src/server/durable-objects/OpportunityDO.ts packages/core/src/durable-objects/
```

Core entry point — agents + API + health:
```typescript
// packages/core/src/entry.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS for frontend
    if (request.method === "OPTIONS") return corsResponse(env);

    // Agent WebSocket/HTTP
    if (url.pathname.startsWith("/agents/")) {
      return handleAgentRequest(request, env);
    }

    // Internal API (for connectors Service Binding)
    if (url.pathname.startsWith("/api/tokens/")) return handleTokens(request, env);
    if (url.pathname.startsWith("/api/leads/")) return handleLeads(request, env);

    // Health
    if (url.pathname.startsWith("/health")) return healthCheck(env);

    return new Response("Not Found", { status: 404 });
  },
};

export { ChatAgent } from "./agents/chat-agent";
export { ContactDO } from "./durable-objects/ContactDO";
export { OpportunityDO } from "./durable-objects/OpportunityDO";
export { RateLimiterDO } from "./middleware/rate-limiter";
export { SocialConnectionsDO } from "./durable-objects/SocialConnectionsDO";
```

### Step 5: Extract connectors (Day 4-5)

```bash
# Move connector files
mv src/server/webhooks/ packages/connectors/src/webhooks/
mv src/server/services/facebook-* packages/connectors/src/services/
mv src/server/services/whatsapp-* packages/connectors/src/services/
mv src/server/services/gmail-* packages/connectors/src/services/
mv src/server/services/oauth-services.ts packages/connectors/src/services/
mv src/server/services/token-encryption.ts packages/connectors/src/services/
mv src/server/tools/gmail-tools.ts packages/connectors/src/tools/
mv src/server/tools/whatsapp-tools.ts packages/connectors/src/tools/
mv src/server/utils/webhook-routing.ts packages/connectors/src/utils/
```

Connectors entry point:
```typescript
// packages/connectors/src/entry.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Webhook endpoints (called by Facebook, WhatsApp, TikTok)
    if (url.pathname === "/webhooks/facebook") return handleFacebookWebhook(request, env);
    if (url.pathname === "/webhooks/whatsapp") return handleWhatsAppWebhook(request, env);
    if (url.pathname === "/webhooks/tiktok") return handleTikTokWebhook(request, env);

    // OAuth endpoints
    if (url.pathname.startsWith("/oauth/")) return handleOAuth(request, env);

    // Tool endpoints (called by core via Service Binding)
    if (url.pathname === "/api/gmail/send") return handleGmailSend(request, env);
    if (url.pathname === "/api/gmail/list") return handleGmailList(request, env);
    if (url.pathname === "/api/whatsapp/send") return handleWhatsAppSend(request, env);

    return new Response("Not Found", { status: 404 });
  },
};
```

### Step 6: Wire up Service Bindings (Day 5)

Test the three Workers communicate correctly:
1. Frontend → Core (WebSocket)
2. Core → Connectors (Service Binding for gmail/whatsapp tools)
3. Connectors → Core (Service Binding for token storage, lead forwarding)

### Local development

For local dev, all three Workers run together:

```jsonc
// packages/core/wrangler.jsonc (dev overrides)
{
  "dev": {
    "port": 8787
  }
}

// packages/connectors/wrangler.jsonc (dev overrides)
{
  "dev": {
    "port": 8788
  }
}

// packages/frontend/wrangler.jsonc (dev overrides)
{
  "dev": {
    "port": 3000,
    "vars": {
      "VITE_CORE_API_URL": "http://localhost:8787"
    }
  }
}
```

Run all three:
```bash
# Root package.json scripts
{
  "scripts": {
    "dev": "pnpm --filter '*' dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:core": "pnpm --filter core dev",
    "dev:connectors": "pnpm --filter connectors dev",
    "deploy": "pnpm --filter '*' deploy",
    "deploy:frontend": "pnpm --filter frontend deploy",
    "deploy:core": "pnpm --filter core deploy",
    "deploy:connectors": "pnpm --filter connectors deploy"
  }
}
```

---

## 6. Internal Refactoring (Within Each Project)

These apply AFTER the split, within each project independently.

### 6.1 Frontend: Decompose ChatEngine.tsx

**Current**: 1,467 lines. **Target**: ~200 lines.

Extract hooks:
```
packages/frontend/src/components/chat/hooks/
├── useChatMessages.ts        # Message state, streaming, scroll
├── useChatConnection.ts      # useAgent wrapper, reconnect, connection state
├── useToolInvocation.ts      # callAgentMethod / invokeTool
└── useAutoResize.ts          # Textarea auto-resize
```

Extract renderers:
```
packages/frontend/src/components/chat/renderers/
├── CardRenderer.tsx          # Switch on card type → component
├── StateCardRenderer.tsx     # agentState.ui.activeCard rendering
└── InlineCardParser.tsx      # Parse ```json:card-type markdown blocks
```

### 6.2 Core: Thin chat-agent.ts

**Current**: 2,048 lines. **Target**: ~600 lines.

Extract:
```
packages/core/src/agents/
├── chat-agent.ts             # ~600 lines (orchestrator)
├── chat-agent-prompts.ts     # System prompt construction
├── chat-agent-tools.ts       # Tool definitions for AI SDK
├── chat-agent-flows.ts       # Conversational flow management
└── services/                 # (keep existing 6 services)
```

### 6.3 Frontend: Shared card abstractions

Extract common patterns from 22 card components:
```
packages/frontend/src/components/chat/cards/
├── BaseCard.tsx              # Shell: header, border, shadow
├── FieldGrid.tsx             # Key-value display
├── CardActions.tsx           # Action button row
└── StatusBadge.tsx           # Status indicator
```

Each lead card drops from ~300 to ~80 lines.

---

## 7. Phase 2: Distributed Agents (Future)

> Requires: support ticket system, account health model, churn prediction features.
> These don't exist yet. Build the features first, then add trace coordination.

When ready, create `packages/agents/`:

```
packages/agents/              # Deploys as: agents.example.com
├── src/
│   ├── support/
│   │   └── SupportAgent.ts   # Queue consumer, sentiment analysis
│   ├── health/
│   │   └── HealthAgent.ts    # Scheduled, health scoring
│   ├── churn/
│   │   └── ChurnAgent.ts     # Triggered, pattern matching
│   ├── context/
│   │   └── AccountContextGraph.ts  # DO for trace storage
│   └── entry.ts
├── wrangler.jsonc             # Queues, crons, Service Binding to core
└── package.json
```

See the Trace data model and stigmergic coordination pattern in the `docs/_archive/DISTRIBUTED_AGENT_MVP.md` for the full vision.

---

## 8. Constraints

### AIChatAgent
- SQLite persistence built in. Don't replace.
- Resumable streams handled automatically.
- `setState()` auto-broadcasts to all WebSocket clients.

### Service Bindings
- DOs can only be instantiated by the Worker that defines them.
- Cross-Worker DO access requires Service Binding → internal API on the owning Worker.
- Service Bindings are zero-latency within the same Cloudflare colo.

### Shared secrets
- `TOKEN_ENCRYPTION_SECRET` must be identical across core and connectors (both encrypt/decrypt OAuth tokens).
- Use `wrangler secret put` for each Worker separately.

---

## 9. Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Split into 3 projects (Option B) | Balance of independence and simplicity | 2026-02-13 |
| Group all social connectors in one project | Share token-encryption, OAuth flows, KV routing | 2026-02-13 |
| Keep Gmail in connectors (not core) | Same OAuth/encryption pattern as other platforms | 2026-02-13 |
| Frontend communicates via WebSocket only | No server functions exist — coupling is minimal | 2026-02-13 |
| Service Bindings (not HTTP) between core/connectors | Zero-latency, no public endpoint needed | 2026-02-13 |
| SocialConnectionsDO stays in core | Token storage is a core concern; connectors call via Service Binding | 2026-02-13 |
| Distributed agents as future 4th project | Domain model doesn't exist yet | 2026-02-13 |
| Don't build `BaseDO` abstraction | Direct `ctx.storage` is clearer | 2026-02-13 |
| ChatEngine decomposition is priority #1 | The only true monolith (1,467 lines, no extraction done) | 2026-02-13 |

---

## 10. Quick Reference

### Deploy independently

```bash
pnpm --filter frontend deploy   # Just the UI
pnpm --filter core deploy       # Just the backend
pnpm --filter connectors deploy # Just webhooks/connectors
```

### Where to put new code

| What | Project | Location |
|------|---------|----------|
| New card component | frontend | `src/components/chat/` |
| New hook | frontend | `src/hooks/` or `src/components/chat/hooks/` |
| New route | frontend | `src/routes/` |
| New AI tool | core | `src/tools/` + register in `tool-registry.json` |
| New agent service | core | `src/agents/services/` |
| New DO | core | `src/durable-objects/` + bind in `wrangler.jsonc` |
| New webhook handler | connectors | `src/webhooks/` |
| New OAuth flow | connectors | `src/oauth/` |
| New platform API client | connectors | `src/services/` |
| Shared types | shared | `src/types/` |
| Distributed agent | agents (future) | `src/{agent-name}/` |

### Token cost for Claude Code

| Task | Before (monolith) | After (split) |
|------|-------------------|---------------|
| "Fix contact form bug" | Read ChatEngine (1,467) | Read just CardRenderer + ContactFormCard (~200) |
| "Add new tool" | Read chat-agent (2,048) | Read just core/tools/ (~200) |
| "Update WhatsApp webhook" | Read entry.cloudflare (308) + webhook handler | Read just connectors/webhooks/whatsapp.ts (~100) |
| "Change chat UI styling" | Read ChatEngine (1,467) | Read just frontend component (~150) |
