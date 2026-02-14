# Project Reorganization Proposal
## Inspired by OpenClaw Architecture

**Goal**: Reorganize the SuperHuman CRM project for:
- ✅ Clear frontend/backend separation
- ✅ Modular components with independence
- ✅ Simplified Claude Code focus on functionality
- ✅ Reduced token consumption
- ✅ Easier feature addition
- ✅ Independent deployment capability

---

## Current State Analysis

### Problems

| Issue | Impact | Token Cost |
|-------|--------|------------|
| **Monolithic Components** | ChatEngine.tsx (1,467 lines), chat-agent.ts (2,048 lines) | High context load |
| **Mixed Concerns** | UI, business logic, state, WebSocket all intertwined | Difficult to focus |
| **Tight Coupling** | Components directly import server code | Can't deploy independently |
| **No Clear Boundaries** | `src/server/` contains agents, tools, DOs, services, middleware | Hard to navigate |
| **Large File Reads** | Need to read 2k+ line files to understand features | Expensive token usage |

### Current Structure

```
src/
├── components/
│   ├── chat/           # 15+ files, ChatEngine = 1,467 lines
│   ├── auth/
│   └── settings/
├── routes/             # TanStack routes
├── server/
│   ├── agents/         # chat-agent.ts = 2,048 lines
│   ├── tools/
│   ├── durable-objects/ # 9 DO classes
│   ├── services/
│   ├── workflows/
│   ├── middleware/
│   └── utils/
└── types/
```

---

## Vision: Two-Phase Evolution

### Phase 1: Refactor to Layered Architecture (Weeks 1-6)
Reorganize current centralized CRM into clean modules with separation of concerns.

### Phase 2: Distributed Stigmergic Agents (Weeks 7-12)
Evolve into autonomous agent network coordinating through environmental traces.

**See**: [DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md) for complete Phase 2 vision.

---

## Phase 1: Proposed Architecture

### Inspiration: OpenClaw Pattern

OpenClaw uses a **layered architecture** with clear separation:

```
┌─────────────────────────────────────────────┐
│  GATEWAY LAYER (Channel Adapters)          │
│  - WebSocket, HTTP, Telegram, Discord      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  AGENT CORE (Business Logic)                │
│  - Router Agent                             │
│  - Specialized Agents (SDR, AE, CSM)        │
│  - Tool Execution                           │
│  - State Machine                            │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  MEMORY LAYER (Persistence)                 │
│  - Sessions (JSONL files)                   │
│  - Long-term Memory (MD files)              │
│  - KV Storage / DOs                         │
└─────────────────────────────────────────────┘
```

### New Structure for SuperHuman CRM

```
src/
├── client/                    # ← FRONTEND (can deploy to Cloudflare Pages)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatEngine.tsx           # ← 200 lines max (orchestrator only)
│   │   │   ├── MessageRenderer.tsx
│   │   │   ├── cards/                   # Card components
│   │   │   └── forms/                   # Form components
│   │   ├── auth/
│   │   └── settings/
│   ├── hooks/
│   │   ├── useAgent.ts                  # WebSocket connection
│   │   ├── useChatState.ts              # State management
│   │   └── useInvokeTool.ts             # Direct tool invocation
│   ├── routes/                          # TanStack routes
│   └── lib/                             # Client utilities
│
├── server/                    # ← BACKEND (Cloudflare Workers)
│   ├── gateway/               # ← Entry point & routing
│   │   ├── index.ts                     # Main handler
│   │   ├── websocket-handler.ts         # WebSocket connections
│   │   ├── api-router.ts                # HTTP API routes
│   │   └── webhook-router.ts            # Social media webhooks
│   │
│   ├── agents/                # ← Agent system (focused files)
│   │   ├── registry.ts                  # Agent discovery
│   │   ├── chat/
│   │   │   ├── ChatAgent.ts            # ← 400 lines max
│   │   │   ├── handler.ts              # Message handling
│   │   │   ├── state-machine.ts        # Agent loop
│   │   │   └── prompts.ts              # System prompts
│   │   ├── sdr/
│   │   │   ├── SDRAgent.ts
│   │   │   └── qualification.ts
│   │   └── ae/
│   │       ├── AEAgent.ts
│   │       └── deal-management.ts
│   │
│   ├── tools/                 # ← Tool system (already good!)
│   │   ├── registry.ts                  # Central registry
│   │   ├── contact-tools.ts
│   │   ├── opportunity-tools.ts
│   │   ├── gmail-tools.ts
│   │   └── whatsapp-tools.ts
│   │
│   ├── memory/                # ← Session & memory management
│   │   ├── session-manager.ts           # Session CRUD
│   │   ├── message-store.ts             # Message persistence
│   │   ├── compaction.ts                # Context window management
│   │   └── long-term-memory.ts          # Cross-session memory
│   │
│   ├── persistence/           # ← Durable Objects as storage layer
│   │   ├── base/
│   │   │   ├── BaseDO.ts               # Common DO utilities
│   │   │   └── storage-adapter.ts      # Abstract storage interface
│   │   ├── session/
│   │   │   └── SessionDO.ts            # Conversation sessions
│   │   ├── crm/
│   │   │   ├── ContactDO.ts
│   │   │   └── OpportunityDO.ts
│   │   └── social/
│   │       ├── SocialConnectionsDO.ts
│   │       └── LeadQualificationDO.ts
│   │
│   ├── services/              # ← Business logic services
│   │   ├── ai/
│   │   │   ├── llm-service.ts          # LLM abstraction
│   │   │   └── streaming.ts            # Response streaming
│   │   ├── crm/
│   │   │   ├── contact-service.ts
│   │   │   └── opportunity-service.ts
│   │   └── social/
│   │       ├── facebook-service.ts
│   │       └── whatsapp-service.ts
│   │
│   └── shared/                # ← Server-only shared code
│       ├── types/
│       ├── schemas/                     # Zod schemas
│       ├── middleware/
│       └── utils/
│
└── shared/                    # ← Truly shared (client + server)
    ├── types/
    │   ├── agent.types.ts
    │   ├── message.types.ts
    │   └── crm.types.ts
    └── constants/
        └── message-types.ts
```

---

## Key Architectural Patterns

### 1. Gateway Pattern (Entry Points)

**Before**: Everything goes through `entry.cloudflare.ts` → scattered handling

**After**: Clean routing layer

```typescript
// src/server/gateway/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Route to appropriate handler
    if (url.pathname.startsWith('/agents/')) {
      return websocketHandler(request, env, ctx);
    }
    if (url.pathname.startsWith('/api/')) {
      return apiRouter(request, env, ctx);
    }
    if (url.pathname.startsWith('/webhooks/')) {
      return webhookRouter(request, env, ctx);
    }

    // Default: TanStack Start SSR
    return tanstackHandler(request, env, ctx);
  }
};
```

### 2. Agent Registry Pattern (Multi-Agent System)

**Before**: Hardcoded agent references

**After**: Dynamic discovery and routing

```typescript
// src/server/agents/registry.ts
interface AgentConfig {
  name: string;
  class: typeof Agent;
  description: string;
  specialization: string[];
}

class AgentRegistry {
  private agents = new Map<string, AgentConfig>();

  register(config: AgentConfig) {
    this.agents.set(config.name, config);
  }

  getAgent(intent: string): AgentConfig {
    // Route based on intent detection
    for (const [name, config] of this.agents) {
      if (config.specialization.includes(intent)) {
        return config;
      }
    }
    return this.agents.get('chat-agent')!; // fallback
  }
}

// Usage:
registry.register({
  name: 'sdr-agent',
  class: SDRAgent,
  description: 'Lead qualification specialist',
  specialization: ['lead', 'qualification', 'demo']
});
```

### 3. Memory Management Pattern

**Before**: Messages stored directly in DOs, no compaction

**After**: Layered memory with automatic management

```typescript
// src/server/memory/session-manager.ts
export class SessionManager {
  constructor(
    private messageStore: MessageStore,
    private compaction: CompactionService,
    private longTermMemory: LongTermMemory
  ) {}

  async loadSession(sessionId: string): Promise<Message[]> {
    let messages = await this.messageStore.getMessages(sessionId);

    // Auto-compact if needed
    if (this.shouldCompact(messages)) {
      messages = await this.compaction.compact(messages);
      await this.messageStore.saveCompacted(sessionId, messages);
    }

    // Add relevant long-term memories
    const memories = await this.longTermMemory.search(sessionId);
    if (memories.length > 0) {
      messages.unshift({
        role: 'system',
        content: `Relevant memories:\n${memories.join('\n')}`
      });
    }

    return messages;
  }

  private shouldCompact(messages: Message[]): boolean {
    const tokenCount = estimateTokens(messages);
    return tokenCount > 100_000; // 80% of context window
  }
}
```

### 4. Tool Invocation Pattern (MCP Apps)

**Before**: Tools only accessible via LLM

**After**: Direct invocation from UI + LLM access

```typescript
// src/server/gateway/websocket-handler.ts
async function handleMessage(connection: Connection, data: any) {
  const message = JSON.parse(data);

  switch (message.type) {
    case 'chat-message':
      // Normal LLM flow
      return handleChatMessage(connection, message);

    case 'tool-invoke':
      // Direct tool invocation (MCP Apps pattern)
      return handleDirectToolInvocation(connection, message);

    case 'get-messages':
      return handleGetMessages(connection, message);
  }
}

async function handleDirectToolInvocation(connection: Connection, message: any) {
  const { toolName, parameters } = message;

  // Get tool from registry
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return connection.send(JSON.stringify({
      type: 'tool-invoke-error',
      error: `Tool not found: ${toolName}`
    }));
  }

  // Execute directly (no LLM)
  const result = await tool.execute(parameters);

  connection.send(JSON.stringify({
    type: 'tool-invoke-result',
    toolName,
    result
  }));
}
```

### 5. Persistence Layer Abstraction

**Before**: Direct DO calls scattered everywhere

**After**: Clean storage interface

```typescript
// src/server/persistence/base/storage-adapter.ts
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<Map<string, T>>;
}

// src/server/persistence/base/BaseDO.ts
export class BaseDO implements StorageAdapter {
  constructor(protected state: DurableObjectState, protected env: Env) {}

  async get<T>(key: string): Promise<T | null> {
    return this.state.storage.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.state.storage.put(key, value);
    if (ttl) {
      await this.state.storage.setAlarm(Date.now() + ttl);
    }
  }

  // ... other methods
}

// Usage in services:
class ContactService {
  constructor(private storage: StorageAdapter) {}

  async getContact(id: string) {
    return this.storage.get<Contact>(`contact:${id}`);
  }
}
```

---

## Module Boundaries & Dependencies

### Dependency Rules

```
client/
  ↓ can import
  shared/  (types, constants)
  ✗ cannot import server/

server/gateway/
  ↓ can import
  server/agents/
  server/tools/
  server/memory/
  server/services/
  shared/

server/agents/
  ↓ can import
  server/tools/
  server/memory/
  server/services/
  shared/

server/persistence/
  ↓ can import
  shared/
  ✗ cannot import agents/ or tools/ (only services can)

shared/
  ✗ cannot import anything from src/
```

### Module Size Targets

| Module | File Count | Max Lines/File | Total Lines |
|--------|-----------|----------------|-------------|
| `client/components/chat/` | 15-20 | 200 | 3,000 |
| `server/gateway/` | 5 | 300 | 1,500 |
| `server/agents/chat/` | 4 | 400 | 1,600 |
| `server/agents/sdr/` | 3 | 400 | 1,200 |
| `server/tools/` | 10 | 300 | 3,000 |
| `server/memory/` | 4 | 300 | 1,200 |
| `server/persistence/` | 8 | 400 | 3,200 |
| `server/services/` | 12 | 300 | 3,600 |

**Total: ~17k lines (currently ~20k+)**

---

## Benefits Analysis

### 1. Token Consumption Reduction

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| **"Fix bug in contact form"** | Read ChatEngine (1,467) + chat-agent (2,048) + ContactCard | Read client/components/chat/forms/ContactForm.tsx (150) | ~85% |
| **"Add new tool"** | Read chat-agent (2,048) + tools registry | Read server/tools/registry.ts (200) + create new file | ~70% |
| **"Update agent prompt"** | Read chat-agent (2,048) | Read server/agents/chat/prompts.ts (100) | ~95% |
| **"Deploy frontend only"** | Can't - everything bundled | Deploy client/ to Pages | Independent |

### 2. Development Velocity

**Before**: "Add WhatsApp lead capture"
1. Read webhooks/whatsapp.ts
2. Read chat-agent.ts (2,048 lines) to find where to integrate
3. Update ChatEngine.tsx to display cards
4. Hope nothing breaks

**After**: "Add WhatsApp lead capture"
1. Create `server/services/social/whatsapp-service.ts`
2. Add webhook handler in `server/gateway/webhook-router.ts`
3. Register tool in `server/tools/whatsapp-tools.ts`
4. Add card component in `client/components/chat/cards/WhatsAppLeadCard.tsx`
5. Each file is small, focused, testable

### 3. Independent Deployment

```bash
# Deploy frontend only (Pages)
cd src/client
wrangler pages deploy

# Deploy backend only (Workers)
cd src/server
wrangler deploy --config wrangler.server.jsonc

# Deploy specific DO class
wrangler deploy --durable-objects-only
```

### 4. Easier Testing

**Before**: Mock entire Cloudflare env to test one function

**After**: Test pure functions in isolation

```typescript
// Test memory compaction (no env needed)
import { CompactionService } from '@/server/memory/compaction';

test('compacts messages when over threshold', async () => {
  const compactor = new CompactionService();
  const messages = createMockMessages(10000);

  const compacted = await compactor.compact(messages);

  expect(compacted.length).toBeLessThan(messages.length);
  expect(estimateTokens(compacted)).toBeLessThan(100_000);
});
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)

**Goal**: Set up new structure without breaking existing code

```bash
# Create new directories
mkdir -p src/client/{components,hooks,lib}
mkdir -p src/server/{gateway,agents,memory,persistence/base}
mkdir -p src/shared/{types,constants}

# Move shared types
mv src/types/* src/shared/types/

# Create base classes
touch src/server/persistence/base/BaseDO.ts
touch src/server/memory/session-manager.ts
```

**Deliverables**:
- [ ] New directory structure created
- [ ] Shared types moved to `src/shared/`
- [ ] `BaseDO` abstract class for all DOs
- [ ] `SessionManager` interface defined
- [ ] All existing code still works (no breaking changes)

### Phase 2: Extract Gateway (Week 2)

**Goal**: Clean entry point routing

```typescript
// Create src/server/gateway/index.ts
// Move routing logic from entry.cloudflare.ts
// Create websocket-handler.ts, api-router.ts, webhook-router.ts
```

**Deliverables**:
- [ ] `src/server/gateway/` module created
- [ ] All routes work through gateway
- [ ] WebSocket connections still functional
- [ ] Webhooks still receive events

### Phase 3: Refactor ChatAgent (Week 3)

**Goal**: Break down 2,048-line monolith

**Steps**:
1. Extract prompts → `server/agents/chat/prompts.ts`
2. Extract message handling → `server/agents/chat/handler.ts`
3. Extract state machine → `server/agents/chat/state-machine.ts`
4. Keep core agent → `server/agents/chat/ChatAgent.ts` (400 lines)

**Deliverables**:
- [ ] ChatAgent split into 4 focused files
- [ ] Each file under 400 lines
- [ ] All existing functionality preserved
- [ ] Tests pass

### Phase 4: Memory Layer (Week 4)

**Goal**: Session management with compaction

```typescript
// Create src/server/memory/
// - session-manager.ts
// - message-store.ts
// - compaction.ts
// - long-term-memory.ts

// Migrate message storage from chat-agent.ts
```

**Deliverables**:
- [ ] Memory module created
- [ ] Automatic context compaction working
- [ ] Long-term memory (cross-session) functional
- [ ] Session state migrated from DO storage to memory layer

### Phase 5: Client Separation (Week 5)

**Goal**: Frontend can deploy independently

```bash
# Move all client code
mv src/components/* src/client/components/
mv src/routes/* src/client/routes/

# Create client entry point
touch src/client/entry.client.ts

# Configure separate build
touch wrangler.client.jsonc
```

**Deliverables**:
- [ ] All client code in `src/client/`
- [ ] Client imports only from `src/shared/`
- [ ] Separate build configuration
- [ ] Can deploy to Cloudflare Pages

### Phase 6: Tool Registry Enhancement (Week 6)

**Goal**: Direct tool invocation (MCP Apps pattern)

```typescript
// Enhance src/server/tools/registry.ts
// Add direct invocation support
// Update gateway to handle tool-invoke messages
```

**Deliverables**:
- [ ] Tool registry supports direct invocation
- [ ] Forms can call tools without LLM
- [ ] `invokeTool` hook in client
- [ ] Type-safe tool parameters

---

## Success Metrics

### Quantitative

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Max file size** | 2,048 lines | 400 lines | `find src -name "*.ts*" -exec wc -l {} + \| sort -rn \| head -1` |
| **Avg file size** | ~350 lines | <200 lines | Total LOC / file count |
| **Token cost (bug fix)** | ~8k tokens | <2k tokens | Claude context for typical bug |
| **Build time** | ~45s | <30s | `time pnpm build` |
| **Module count** | 5 (flat) | 8 (layered) | Directory depth |
| **Agent coordination** | Centralized | Distributed (Phase 2) | Stigmergic traces |

### Qualitative (Phase 1)

- [ ] New developer can understand agent flow in <30 min
- [ ] Can add new tool without touching agent code
- [ ] Can deploy frontend without backend changes
- [ ] Claude Code can focus on single module
- [ ] Tests run in isolation (no full env mock)

---

## Files to Create

### Immediate (Phase 1)

1. `src/server/persistence/base/BaseDO.ts` - Abstract DO class
2. `src/server/persistence/base/storage-adapter.ts` - Storage interface
3. `src/server/memory/session-manager.ts` - Session CRUD
4. `src/server/memory/types.ts` - Memory types
5. `src/shared/types/agent.types.ts` - Shared agent types
6. `src/shared/types/message.types.ts` - Shared message types
7. `src/shared/constants/message-types.ts` - Message type enum

### Week 2 (Gateway)

8. `src/server/gateway/index.ts` - Main handler
9. `src/server/gateway/websocket-handler.ts` - WS connections
10. `src/server/gateway/api-router.ts` - HTTP API
11. `src/server/gateway/webhook-router.ts` - Webhook routing

### Week 3 (Agent Refactor)

12. `src/server/agents/chat/ChatAgent.ts` - Core agent (400 lines)
13. `src/server/agents/chat/handler.ts` - Message handling
14. `src/server/agents/chat/state-machine.ts` - Agent loop
15. `src/server/agents/chat/prompts.ts` - System prompts

---

## Example: Before vs After

### Before: Adding a new feature

**Task**: "Add Gmail lead capture"

```typescript
// 1. Update entry.cloudflare.ts (webhook routing)
// 2. Read chat-agent.ts (2,048 lines) to find integration point
// 3. Add tool in middle of chat-agent.ts
// 4. Update ChatEngine.tsx (1,467 lines) to show Gmail card
// 5. Hope WebSocket still works
// 6. Test everything manually

// Token cost: ~10k (read large files)
// Time: 3-4 hours
// Risk: High (touching core files)
```

### After: Adding a new feature

**Task**: "Add Gmail lead capture"

```typescript
// 1. Create src/server/services/social/gmail-service.ts (150 lines)
export class GmailService {
  async authenticateUser(code: string) { ... }
  async captureLeads() { ... }
}

// 2. Register webhook in src/server/gateway/webhook-router.ts (5 lines)
router.post('/webhooks/gmail', gmailWebhookHandler);

// 3. Create tool in src/server/tools/gmail-tools.ts (100 lines)
export const gmailTools = {
  captureGmailLeads: tool({ ... })
};

// 4. Create card in src/client/components/chat/cards/GmailLeadCard.tsx (80 lines)
export function GmailLeadCard({ lead }: Props) { ... }

// 5. Test in isolation
// - Unit test gmail-service.ts
// - Integration test webhook endpoint
// - Visual test card component

// Token cost: ~1.5k (small focused files)
// Time: 1-2 hours
// Risk: Low (no core changes)
```

---

## Phase 2 Preview: Distributed Agent Coordination

After completing the layered architecture refactoring (Phases 1-6), the system can evolve into a **distributed stigmergic agent network** where:

### Key Innovations

1. **Trace-Based Coordination** (not direct messaging)
   - Agents deposit "traces" into shared Context Graphs
   - Other agents discover traces autonomously
   - No centralized orchestrator

2. **Three Autonomous Agents**
   - **Support Agent**: Analyzes tickets → deposits sentiment traces
   - **Health Agent**: Monitors accounts → deposits health scores
   - **Churn Agent**: Detects risk → deposits predictions

3. **Stigmergic Properties**
   - Traces decay naturally (72-336 hour half-lives)
   - Signals reinforce when overlapping
   - Stale context expires automatically

4. **Regional Distribution**
   - Context Graphs in Durable Objects (per region)
   - KV-based cross-region propagation
   - GDPR-compliant jurisdiction constraints
   - Graceful degradation when regions disconnect

### Example Flow

```
Support Ticket (EU) → SupportAgent deposits sentiment trace
                                ↓
                      HealthAgent discovers trace
                                ↓
                      Deposits health degradation
                                ↓ (propagates via KV)
                      ChurnAgent (US) discovers traces
                                ↓
                      Pattern match → churn prediction

Total time: ~60 seconds
No orchestrator, no direct messaging
```

### Why This Matters

**Current CRM**: Centralized ChatAgent coordinates everything
**Phase 1**: Clean modules with clear separation
**Phase 2**: Distributed agents with emergent coordination

**Benefits**:
- ✅ Regional autonomy (EU operates independently)
- ✅ Graceful degradation (region failures don't cascade)
- ✅ Natural compliance (jurisdiction in traces)
- ✅ Emergent patterns (agents discover unexpected correlations)
- ✅ Horizontal scaling (agents scale independently)

**Full details**: See [DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md)

---

## Recommended Next Steps

1. **Review this proposal** with team
2. **Review Phase 2 vision** ([DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md))
3. **Approve architecture** and migration phases
4. **Create GitHub project** with phase checklists
5. **Start Phase 1** (foundation) - low risk
6. **Iterate weekly** with stakeholder reviews
7. **Begin Phase 2** after Phase 1 validates (Week 7+)

---

## Questions for Discussion

1. **Deployment Strategy**: Use monorepo (Turborepo/pnpm workspaces) or keep in single repo?
2. **Testing Priority**: Which modules need tests first?
3. **Migration Risk**: Can we do big-bang refactor or must be incremental?
4. **Backwards Compatibility**: Need to support old message format?
5. **Timeline**: 6-week estimate realistic? Need faster?

---

## Appendix A: Comparison Table

| Aspect | Current | Phase 1 (Refactor) | Phase 2 (Distributed) | Benefit |
|--------|---------|----------|---------|
| **Structure** | Flat, mixed concerns | Layered, separated concerns | Easier navigation |
| **Max file size** | 2,048 lines | 400 lines | Faster comprehension |
| **Agent complexity** | 1 monolith | Multiple focused agents | Specialization |
| **Memory management** | Manual in DO | Automatic compaction | Better performance |
| **Tool invocation** | LLM only | Direct + LLM | Faster, cheaper |
| **Deployment** | Monolithic | Independent modules | Flexibility |
| **Testing** | Full env mock | Unit + integration | Faster tests |
| **Claude Code cost** | High (large context) | Low (focused files) | Token savings |
| **Onboarding time** | 2-3 days | 4-6 hours | <30 min per module | Better DX |
| **Coordination** | Synchronous | Layered | Stigmergic traces | Emergent patterns |
| **Resilience** | Single point of failure | Module isolation | Regional autonomy | Graceful degradation |

---

## Appendix B: Related Documents

- **[DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md)** - Phase 2 vision: Stigmergic agent coordination
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Step-by-step implementation guide
- **[ARCHITECTURE_QUICK_REF.md](./ARCHITECTURE_QUICK_REF.md)** - Developer cheat sheet

---

**Status**: 📝 Proposal (awaiting approval)
**Author**: Claude Code
**Date**: 2026-02-13
**Version**: 1.0
