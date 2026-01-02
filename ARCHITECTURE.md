# Multi-Agent CRM Architecture

## Overview

This CRM implements a **multi-agent architecture** where specialized AI agents collaborate to handle different aspects of CRM operations. Each agent is a **Cloudflare Durable Object** with persistent state, powered by **Cloudflare Workers AI** using the **AI SDK v6** and **workers-ai-provider**.

**Key Technologies:**

- **Runtime:** Cloudflare Workers (serverless edge compute)
- **AI Provider:** Cloudflare Workers AI (`@cf/meta/llama-3-8b-instruct`)
- **AI SDK:** AI SDK v6 with plain object tools (no wrapper functions)
- **State Management:** Durable Objects + @cloudflare/ai-chat
- **Frontend:** TanStack Start (React 19+)
- **Transport:** WebSocket for real-time streaming

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React)                           │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  ChatEngine Component                            │     │
│  │  - Message display (ReactMarkdown)               │     │
│  │  - Input handling                                 │     │
│  │  - Real-time streaming                           │     │
│  └──────────────────────────────────────────────────┘     │
│                         │                                   │
│                         │ WebSocket                        │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (Edge)                       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Chat Agent (Orchestrator)                       │     │
│  │  extends OrchestratorAgent                       │     │
│  │  - Receives user messages                        │     │
│  │  - Routes to specialized agents                  │     │
│  │  - Streams responses back                        │     │
│  └────────┬────────┬────────┬────────┬──────────────┘     │
│           │        │        │        │                     │
│      ┌────▼──┐ ┌──▼────┐ ┌─▼─────┐ ┌▼──────────┐        │
│      │Planning│ │Knowledge│ │Execution│ │Verification│        │
│      │ Agent  │ │ Agent  │ │ Agent  │ │  Agent    │        │
│      │        │ │        │ │        │ │           │        │
│      │Plans   │ │Retrieves│ │Performs│ │Validates  │        │
│      │tasks   │ │data &  │ │CRM     │ │data &     │        │
│      │        │ │insights│ │actions │ │quality    │        │
│      └────────┘ └────────┘ └────────┘ └───────────┘        │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Durable Objects State                           │     │
│  │  - AIChatAgent (message history)                 │     │
│  │  - Per-session isolation                         │     │
│  │  - Automatic persistence                         │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  Cloudflare Workers AI                           │     │
│  │  Model: @cf/meta/llama-3-8b-instruct             │     │
│  │  - Streaming responses                           │     │
│  │  - Tool calling (AI SDK v6 format)               │     │
│  │  - No API keys required                          │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── server/
│   └── agents/                    ← All agents consolidated here
│       ├── chat-agent.ts          ← Main entry (extends Orchestrator)
│       ├── orchestrator-agent.ts  ← Central coordinator with tools
│       ├── planning-agent.ts      ← Task breakdown specialist
│       ├── knowledge-agent.ts     ← Data retrieval & insights
│       ├── execution-agent.ts     ← CRM action performer
│       ├── verification-agent.ts  ← Data validation specialist
│       └── index.ts               ← Central exports
│
├── components/chat/
│   ├── ChatEngine.tsx             ← Main UI orchestrator
│   ├── hooks/
│   │   ├── useChatConnection.ts   ← WebSocket management
│   │   └── useChatState.ts        ← State management
│   └── [other UI components]
│
├── entry.cloudflare.ts            ← Worker entry + DO exports
└── router.tsx                     ← TanStack routing
```

## Agent Types

### 1. **Chat Agent (Main Orchestrator)**

**Location:** `src/server/agents/chat-agent.ts`  
**Durable Object:** `ChatAgent`  
**Base Class:** Extends `OrchestratorAgent`

**Location:** `src/server/agents/chat-agent.ts`  
**Durable Object:** `ChatAgent`  
**Base Class:** Extends `OrchestratorAgent`

**Purpose:**  
Main entry point that maintains backward compatibility. Inherits all orchestration logic from `OrchestratorAgent`.

**Code:**

```typescript
export class ChatAgent extends OrchestratorAgent {
  // Inherits all orchestration logic from OrchestratorAgent
  // This maintains backward compatibility with existing routes
}
```

### 2. **Orchestrator Agent**

**Location:** `src/server/agents/orchestrator-agent.ts`  
**Base Class:** `AIChatAgent` from `@cloudflare/ai-chat`

**Responsibilities:**

- Analyzes user intent from messages
- Executes CRM operations using built-in tools
- Maintains conversation context
- Streams responses in real-time

**Built-in Tools (AI SDK v6 format):**

```typescript
tools: {
  createContact: {
    description: "Create a new contact in the CRM",
    parameters: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      // ... more fields
    }),
    execute: async ({ name, email, phone }) => {
      // Tool implementation
      return JSON.stringify({ success: true, id: newId });
    }
  },

  listContacts: {
    description: "List all contacts with pagination",
    parameters: z.object({
      page: z.number().default(1),
      limit: z.number().default(10)
    }),
    execute: async ({ page, limit }) => {
      // Fetch contacts from storage
      return JSON.stringify({ contacts, total, page });
    }
  },

  searchContacts: {
    description: "Search contacts by name, email, or phone",
    parameters: z.object({
      query: z.string()
    }),
    execute: async ({ query }) => {
      // Search implementation
      return JSON.stringify({ results, count });
    }
  }
}
```

**Key Features:**

- Uses `workers-ai-provider` (not OpenAI)
- Model: `@cf/meta/llama-3-8b-instruct`
- Tools are plain objects (AI SDK v6 format, no `tool()` wrapper)
- Real-time streaming with `streamText()` from AI SDK
- Temperature: 0.3 for deterministic responses

### 3. **Planning Agent**

**Location:** `src/server/agents/planning-agent.ts`  
**Durable Object:** `PlanningAgent`

**Location:** `src/server/agents/planning-agent.ts`  
**Durable Object:** `PlanningAgent`

**Responsibilities:**

- Breaks down complex tasks into subtasks
- Creates step-by-step execution plans
- Identifies task dependencies
- Estimates effort and timelines

**Use Cases:**

- Multi-step CRM workflows
- Bulk data operations planning
- Pipeline setup strategies
- Migration planning

**Future Implementation:**

- Currently scaffolded for future expansion
- Will handle complex multi-step operations
- Integration with workflow engine

### 4. **Knowledge Agent**

**Location:** `src/server/agents/knowledge-agent.ts`  
**Durable Object:** `KnowledgeAgent`

**Responsibilities:**

- Searches and retrieves CRM data
- Provides context and historical information
- Generates insights from data
- Answers questions about records

**Future Tools:**

- Advanced search capabilities
- Data analytics and reporting
- Historical trend analysis
- Context-aware recommendations

### 5. **Execution Agent**

**Location:** `src/server/agents/execution-agent.ts`  
**Durable Object:** `ExecutionAgent`

**Responsibilities:**

- Performs CRM create/update/delete operations
- Executes bulk operations
- Handles data validation before execution
- Manages transactional operations

**Future Implementation:**

- Batch operations for contacts
- Integration with external APIs
- Workflow automation triggers

### 6. **Verification Agent**

**Location:** `src/server/agents/verification-agent.ts`  
**Durable Object:** `VerificationAgent`

**Responsibilities:**

- Validates data quality and integrity
- Checks for duplicates
- Verifies email/phone formats
- Ensures data consistency

**Future Tools:**

- Email verification API integration
- Phone number validation
- Duplicate detection algorithms
- Data enrichment services

## AI SDK v6 Tool Format

**Critical:** This project uses AI SDK v6 with plain object tools (NOT the `tool()` wrapper from v3).

**Correct Format:**

```typescript
const tools = {
  toolName: {
    description: "What the tool does",
    parameters: z.object({
      /* zod schema */
    }),
    execute: async (args) => {
      // Implementation
      return JSON.stringify(result);
    },
  },
};
```

**Incorrect (Old v3 format):**

```typescript
const tools = {
  toolName: tool({  // ❌ No tool() wrapper in v6
    description: "...",
    parameters: z.object({ ... }),
    execute: async (args) => { ... }
  })
};
```

## State Management

### Durable Objects Architecture

Each agent is a Durable Object, providing:

1. **Persistent State**: Messages survive worker restarts
2. **Session Isolation**: Each `sessionId` gets unique DO instance
3. **Geographic Distribution**: DOs created near users for low latency
4. **Automatic Serialization**: State managed by Cloudflare platform

### AIChatAgent Base Class

All agents extend `AIChatAgent` from `@cloudflare/ai-chat`:

```typescript
export class OrchestratorAgent extends AIChatAgent<any> {
  async onChatMessage(
    onFinish?: StreamTextOnFinishCallback<any>
  ): Promise<Response> {
    // Streaming implementation
  }

  private getModel() {
    const env = (this as any).env;
    const workersai = createWorkersAI({ binding: env.AI });
    return workersai("@cf/meta/llama-3-8b-instruct");
  }
}
```

**Benefits:**

- Automatic message history management
- Built-in WebSocket support
- Streaming response handling
- Environment binding access

### Session Management

```typescript
// Client creates agent stub
const agent = useAgent({
  agent: "ChatAgent",
  name: sessionId, // Unique session identifier
  onOpen: () => setIsConnected(true),
  onClose: () => setIsConnected(false),
  onError: () => setIsConnected(false),
});

// Send messages
await sendMessage({
  role: "user",
  parts: [{ type: "text", text: input }],
});
```

## Communication Flow

### 1. User Sends Message

```
User types → ChatEngine → useAgentChat hook → WebSocket
```

### 2. Worker Receives & Processes

```
Worker → ChatAgent DO → OrchestratorAgent.onChatMessage()
  → streamText() with tools
  → AI Model generates response
  → Tools executed if needed
```

### 3. Streaming Response

```
AI SDK → createUIMessageStream() → WebSocket → Client
  → React state updates → UI rerenders progressively
```

### 4. Tool Execution

```
AI detects tool need
  → Calls tool.execute()
  → Returns result to AI
  → AI incorporates result into response
  → Continues streaming
```

## WebSocket Protocol

### Message Types

**Client → Server:**

```json
{
  "role": "user",
  "parts": [{ "type": "text", "text": "Create contact John Doe" }]
}
```

**Server → Client (Streaming):**

```json
// Token chunks
{ "type": "text-delta", "textDelta": "Creating" }
{ "type": "text-delta", "textDelta": " contact..." }

// Tool call
{ "type": "tool-call", "toolCallId": "123", "toolName": "createContact" }

// Tool result
{ "type": "tool-result", "toolCallId": "123", "result": "..." }

// Complete
{ "type": "finish", "finishReason": "stop" }
```

## Deployment Configuration

### wrangler.jsonc

```jsonc
{
  "name": "tanstack-start-cloudflare",
  "main": "src/entry.cloudflare.ts",

  // AI binding (no API keys needed!)
  "ai": {
    "binding": "AI"
  },

  // Durable Objects for agent state
  "durable_objects": {
    "bindings": [
      { "name": "CHAT_AGENT", "class_name": "ChatAgent" },
      { "name": "PLANNING_AGENT", "class_name": "PlanningAgent" },
      { "name": "KNOWLEDGE_AGENT", "class_name": "KnowledgeAgent" },
      { "name": "EXECUTION_AGENT", "class_name": "ExecutionAgent" },
      { "name": "VERIFICATION_AGENT", "class_name": "VerificationAgent" }
    ]
  },

  "migrations": [
    {
      "tag": "v1",
      "new_classes": [
        "ChatAgent",
        "PlanningAgent",
        "KnowledgeAgent",
        "ExecutionAgent",
        "VerificationAgent"
      ]
    }
  ]
}
```

### entry.cloudflare.ts

```typescript
// Export all agents as Durable Objects
export { ChatAgent } from "@/server/agents/chat-agent";
export { PlanningAgent } from "@/server/agents/planning-agent";
export { KnowledgeAgent } from "@/server/agents/knowledge-agent";
export { ExecutionAgent } from "@/server/agents/execution-agent";
export { VerificationAgent } from "@/server/agents/verification-agent";
```

## Technology Stack Summary

| Layer                 | Technology                   | Purpose                 |
| --------------------- | ---------------------------- | ----------------------- |
| **Frontend**          | React 19 + TanStack Start    | UI framework            |
| **Styling**           | TailwindCSS v4               | Utility-first CSS       |
| **Markdown**          | react-markdown + remark-gfm  | Rich text rendering     |
| **State**             | React hooks + WebSocket      | Real-time state sync    |
| **Transport**         | WebSocket                    | Bidirectional streaming |
| **Runtime**           | Cloudflare Workers           | Serverless edge compute |
| **AI Provider**       | Cloudflare Workers AI        | LLM inference           |
| **AI SDK**            | AI SDK v6                    | Streaming & tools       |
| **Model**             | @cf/meta/llama-3-8b-instruct | Language model          |
| **Agent Framework**   | @cloudflare/ai-chat          | Agent abstraction       |
| **State Persistence** | Durable Objects              | Stateful instances      |
| **Schema Validation** | Zod                          | Type-safe validation    |

## Benefits of This Architecture

### 1. **Scalability**

- Edge deployment → low latency worldwide
- Durable Objects → automatic scaling per session
- Stateless workers → horizontal scaling

### 2. **Cost Efficiency**

- No API keys required (Workers AI included)
- Pay per request model
- Efficient resource utilization

### 3. **Developer Experience**

- Type-safe with TypeScript
- Hot reload in development
- Simple deployment (`wrangler deploy`)

### 4. **Performance**

- Streaming responses → perceived speed
- Edge compute → reduced latency
- WebSocket → real-time updates

### 5. **Maintainability**

- Clear separation of concerns
- Single folder for all agents
- Consistent patterns across agents

## Future Enhancements

### Short Term

- [ ] Implement Planning Agent logic
- [ ] Add Knowledge Agent search capabilities
- [ ] Build Execution Agent batch operations
- [ ] Integrate Verification Agent APIs

### Medium Term

- [ ] Add D1 database for persistent storage
- [ ] Implement KV for caching
- [ ] Add R2 for file attachments
- [ ] Multi-modal support (images, documents)

### Long Term

- [ ] Multi-agent collaboration workflows
- [ ] Agent-to-agent communication
- [ ] Custom agent creation by users
- [ ] Advanced analytics and reporting

## Development Workflow

```bash
# Install dependencies
pnpm install

# Start dev server (with hot reload)
pnpm dev

# Type checking
pnpm tsc --noEmit

# Deploy to production
pnpm deploy
```

## Debugging

### View Worker Logs

```bash
wrangler tail
```

### Inspect Durable Object State

```bash
wrangler durable-objects:list CHAT_AGENT
```

### Test Locally

All agents work in local development with the same code as production.

- "Show me contacts from Acme Corp"
- "What's the status of deal #123?"
- "Find all opportunities closing this month"

### 4. **Execution Agent**

**Location:** `src/server/agents/execution-agent.ts`  
**Durable Object:** `EXECUTION_AGENT`

**Responsibilities:**

- Performs CRM operations (Create, Update, Delete)
- Validates inputs before execution
- Logs all operations for audit trail
- Handles errors gracefully

**Tools:**

- `createContact` - Add new contacts
- `updateContact` - Modify existing contacts
- `createOpportunity` - Create sales opportunities

**Use Cases:**

- "Create a contact for John Smith at Acme Corp"
- "Update Jane's phone number"
- "Add a new opportunity worth $50k"

### 5. **Verification Agent**

**Location:** `src/server/agents/verification-agent.ts`  
**Durable Object:** `VERIFICATION_AGENT`

**Responsibilities:**

- Validates data quality and format
- Detects duplicate records
- Ensures data integrity
- Provides quality scoring

**Tools:**

- `validateContact` - Check contact data quality
- `checkDuplicates` - Find duplicate records
- `auditDataQuality` - Comprehensive audit

**Quality Levels:**

- 🔴 **CRITICAL** - Must fix (blocks operations)
- 🟡 **WARNING** - Should fix (reduces quality)
- 🟢 **PASSED** - All checks passed

## Technology Stack

### Core Framework

- **TanStack Start** - React-based full-stack framework
- **Cloudflare Workers** - Edge runtime
- **Cloudflare Durable Objects** - Stateful agent instances
- **Cloudflare Workers AI** - AI inference (Llama 3.3 70B)

### Agent Framework

- **@cloudflare/ai-chat** - Chat agent framework with persistence
- **workers-ai-provider** - Cloudflare AI integration for Vercel AI SDK
- **ai (Vercel AI SDK)** - Streaming, tools, message handling

### Storage

- **Durable Object Storage** - Per-agent persistent state
- **D1 Database** (configured, ready to use) - SQL database for CRM data

## Data Flow

### 1. Message Handling

```typescript
User Message
  ↓
ChatEngine (React)
  ↓
useAgentChat hook
  ↓
WebSocket to Durable Object
  ↓
Orchestrator Agent.onChatMessage()
  ↓
Intent Analysis → Route to Specialist
  ↓
Specialist Agent (Planning/Knowledge/Execution/Verification)
  ↓
Execute tools/operations
  ↓
Stream response back
  ↓
Update UI in real-time
```

### 2. State Persistence

```typescript
// Each agent has its own Durable Object storage
await state.storage.put("contacts", contacts);
await state.storage.get("activities");

// Messages automatically persisted by AIChatAgent
this.messages; // Available across sessions
```

## Usage Examples

### Creating a Contact

```
User: "Create a contact for Sarah Johnson at TechCorp,
       email: sarah@techcorp.com, phone: +1-555-0123"

Orchestrator: [Routes to Execution Agent]
Execution Agent:
  - Validates input
  - Creates contact record
  - Logs activity
  - Returns confirmation

Response: "✅ Contact created: Sarah Johnson
          ID: abc-123-def
          Company: TechCorp"
```

### Planning Complex Workflow

```
User: "How do I import 100 contacts from a CSV file?"

Orchestrator: [Routes to Planning Agent]
Planning Agent:
  **Plan:** CSV Contact Import

  **Steps:**
  1. Prepare CSV file - Agent: Knowledge
  2. Validate data format - Agent: Verification
  3. Check for duplicates - Agent: Verification
  4. Batch create contacts - Agent: Execution
  5. Verify import results - Agent: Verification

  **Estimated Time:** 5-10 minutes
  **Notes:** Recommend batches of 25 contacts
```

### Data Quality Check

```
User: "Check my CRM data quality"

Orchestrator: [Routes to Verification Agent]
Verification Agent:
  🟢 Data Quality Report

  Total Contacts: 47
  Average Quality Score: 82/100

  🟡 3 warnings found
  🔴 1 critical issue

  Recommendations:
  - Fix 1 contact with invalid email
  - Add phone numbers for 3 contacts
  - Consider enriching company info
```

## Configuration

### Environment Variables

No API keys required! Uses Cloudflare AI binding directly.

### Wrangler Configuration

All agents are registered in `wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "CHAT_AGENT", "class_name": "ChatAgent" },
      { "name": "PLANNING_AGENT", "class_name": "PlanningAgent" },
      { "name": "KNOWLEDGE_AGENT", "class_name": "KnowledgeAgent" },
      { "name": "EXECUTION_AGENT", "class_name": "ExecutionAgent" },
      { "name": "VERIFICATION_AGENT", "class_name": "VerificationAgent" }
    ]
  },
  "ai": {
    "binding": "AI"
  }
}
```

## Development

### Running Locally

```bash
pnpm dev
```

The dev server starts with:

- Chat interface at `http://localhost:3000/chat`
- All agents available via Durable Objects
- Hot module reloading enabled

### Testing Agents Individually

You can test specific agents by modifying the orchestrator routing logic or accessing them directly through the agents API.

### Adding New Agents

1. Create agent class extending `AIChatAgent`
2. Implement `onChatMessage()` with specialized logic
3. Add to `src/entry.cloudflare.ts` exports
4. Register in `wrangler.jsonc` durable_objects

## Deployment

```bash
pnpm build
pnpm deploy
```

Agents are deployed as:

- Cloudflare Workers (edge compute)
- Durable Objects (stateful instances)
- Workers AI binding (no external APIs)

## Future Enhancements

### Phase 1 (Current)

- ✅ Multi-agent architecture
- ✅ Cloudflare Workers AI integration
- ✅ Durable Object storage
- ✅ Real-time streaming responses

### Phase 2 (Planned)

- [ ] D1 Database integration for persistent CRM data
- [ ] Agent-to-agent communication (Planning → Execution)
- [ ] Advanced workflow orchestration
- [ ] Custom tool creation interface

### Phase 3 (Future)

- [ ] Vector embeddings for semantic search
- [ ] R2 storage for documents/files
- [ ] Email integration (send/receive)
- [ ] Calendar sync
- [ ] Analytics dashboard

## Cost Optimization

**Cloudflare Workers AI Pricing:**

- First 10,000 neurons/day: Free
- After: $0.011 per 1,000 neurons
- Neurons ≈ input + output tokens

**Typical Costs:**

- Contact creation: ~500 neurons (~$0.0055)
- Data retrieval: ~300 neurons (~$0.0033)
- Complex planning: ~1000 neurons (~$0.011)

**Daily Usage Estimate:**

- 100 interactions/day ≈ 50,000 neurons
- First 10k free, remaining 40k ≈ $0.44/day
- Monthly: ~$13.20 for moderate usage

**No additional costs for:**

- Durable Object storage (first 1GB free)
- Workers requests (first 100k/day free)
- D1 database (generous free tier)

## Monitoring & Debugging

### Console Logs

Each agent logs its operations:

```typescript
console.log("[OrchestratorAgent] Routing to:", intent);
console.log("[ExecutionAgent] Created contact:", contactId);
console.log("[VerificationAgent] Quality score:", score);
```

### Durable Object Inspector

Access via Cloudflare Dashboard:

- View active Durable Objects
- Inspect storage contents
- Monitor memory usage
- Check request patterns

## Support & Troubleshooting

### Common Issues

**Agent not responding:**

- Check Durable Object binding in wrangler.jsonc
- Verify agent exported in entry.cloudflare.ts
- Check Workers AI binding is active

**Data not persisting:**

- Ensure using `await state.storage.put()`
- Check Durable Object session ID
- Verify storage quota not exceeded

**Quality checks failing:**

- Review validation rules in VerificationAgent
- Check data format expectations
- Verify email/phone regex patterns

---

**Built with ❤️ using Cloudflare's edge-first AI stack**
