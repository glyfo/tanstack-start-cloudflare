# Architecture Quick Reference

## File Organization Cheat Sheet

### Where to Put New Code

| Task | Location | Max Lines |
|------|----------|-----------|
| **New React component** | `src/client/components/` | 200 |
| **New custom hook** | `src/client/hooks/` | 150 |
| **New route/page** | `src/client/routes/` | 300 |
| **New agent** | `src/server/agents/{name}/` | 400/file |
| **New tool** | `src/server/tools/{name}-tools.ts` | 300 |
| **New service** | `src/server/services/{category}/` | 280 |
| **New DO** | `src/server/persistence/{category}/` | 400 |
| **Shared type** | `src/shared/types/` | 200 |
| **Shared constant** | `src/shared/constants/` | 100 |

---

## Import Rules

### ✅ Allowed

```typescript
// Client can import shared
import type { Message } from '@/shared/types/message.types';

// Server can import shared
import { MESSAGE_TYPES } from '@/shared/constants/message-types';

// Agents can import tools, memory, services
import { toolRegistry } from '@/server/tools/registry';

// Services can import persistence
import type { StorageAdapter } from '@/server/persistence/base/storage-adapter';
```

### ❌ Forbidden

```typescript
// Client cannot import server
import { ChatAgent } from '@/server/agents/chat/ChatAgent'; // ❌

// Persistence cannot import agents
import { ChatAgent } from '@/server/agents/chat/ChatAgent'; // ❌

// Shared cannot import anything
import { something } from '@/server/tools'; // ❌
```

---

## Message Flow

### User Message → Agent Response

```
1. User types message in ChatEngine
   └─> client/components/chat/ChatEngine.tsx

2. Send via WebSocket
   └─> client/hooks/useAgent.ts

3. Gateway receives
   └─> server/gateway/websocket-handler.ts

4. Route to ChatAgent DO
   └─> server/agents/chat/ChatAgent.ts

5. MessageHandler processes
   └─> server/agents/chat/handler.ts

6. Load session history
   └─> server/memory/session-manager.ts
   └─> server/persistence/session/SessionDO.ts

7. Call LLM with context
   └─> server/services/ai/llm-service.ts

8. Execute tools if needed
   └─> server/tools/registry.ts

9. Stream response back
   └─> WebSocket to client

10. Render in UI
    └─> client/components/chat/MessageRenderer.tsx
```

### Direct Tool Invocation (MCP Apps Pattern)

```
1. User submits form
   └─> client/components/chat/forms/ContactFormCard.tsx

2. Call invokeTool()
   └─> client/hooks/useInvokeTool.ts

3. Send tool-invoke message
   └─> WebSocket

4. Gateway routes to agent
   └─> server/gateway/websocket-handler.ts

5. Agent receives tool-invoke
   └─> server/agents/chat/handler.ts
   └─> handleToolInvoke()

6. Execute tool directly (no LLM)
   └─> server/tools/contact-tools.ts
   └─> tool.execute(params)

7. Return result
   └─> tool-invoke-result via WebSocket

8. UI shows success/error
   └─> Form shows confirmation
```

---

## Component Responsibilities

### Gateway Layer
- **Purpose**: Route requests to appropriate handlers
- **Files**: `src/server/gateway/`
- **Responsibilities**:
  - WebSocket upgrade handling
  - HTTP API routing
  - Webhook authentication
  - CORS headers

### Agent Layer
- **Purpose**: Business logic and orchestration
- **Files**: `src/server/agents/`
- **Responsibilities**:
  - Process user messages
  - Manage conversation state
  - Call LLM with context
  - Execute autonomous loops
  - **Does NOT**: Handle storage directly (uses services)

### Memory Layer
- **Purpose**: Session and message management
- **Files**: `src/server/memory/`
- **Responsibilities**:
  - Load/save messages
  - Context compaction
  - Long-term memory
  - Session lifecycle
  - **Does NOT**: Know about agents or tools

### Tool Layer
- **Purpose**: Reusable actions for agents
- **Files**: `src/server/tools/`
- **Responsibilities**:
  - Define tool schemas
  - Execute tool logic
  - Validate parameters
  - Return structured results
  - **Does NOT**: Call LLM or manage state

### Service Layer
- **Purpose**: Shared business logic
- **Files**: `src/server/services/`
- **Responsibilities**:
  - LLM abstraction
  - CRM operations
  - Social media integrations
  - **Does NOT**: Handle WebSocket or HTTP directly

### Persistence Layer
- **Purpose**: Data storage
- **Files**: `src/server/persistence/`
- **Responsibilities**:
  - Durable Object implementations
  - Storage operations (get/set/list)
  - Data migrations
  - **Does NOT**: Contain business logic

---

## Naming Conventions

### Files

```
PascalCase.tsx        # React components
kebab-case.ts         # Regular TypeScript files
{name}.types.ts       # Type definitions
{name}.constants.ts   # Constants
{name}-service.ts     # Services
{name}-tools.ts       # Tool definitions
{Name}DO.ts           # Durable Objects
```

### Functions

```typescript
// Components
export function ChatEngine() { }

// Hooks
export function useAgent() { }

// Services
export class ContactService { }

// Tools
export const contactTools = { }

// Handlers
export async function websocketHandler() { }
```

### Variables

```typescript
const MESSAGE_TYPES = { };        // Constants (SCREAMING_SNAKE_CASE)
const sessionManager = ...;       // Instances (camelCase)
type MessageType = ...;           // Types (PascalCase)
interface AgentContext { };       // Interfaces (PascalCase)
```

---

## Common Patterns

### Pattern 1: Creating a New Tool

```typescript
// 1. Define in src/server/tools/{domain}-tools.ts
import { tool } from 'ai';
import { z } from 'zod';

export const myTools = {
  myAction: tool({
    description: 'What this does and when to use it',
    parameters: z.object({
      param: z.string().describe('What this parameter is')
    }),
    execute: async ({ param }) => {
      // Logic here
      return 'Success message';
    }
  })
};

// 2. Register in src/server/tools/registry.ts
import { myTools } from './my-tools';

export function getTools() {
  return {
    ...existingTools,
    ...myTools  // Add here
  };
}

// 3. Update agent system prompt to mention it
```

### Pattern 2: Creating a New Agent

```typescript
// 1. Create directory src/server/agents/{name}/
//    - {Name}Agent.ts
//    - handler.ts
//    - prompts.ts

// 2. Implement Agent class
import { Agent } from 'agents';
import { MessageHandler } from './handler';

export class MyAgent extends Agent {
  constructor(state, env) {
    super(state, env);
    this.messageHandler = new MessageHandler(this);
  }

  async onMessage(connection, data) {
    await this.messageHandler.handleMessage(connection, data);
  }
}

// 3. Export in src/entry.cloudflare.ts
export { MyAgent } from './server/agents/my/MyAgent';

// 4. Add binding in wrangler.jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "MY_AGENT", "class_name": "MyAgent" }
    ]
  }
}
```

### Pattern 3: Creating a Form with Direct Tool Invocation

```typescript
// src/client/components/chat/forms/MyFormCard.tsx
import { useInvokeTool } from '@/client/hooks/useInvokeTool';

export function MyFormCard() {
  const invokeTool = useInvokeTool();
  const [data, setData] = useState({ });

  async function handleSubmit() {
    const result = await invokeTool('server.myTool', data);

    if (result.success) {
      // Show success
    } else {
      // Show error
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

## Debugging Guide

### Issue: "Module not found"

```bash
# Check import paths in tsconfig.json
cat tsconfig.json | grep paths

# Verify file exists
ls -la src/shared/types/message.types.ts

# Rebuild
pnpm build
```

### Issue: "Cannot find DO binding"

```bash
# Check wrangler.jsonc bindings
cat wrangler.jsonc | grep durable_objects

# Verify export in entry.cloudflare.ts
cat src/entry.cloudflare.ts | grep export

# Restart dev server
pnpm dev
```

### Issue: "Circular dependency"

```typescript
// Use type-only imports
import type { Agent } from './types';

// Not:
import { Agent } from './Agent';
```

### Issue: "State not persisting"

```bash
# Check DO storage calls
# Ensure using BaseDO.set() not direct state.storage.put()

# Verify migrations in wrangler.jsonc
cat wrangler.jsonc | grep migrations
```

---

## Quick Command Reference

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm deploy                 # Deploy to Cloudflare

# Type checking
pnpm tsc --noEmit          # Check types without building

# Testing
pnpm test                   # Run tests
pnpm test:watch            # Watch mode

# Cloudflare
wrangler tail              # View logs
wrangler tail --format=pretty
wrangler durable-objects:list CHAT_AGENT

# Structure verification
tree -L 3 src/             # View directory structure
find src -name "*.ts*" -exec wc -l {} + | sort -rn | head -20
```

---

## File Size Limits

If a file exceeds these limits, split it:

| Type | Limit | Action |
|------|-------|--------|
| Component | 200 lines | Extract child components or hooks |
| Agent | 400 lines | Split into handler, prompts, state files |
| Tool file | 300 lines | Group related tools, split by domain |
| Service | 280 lines | Extract helpers or create subservices |
| DO | 400 lines | Use BaseDO, extract logic to services |

---

## Architecture Principles

1. **Separation of Concerns**: Each module has one job
2. **Dependency Inversion**: Depend on interfaces, not implementations
3. **Single Responsibility**: Files should do one thing well
4. **DRY (Don't Repeat Yourself)**: Extract common logic to shared modules
5. **KISS (Keep It Simple)**: Prefer simple solutions over clever ones
6. **Explicit Over Implicit**: Clear imports and types over magic
7. **Small Files**: Easier to understand and maintain
8. **Layered Architecture**: Upper layers depend on lower, never reverse

---

## Before You Code

Ask yourself:

1. **Where does this belong?** (Check "Where to Put New Code")
2. **What layer is this?** (Gateway, Agent, Service, Persistence)
3. **What can it import?** (Check "Import Rules")
4. **How big will this file be?** (Check "File Size Limits")
5. **Does something similar exist?** (Search codebase first)

---

## Resources

- Full proposal: [ARCHITECTURE_PROPOSAL.md](./ARCHITECTURE_PROPOSAL.md)
- Migration steps: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- Current README: [../README.md](../README.md)

---

**Last Updated**: 2026-02-13
