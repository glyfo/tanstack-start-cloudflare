# Migration Guide: Current → Proposed Architecture

## Quick Visual Comparison

### Current Architecture (Mixed Concerns)

```
┌─────────────────────────────────────────────────────────┐
│  entry.cloudflare.ts                                    │
│  - HTTP routing                                         │
│  - WebSocket routing                                    │
│  - Webhook routing                                      │
│  - TanStack SSR                                         │
│  - DO bindings                                          │
└──────────────┬──────────────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼─────┐   ┌──────▼──────────────────┐
│ ChatEngine │   │ ChatAgent (DO)          │
│ 1,467 lines│   │ 2,048 lines             │
│            │   │                         │
│ - UI       │   │ - WebSocket             │
│ - WS conn  │   │ - Message handling      │
│ - State    │   │ - LLM calls             │
│ - Forms    │   │ - Tool execution        │
│ - Cards    │   │ - State machine         │
│ - Rendering│   │ - Storage               │
│            │   │ - Prompts               │
│            │   │ - Memory                │
└────────────┘   └─────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ContactDO│     │ToolReg  │     │Services │
    │OpptyDO  │     │15 files │     │8 files  │
    │SocialDO │     │         │     │         │
    └─────────┘     └─────────┘     └─────────┘

    Everything imports everything ❌
```

### Proposed Architecture (Layered, Separated)

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 1: GATEWAY (Entry Point)                          │
│  src/server/gateway/                                     │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐│
│  │ WS Handler   │  │ API Router   │  │ Webhook Router ││
│  │ 150 lines    │  │ 200 lines    │  │ 180 lines      ││
│  └──────────────┘  └──────────────┘  └────────────────┘│
└─────────────┬────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────────┐
│  LAYER 2: AGENT CORE (Business Logic)                    │
│  src/server/agents/                                      │
│                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐│
│  │ ChatAgent      │  │ SDRAgent       │  │ AEAgent    ││
│  │ ├─ agent.ts    │  │ ├─ agent.ts    │  │ ├─agent.ts││
│  │ ├─ handler.ts  │  │ ├─ qualify.ts  │  │ ├─deal.ts ││
│  │ ├─ state.ts    │  │ └─ score.ts    │  │ └─nego.ts ││
│  │ └─ prompts.ts  │  │ (3x 350 lines) │  │ (3x 380)  ││
│  │ (4x 400 lines) │  └────────────────┘  └────────────┘│
│  └────────────────┘                                      │
└─────────────┬────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────────┐
│  LAYER 3: SERVICES (Reusable Logic)                      │
│  src/server/{tools, memory, services}/                   │
│                                                           │
│  ┌───────────┐  ┌────────────┐  ┌──────────────────────┐│
│  │ Tools     │  │ Memory     │  │ Services             ││
│  │ Registry  │  │ ├─ session │  │ ├─ ai/llm-service   ││
│  │ ├─contact │  │ ├─ compact │  │ ├─ crm/contact-svc  ││
│  │ ├─oppty   │  │ ├─ store   │  │ └─ social/whatsapp  ││
│  │ └─gmail   │  │ └─ ltm     │  │ (12x 280 lines)     ││
│  │ (10x 280) │  │ (4x 300)   │  └──────────────────────┘│
│  └───────────┘  └────────────┘                           │
└─────────────┬────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────────┐
│  LAYER 4: PERSISTENCE (Storage)                          │
│  src/server/persistence/                                 │
│                                                           │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ BaseDO     │  │ SessionDO    │  │ CRM DOs         │ │
│  │ (abstract) │  │ (messages)   │  │ ├─ ContactDO    │ │
│  │            │  │              │  │ ├─ OpportunityDO│ │
│  │ Storage    │  │ KV namespace │  │ └─ SocialDO     │ │
│  │ Interface  │  │ (if needed)  │  │ (3x 400 lines)  │ │
│  └────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  PARALLEL: CLIENT (Frontend)                             │
│  src/client/                                             │
│                                                           │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ Components     │  │ Hooks        │  │ Routes       ││
│  │ ├─ ChatEngine  │  │ ├─ useAgent  │  │ ├─ /chat     ││
│  │ │  (200 lines) │  │ ├─ useInvoke │  │ ├─ /settings ││
│  │ ├─ cards/      │  │ └─ useChat   │  │ └─ /login    ││
│  │ └─ forms/      │  │ (3x 150)     │  │              ││
│  │ (15x 180 avg)  │  └──────────────┘  └──────────────┘│
│  └────────────────┘                                      │
│                                                           │
│  Imports only from src/shared/ ✅                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  SHARED (Types, Constants)                               │
│  src/shared/                                             │
│                                                           │
│  ┌────────────────┐  ┌──────────────┐                   │
│  │ Types          │  │ Constants    │                   │
│  │ ├─ agent.ts    │  │ ├─ messages  │                   │
│  │ ├─ message.ts  │  │ └─ config    │                   │
│  │ └─ crm.ts      │  └──────────────┘                   │
│  └────────────────┘                                      │
│                                                           │
│  No dependencies on src/ ✅                              │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Week 1)

### Step 1: Create New Directory Structure

```bash
# Navigate to project root
cd /Users/alex/workspaces/tanstack-start-cloudflare

# Create new structure
mkdir -p src/client/{components,hooks,routes,lib}
mkdir -p src/server/gateway
mkdir -p src/server/agents/{chat,sdr,ae}
mkdir -p src/server/memory
mkdir -p src/server/persistence/{base,session,crm,social}
mkdir -p src/server/services/{ai,crm,social}
mkdir -p src/shared/{types,constants}

# Verify structure
tree -L 3 src/
```

### Step 2: Create Base Files

#### 2.1 Storage Interface

```typescript
// src/server/persistence/base/storage-adapter.ts
export interface StorageAdapter {
  /**
   * Get a value by key
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a key
   */
  delete(key: string): Promise<void>;

  /**
   * List all keys with a prefix
   */
  list<T>(prefix: string, options?: ListOptions): Promise<Map<string, T>>;

  /**
   * Run operations in a transaction
   */
  transaction<T>(fn: (txn: Transaction) => Promise<T>): Promise<T>;
}

export interface ListOptions {
  limit?: number;
  reverse?: boolean;
  start?: string;
  end?: string;
}

export interface Transaction {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}
```

Create this file:

```bash
cat > src/server/persistence/base/storage-adapter.ts << 'EOF'
// Paste the TypeScript code above
EOF
```

#### 2.2 Base Durable Object

```typescript
// src/server/persistence/base/BaseDO.ts
import { DurableObject } from 'cloudflare:workers';
import type { StorageAdapter, ListOptions, Transaction } from './storage-adapter';

/**
 * Base class for all Durable Objects
 * Implements StorageAdapter interface and provides common utilities
 */
export abstract class BaseDO extends DurableObject implements StorageAdapter {
  constructor(
    protected readonly state: DurableObjectState,
    protected readonly env: any
  ) {
    super(state, env);
  }

  // StorageAdapter implementation
  async get<T>(key: string): Promise<T | null> {
    return this.state.storage.get<T>(key) ?? null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.state.storage.put(key, value);

    if (ttl) {
      const alarmTime = Date.now() + ttl;
      await this.state.storage.setAlarm(alarmTime);
    }
  }

  async delete(key: string): Promise<void> {
    await this.state.storage.delete(key);
  }

  async list<T>(prefix: string, options?: ListOptions): Promise<Map<string, T>> {
    const results = await this.state.storage.list<T>({
      prefix,
      limit: options?.limit,
      reverse: options?.reverse,
      start: options?.start,
      end: options?.end
    });

    return results;
  }

  async transaction<T>(fn: (txn: Transaction) => Promise<T>): Promise<T> {
    return this.state.storage.transaction(async (txn) => {
      const adapter: Transaction = {
        get: <T>(key: string) => txn.get<T>(key),
        set: <T>(key: string, value: T) => txn.put(key, value),
        delete: (key: string) => txn.delete(key)
      };
      return fn(adapter);
    });
  }

  // Utility methods
  protected async getAllKeys(prefix: string = ''): Promise<string[]> {
    const map = await this.state.storage.list({ prefix });
    return Array.from(map.keys());
  }

  protected async count(prefix: string = ''): Promise<number> {
    const keys = await this.getAllKeys(prefix);
    return keys.length;
  }

  protected async clear(prefix: string = ''): Promise<void> {
    const keys = await this.getAllKeys(prefix);
    await this.state.storage.delete(keys);
  }

  // Override this in child classes to handle alarms
  async alarm(): Promise<void> {
    console.log('[BaseDO] Alarm triggered (override in child class)');
  }
}
```

Create this file:

```bash
cat > src/server/persistence/base/BaseDO.ts << 'EOF'
// Paste the TypeScript code above
EOF
```

#### 2.3 Shared Types

```typescript
// src/shared/types/message.types.ts
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MessagePart {
  type: 'text' | 'tool-call' | 'tool-result';
  text?: string;
  toolName?: string;
  toolCallId?: string;
  result?: any;
}

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  timestamp: number;
}
```

```typescript
// src/shared/types/agent.types.ts
export type AgentPhase = 'idle' | 'observing' | 'thinking' | 'acting' | 'learning';

export interface AgentState {
  phase: AgentPhase;
  goal?: string;
  iteration: number;
  maxIterations: number;
  progress: number;
  currentAction?: string;
  reasoning?: string;
  lastUpdate: number;
}

export interface AgentContext {
  sessionId: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}
```

```typescript
// src/shared/constants/message-types.ts
export const MESSAGE_TYPES = {
  // Chat flow
  USER_MESSAGE: 'user-message',
  AGENT_GOAL: 'agent-goal',
  GET_MESSAGES: 'get-messages',

  // Streaming
  MESSAGE_START: 'message-start',
  MESSAGE_CHUNK: 'message-chunk',
  MESSAGE_DONE: 'message-done',

  // Tools
  TOOL_INVOKE: 'tool-invoke',
  TOOL_INVOKE_RESULT: 'tool-invoke-result',
  TOOL_INVOKE_ERROR: 'tool-invoke-error',

  // State
  STATE_UPDATE: 'state-update',
  HISTORY_LOADED: 'history-loaded',

  // Errors
  ERROR: 'error'
} as const;

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
```

Create these files:

```bash
cat > src/shared/types/message.types.ts << 'EOF'
// Paste message.types.ts code
EOF

cat > src/shared/types/agent.types.ts << 'EOF'
// Paste agent.types.ts code
EOF

cat > src/shared/constants/message-types.ts << 'EOF'
// Paste message-types.ts code
EOF
```

#### 2.4 Session Manager Interface

```typescript
// src/server/memory/types.ts
import type { Message } from '@/shared/types/message.types';

export interface SessionManager {
  /**
   * Load all messages for a session
   */
  loadSession(sessionId: string): Promise<Message[]>;

  /**
   * Save a message to a session
   */
  saveMessage(sessionId: string, message: Message): Promise<void>;

  /**
   * Clear a session's messages
   */
  clearSession(sessionId: string): Promise<void>;

  /**
   * Get session metadata
   */
  getSessionInfo(sessionId: string): Promise<SessionInfo | null>;
}

export interface SessionInfo {
  sessionId: string;
  messageCount: number;
  firstMessage?: number; // timestamp
  lastMessage?: number;  // timestamp
  tokenCount?: number;
}
```

```typescript
// src/server/memory/session-manager.ts
import type { Message } from '@/shared/types/message.types';
import type { SessionManager, SessionInfo } from './types';
import type { StorageAdapter } from '../persistence/base/storage-adapter';

export class DefaultSessionManager implements SessionManager {
  constructor(
    private readonly storage: StorageAdapter
  ) {}

  async loadSession(sessionId: string): Promise<Message[]> {
    const messageMap = await this.storage.list<Message>(
      this.getMessageKey(sessionId, '')
    );

    const messages = Array.from(messageMap.values());

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return messages;
  }

  async saveMessage(sessionId: string, message: Message): Promise<void> {
    const key = this.getMessageKey(sessionId, message.id);
    await this.storage.set(key, message);
  }

  async clearSession(sessionId: string): Promise<void> {
    const prefix = this.getMessageKey(sessionId, '');
    const messageMap = await this.storage.list(prefix);

    for (const key of messageMap.keys()) {
      await this.storage.delete(key);
    }
  }

  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    const messages = await this.loadSession(sessionId);

    if (messages.length === 0) {
      return null;
    }

    return {
      sessionId,
      messageCount: messages.length,
      firstMessage: messages[0]?.timestamp,
      lastMessage: messages[messages.length - 1]?.timestamp
    };
  }

  private getMessageKey(sessionId: string, messageId: string): string {
    return `session:${sessionId}:message:${messageId}`;
  }
}
```

Create these files:

```bash
cat > src/server/memory/types.ts << 'EOF'
// Paste types.ts code
EOF

cat > src/server/memory/session-manager.ts << 'EOF'
// Paste session-manager.ts code
EOF
```

### Step 3: Update Existing DO to Extend BaseDO

Now let's migrate one existing DO to use the new base class:

```typescript
// src/server/persistence/session/SessionDO.ts (NEW)
import { BaseDO } from '../base/BaseDO';
import type { Message } from '@/shared/types/message.types';

export class SessionDO extends BaseDO {
  async getMessages(): Promise<Message[]> {
    const messageMap = await this.list<Message>('message:');
    const messages = Array.from(messageMap.values());
    messages.sort((a, b) => a.timestamp - b.timestamp);
    return messages;
  }

  async saveMessage(message: Message): Promise<void> {
    await this.set(`message:${message.id}`, message);
  }

  async clearMessages(): Promise<void> {
    await this.clear('message:');
  }

  async getMessageCount(): Promise<number> {
    return this.count('message:');
  }
}
```

### Step 4: Verify Everything Still Works

```bash
# Build
pnpm build

# Run dev server
pnpm dev

# Should work exactly as before!
```

---

## Phase 2: Extract Gateway (Week 2)

### Step 1: Create Gateway Router

```typescript
// src/server/gateway/index.ts
import { websocketHandler } from './websocket-handler';
import { apiRouter } from './api-router';
import { webhookRouter } from './webhook-router';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connections
    if (url.pathname.startsWith('/agents/')) {
      return websocketHandler(request, env, ctx);
    }

    // REST API
    if (url.pathname.startsWith('/api/')) {
      return apiRouter(request, env, ctx);
    }

    // Social media webhooks
    if (url.pathname.startsWith('/webhooks/')) {
      return webhookRouter(request, env, ctx);
    }

    // Default: Pass to TanStack Start SSR
    // (import and call the existing handler)
    return new Response('Not Found', { status: 404 });
  }
};
```

### Step 2: Move WebSocket Logic

```typescript
// src/server/gateway/websocket-handler.ts
export async function websocketHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Extract agent name and session ID from URL
  // /agents/{agentName}/{sessionId}
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const agentName = parts[2]; // 'chat-agent'
  const sessionId = parts[3]; // 'session-123'

  // Get appropriate DO stub
  const doName = agentName.toUpperCase().replace('-', '_');
  const id = env[doName].idFromName(sessionId);
  const stub = env[doName].get(id);

  // Forward WebSocket upgrade to DO
  return stub.fetch(request);
}
```

### Step 3: Update entry.cloudflare.ts

```typescript
// src/entry.cloudflare.ts
import gateway from './server/gateway';

export default gateway;

// Export DOs (still needed for Wrangler)
export { ChatAgent } from './server/agents/chat/ChatAgent';
export { ContactDO } from './server/persistence/crm/ContactDO';
// ... other DOs
```

---

## Phase 3: Refactor ChatAgent (Week 3)

### Extract Prompts

```typescript
// src/server/agents/chat/prompts.ts
export function getSystemPrompt(context?: Record<string, any>): string {
  return `You are an intelligent CRM assistant for SuperHuman CRM.

Your role:
- Help users manage contacts, opportunities, and leads
- Provide insights on sales pipeline
- Assist with data entry and updates
- Never make assumptions - ask for clarification

Available tools:
- createContact: Create new contacts
- searchContacts: Find contacts by name, email, etc.
- createOpportunity: Create sales opportunities
- updateOpportunityStage: Move deals through pipeline

Guidelines:
- Always confirm before creating or updating data
- Use tools to fetch real-time information
- Be concise but thorough
- Format responses in markdown for readability

${context?.additionalInstructions || ''}`;
}

export function getThinkingPrompt(goal: string, iteration: number): string {
  return `Goal: ${goal}

Current iteration: ${iteration}

Think step-by-step:
1. What information do I need?
2. What tool should I use?
3. What will I do with the result?

Respond with your reasoning and chosen action.`;
}
```

### Extract Message Handler

```typescript
// src/server/agents/chat/handler.ts
import type { Connection } from 'agents';
import type { Message } from '@/shared/types/message.types';
import { MESSAGE_TYPES } from '@/shared/constants/message-types';

export class MessageHandler {
  constructor(
    private readonly agent: any, // ChatAgent instance
    private readonly sessionManager: SessionManager
  ) {}

  async handleMessage(connection: Connection, data: any): Promise<void> {
    const message = typeof data === 'string' ? JSON.parse(data) : data;

    switch (message.type) {
      case MESSAGE_TYPES.USER_MESSAGE:
        return this.handleUserMessage(connection, message);

      case MESSAGE_TYPES.GET_MESSAGES:
        return this.handleGetMessages(connection);

      case MESSAGE_TYPES.TOOL_INVOKE:
        return this.handleToolInvoke(connection, message);

      default:
        console.warn('[MessageHandler] Unknown message type:', message.type);
    }
  }

  private async handleUserMessage(connection: Connection, message: any): Promise<void> {
    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message.content,
      timestamp: Date.now()
    };

    await this.sessionManager.saveMessage(this.agent.sessionId, userMsg);

    // Stream AI response
    await this.agent.streamResponse(connection, message.content);
  }

  private async handleGetMessages(connection: Connection): Promise<void> {
    const messages = await this.sessionManager.loadSession(this.agent.sessionId);

    connection.send(JSON.stringify({
      type: MESSAGE_TYPES.HISTORY_LOADED,
      messages
    }));
  }

  private async handleToolInvoke(connection: Connection, message: any): Promise<void> {
    // Direct tool invocation (MCP Apps pattern)
    const { toolName, parameters } = message;

    try {
      const tool = this.agent.getTool(toolName);
      const result = await tool.execute(parameters);

      connection.send(JSON.stringify({
        type: MESSAGE_TYPES.TOOL_INVOKE_RESULT,
        toolName,
        result
      }));
    } catch (error) {
      connection.send(JSON.stringify({
        type: MESSAGE_TYPES.TOOL_INVOKE_ERROR,
        toolName,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }
}
```

### New ChatAgent (Slim)

```typescript
// src/server/agents/chat/ChatAgent.ts
import { Agent } from 'agents';
import { MessageHandler } from './handler';
import { getSystemPrompt } from './prompts';
import { DefaultSessionManager } from '@/server/memory/session-manager';
import { SessionDO } from '@/server/persistence/session/SessionDO';

export class ChatAgent extends Agent {
  private messageHandler: MessageHandler;
  private sessionManager: SessionManager;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    // Initialize dependencies
    const sessionDO = new SessionDO(state, env);
    this.sessionManager = new DefaultSessionManager(sessionDO);
    this.messageHandler = new MessageHandler(this, this.sessionManager);
  }

  async onMessage(connection: Connection, data: any): Promise<void> {
    await this.messageHandler.handleMessage(connection, data);
  }

  async streamResponse(connection: Connection, userMessage: string): Promise<void> {
    // Use AI service to stream response
    // (Implementation moved to src/server/services/ai/llm-service.ts)
  }

  // ... other methods
}
```

---

## Validation Checklist

After each phase, verify:

- [ ] `pnpm build` succeeds without errors
- [ ] `pnpm dev` starts successfully
- [ ] WebSocket connection works
- [ ] Chat messages send/receive
- [ ] Tool invocation works
- [ ] No TypeScript errors
- [ ] No runtime errors in console
- [ ] All tests pass (if any)

---

## Common Migration Issues

### Issue 1: Import Paths

**Problem**: `Cannot find module '@/shared/types'`

**Solution**: Update `tsconfig.json` paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/client/*": ["./src/client/*"],
      "@/server/*": ["./src/server/*"]
    }
  }
}
```

### Issue 2: Circular Dependencies

**Problem**: `Module has circular dependency`

**Solution**: Use interfaces and dependency injection:

```typescript
// Bad
import { ChatAgent } from './ChatAgent';

// Good
import type { Agent } from './types';
```

### Issue 3: DO Binding Names

**Problem**: `ReferenceError: CHAT_AGENT is not defined`

**Solution**: Update `wrangler.jsonc` bindings to match new structure.

---

## Next Steps

1. ✅ Review this migration guide
2. ✅ Start Phase 1 (create foundation)
3. Test after each step
4. Commit frequently (`git commit -m "Phase 1.1: Create base DO"`)
5. Move to Phase 2 only after Phase 1 works

---

## Phase 7-12: Distributed Agent System (Optional)

After completing Phases 1-6, you can evolve the system into a **distributed stigmergic agent network**. This is optional but unlocks powerful capabilities.

### Overview: From Centralized to Distributed

**Current (after Phase 6)**: Layered architecture with centralized coordination
```
ChatAgent (DO) → calls tools → updates state → responds to user
```

**Distributed (after Phase 12)**: Autonomous agents with trace-based coordination
```
SupportAgent → deposits trace → Context Graph
                                      ↓
HealthAgent  → discovers trace → deposits health score
                                      ↓ KV propagation
ChurnAgent   → pattern match → deposits prediction
```

### Phase 7: Trace Infrastructure (Week 7)

**Goal**: Build trace system alongside existing CRM

**Steps**:

1. **Create trace types**
```bash
cat > src/shared/types/trace.types.ts << 'EOF'
export interface Trace {
  id: string;
  namespace: string;
  entityId: string;
  agentType: string;
  timestamp: number;
  decayHalfLife: number;
  reinforcementWeight: number;
  jurisdictionConstraints: string[];
  payload: Record<string, unknown>;
  parentTraces: string[];
}
EOF
```

2. **Create AccountContextGraph DO**
```typescript
// src/server/persistence/context/AccountContextGraph.ts
import { BaseDO } from '../base/BaseDO';

export class AccountContextGraph extends BaseDO {
  async depositTrace(trace: Trace): Promise<void> {
    await this.set(`trace:${trace.id}`, trace);
    // Update indexes
    // Check replication threshold
  }

  async queryTraces(query: TraceQuery): Promise<Trace[]> {
    // Query with filters
    // Apply decay calculation
    // Return sorted results
  }
}
```

3. **Add DO binding**
```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      // ... existing
      {
        "name": "ACCOUNT_CONTEXT_GRAPH",
        "class_name": "AccountContextGraph"
      }
    ]
  }
}
```

4. **Create admin endpoints for testing**
```typescript
// src/server/gateway/api-router.ts
app.post('/api/traces/deposit', async (c) => {
  const trace = await c.req.json();
  const graph = getAccountGraph(trace.entityId, c.env);
  await graph.depositTrace(trace);
  return c.json({ success: true });
});

app.get('/api/traces/:accountId', async (c) => {
  const accountId = c.req.param('accountId');
  const graph = getAccountGraph(accountId, c.env);
  const traces = await graph.queryTraces({ entityId: accountId });
  return c.json({ traces });
});
```

**Deliverables**:
- [ ] Trace types defined
- [ ] AccountContextGraph DO created
- [ ] Manual trace deposit works via API
- [ ] Trace query returns results
- [ ] Existing CRM unchanged

### Phase 8: Support Agent Worker (Week 8)

**Goal**: First autonomous agent that deposits traces

**Steps**:

1. **Create Support Queue**
```jsonc
// wrangler.jsonc
{
  "queues": {
    "producers": [
      { "queue": "support-tickets", "binding": "SUPPORT_QUEUE" }
    ],
    "consumers": [
      {
        "queue": "support-tickets",
        "max_batch_size": 1,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "support-dlq"
      }
    ]
  }
}
```

2. **Create SupportAgent worker**
```typescript
// src/server/agents/support/SupportAgent.ts
export class SupportAgentWorker {
  async processTicket(ticket: SupportTicket, env: Env) {
    // 1. Get context graph
    const graph = getAccountGraph(ticket.accountId, env);

    // 2. Query recent history
    const history = await graph.queryTraces({
      entityId: ticket.accountId,
      timeRange: { start: Date.now() - 7*24*60*60*1000, end: Date.now() }
    });

    // 3. Analyze sentiment
    const sentiment = await analyzeSentiment(ticket.content, env.AI);

    // 4. Deposit trace
    await graph.depositTrace({
      id: `trace_support_${crypto.randomUUID()}`,
      namespace: 'accounts',
      entityId: ticket.accountId,
      agentType: 'support-analyzer',
      timestamp: Date.now(),
      decayHalfLife: 72 * 60 * 60 * 1000,
      reinforcementWeight: 1.0,
      jurisdictionConstraints: determineJurisdiction(ticket),
      payload: { sentiment, ticketId: ticket.id },
      parentTraces: []
    });
  }
}
```

3. **Queue consumer**
```typescript
// src/server/gateway/queue-consumer.ts
export default {
  async queue(batch: MessageBatch<SupportTicket>, env: Env) {
    for (const message of batch.messages) {
      const worker = new SupportAgentWorker();
      await worker.processTicket(message.body, env);
      message.ack();
    }
  }
}
```

**Deliverables**:
- [ ] Support Queue configured
- [ ] SupportAgent worker processes tickets
- [ ] Traces deposited automatically
- [ ] Sentiment analysis working
- [ ] Queue consumer handles messages

### Phase 9: Health Agent (Week 9)

**Goal**: Autonomous agent that discovers support traces

**Steps**:

1. **Create HealthAgent**
```typescript
// src/server/agents/health/HealthAgent.ts
export class HealthAgentWorker {
  async assessAccount(accountId: string, env: Env) {
    const graph = getAccountGraph(accountId, env);

    // Query for recent traces
    const traces = await graph.queryTraces({
      entityId: accountId,
      timeRange: { start: Date.now() - 30*24*60*60*1000, end: Date.now() }
    });

    // Calculate health from multiple signals
    const supportSignals = traces.filter(t => t.agentType === 'support-analyzer');
    const avgSentiment = calculateAvgSentiment(supportSignals);

    const healthScore = calculateHealth(avgSentiment, traces);

    // Deposit health trace
    await graph.depositTrace({
      id: `trace_health_${crypto.randomUUID()}`,
      namespace: 'accounts',
      entityId: accountId,
      agentType: 'health-monitor',
      timestamp: Date.now(),
      decayHalfLife: 168 * 60 * 60 * 1000,
      reinforcementWeight: 1.5,
      jurisdictionConstraints: [],
      payload: { healthScore, trend: 'declining' },
      parentTraces: supportSignals.map(t => t.id)
    });
  }
}
```

2. **Scheduled trigger**
```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": [
      "0 * * * *"  // Every hour
    ]
  }
}
```

```typescript
// src/server/workers/health-scheduler.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    // Get all active accounts
    const accounts = await getActiveAccounts(env);

    // Process each account
    const worker = new HealthAgentWorker();
    for (const accountId of accounts) {
      await worker.assessAccount(accountId, env);
    }
  }
}
```

**Deliverables**:
- [ ] HealthAgent worker created
- [ ] Scheduled trigger working
- [ ] Discovers support traces autonomously
- [ ] Calculates health scores
- [ ] Deposits traces with lineage

### Phase 10: Churn Agent (Week 10)

**Goal**: Agent that pattern-matches across multiple traces

**Steps**:

1. **Create ChurnAgent**
```typescript
// src/server/agents/churn/ChurnAgent.ts
export class ChurnAgentWorker {
  async analyzeChurnRisk(accountId: string, env: Env) {
    const graph = getAccountGraph(accountId, env);

    // Query all traces (30-day window)
    const traces = await graph.queryTraces({
      entityId: accountId,
      timeRange: { start: Date.now() - 30*24*60*60*1000, end: Date.now() }
    });

    // Pattern match across signals
    const supportNegative = traces.filter(t =>
      t.agentType === 'support-analyzer' &&
      (t.payload as any).sentiment < -0.5
    );

    const healthLow = traces.filter(t =>
      t.agentType === 'health-monitor' &&
      (t.payload as any).healthScore < 50
    );

    // Calculate churn probability
    const probability = calculateChurnProbability(supportNegative, healthLow);

    if (probability > 0.7) {
      // Deposit high-priority trace
      await graph.depositTrace({
        id: `trace_churn_${crypto.randomUUID()}`,
        namespace: 'accounts',
        entityId: accountId,
        agentType: 'churn-predictor',
        timestamp: Date.now(),
        decayHalfLife: 336 * 60 * 60 * 1000,
        reinforcementWeight: 2.0,
        jurisdictionConstraints: [],
        payload: {
          churnProbability: probability,
          riskLevel: probability > 0.9 ? 'critical' : 'high'
        },
        parentTraces: [...supportNegative.map(t => t.id), ...healthLow.map(t => t.id)]
      });
    }
  }
}
```

2. **Conditional trigger**
```typescript
// In AccountContextGraph.depositTrace()
if (trace.agentType === 'health-monitor' &&
    (trace.payload as any).healthScore < 50) {
  // Trigger churn analysis
  await env.CHURN_QUEUE.send({
    accountId: trace.entityId,
    triggerTrace: trace.id
  });
}
```

**Deliverables**:
- [ ] ChurnAgent worker created
- [ ] Triggered by health degradation
- [ ] Pattern matches across traces
- [ ] Deposits predictions with lineage
- [ ] High-priority traces marked

### Phase 11: Cross-Region Propagation (Week 11)

**Goal**: Deploy to second region, enable KV propagation

**Steps**:

1. **Deploy to EU region**
```bash
# Deploy with EU location hint
wrangler deploy --location eu
```

2. **Create KV namespaces**
```jsonc
// wrangler.jsonc
{
  "kv_namespaces": [
    // ... existing
    {
      "binding": "TRACE_KV",
      "id": "your-trace-kv-id"
    }
  ]
}
```

3. **Implement replication in AccountContextGraph**
```typescript
// In AccountContextGraph.depositTrace()
private async replicateToKV(trace: Trace): Promise<void> {
  const region = this.getRegion(); // 'eu' or 'us'

  // Check jurisdiction constraints
  if (trace.jurisdictionConstraints.length > 0 &&
      !trace.jurisdictionConstraints.includes(region.toUpperCase())) {
    return; // Don't replicate region-restricted traces
  }

  const key = `${region}:${trace.namespace}:${trace.entityId}:${trace.timestamp}`;
  await this.env.TRACE_KV.put(key, JSON.stringify(trace), {
    expirationTtl: trace.decayHalfLife / 1000
  });
}
```

4. **Create sync worker**
```typescript
// src/server/workers/sync-worker.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const myRegion = getRegion(); // 'us'
    const remoteRegion = myRegion === 'us' ? 'eu' : 'us';

    // Poll remote KV for new traces
    const { keys } = await env.TRACE_KV.list({
      prefix: `${remoteRegion}:`
    });

    for (const { name } of keys) {
      const traceJson = await env.TRACE_KV.get(name);
      if (!traceJson) continue;

      const trace: Trace = JSON.parse(traceJson);

      // Write to local DO
      const graph = getAccountGraph(trace.entityId, env);
      await graph.depositTrace(trace);
    }
  }
}
```

**Deliverables**:
- [ ] Deployed to EU and US regions
- [ ] KV namespace configured
- [ ] High-priority traces replicate to KV
- [ ] Sync worker pulls remote traces
- [ ] Jurisdiction constraints enforced

### Phase 12: Integration & Dashboard (Week 12)

**Goal**: End-to-end validation and observability

**Steps**:

1. **Create trace lineage endpoint**
```typescript
// src/server/gateway/api-router.ts
app.get('/api/traces/:traceId/lineage', async (c) => {
  const traceId = c.req.param('traceId');
  const lineage = await buildTraceLineage(traceId, c.env);
  return c.json({ lineage });
});

async function buildTraceLineage(traceId: string, env: Env) {
  // Recursively fetch parent traces
  const visited = new Set<string>();
  const lineage: Trace[] = [];

  async function fetchTrace(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const trace = await findTrace(id, env);
    if (!trace) return;

    lineage.push(trace);

    for (const parentId of trace.parentTraces) {
      await fetchTrace(parentId);
    }
  }

  await fetchTrace(traceId);
  return lineage;
}
```

2. **Create admin dashboard**
```typescript
// src/client/routes/admin/traces.tsx
export default function TracesDashboard() {
  const [accountId, setAccountId] = useState('');
  const [traces, setTraces] = useState<Trace[]>([]);

  async function loadTraces() {
    const res = await fetch(`/api/traces/${accountId}`);
    const data = await res.json();
    setTraces(data.traces);
  }

  return (
    <div>
      <h1>Trace Timeline</h1>
      <input
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
        placeholder="Account ID"
      />
      <button onClick={loadTraces}>Load Traces</button>

      <TraceTimeline traces={traces} />

      {/* Click trace to see lineage */}
    </div>
  );
}
```

3. **End-to-end test**
```typescript
// tests/e2e/distributed-agents.test.ts
test('EU ticket triggers US churn prediction', async () => {
  // 1. Submit ticket in EU
  await submitTicket({
    accountId: 'test_account_123',
    content: 'I want to cancel my subscription!',
    region: 'eu'
  });

  // 2. Wait for support trace
  await waitForTrace('support-analyzer', 'test_account_123');

  // 3. Wait for health trace
  await waitForTrace('health-monitor', 'test_account_123');

  // 4. Wait for churn trace in US
  const churnTrace = await waitForTrace('churn-predictor', 'test_account_123', {
    region: 'us',
    timeout: 120000 // 2 minutes
  });

  // 5. Verify lineage
  expect(churnTrace.parentTraces.length).toBeGreaterThan(0);

  // 6. Query lineage
  const lineage = await getTraceLineage(churnTrace.id);
  expect(lineage).toContainAgentTypes(['support-analyzer', 'health-monitor']);
});
```

**Deliverables**:
- [ ] Trace lineage API working
- [ ] Admin dashboard shows traces
- [ ] End-to-end test passes
- [ ] Performance optimized
- [ ] Documentation complete

---

## Success Criteria: Distributed System

The distributed agent MVP succeeds when:

1. ✅ **Autonomous Coordination**
   - EU support ticket → US churn prediction
   - No centralized orchestrator
   - Full lineage traceable

2. ✅ **Graceful Degradation**
   - Disconnect US-EU regions
   - EU agents continue operating
   - Reconnect → automatic sync

3. ✅ **Stigmergic Properties**
   - Traces decay over time (72-336 hours)
   - Signals reinforce when overlapping
   - Stale context expires

4. ✅ **Compliance**
   - EU PII traces stay in EU
   - Global traces propagate everywhere
   - Jurisdiction enforced automatically

5. ✅ **Performance**
   - EU ticket → US prediction < 120 seconds
   - Trace queries < 50ms
   - Scales to 100k traces per account

---

## Questions?

- **Phase 1-6**: See [ARCHITECTURE_PROPOSAL.md](./ARCHITECTURE_PROPOSAL.md)
- **Phase 7-12**: See [DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md)
- **Quick Reference**: See [ARCHITECTURE_QUICK_REF.md](./ARCHITECTURE_QUICK_REF.md)
