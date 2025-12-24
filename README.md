# TanStack Start + Cloudflare AI Agent

A production-grade AI chat application built with **TanStack React Start**, **Cloudflare Workers AI**, and **Cloudflare Agents Framework** with **Generic Schema-Driven Conversational Forms**.

Features real-time WebSocket communication, persistent agent state, automatic CRUD operations through natural language, and professional-grade AI orchestration.

## 📚 Table of Contents

- [Core Architecture](#core-architecture)
- [Chat Component Architecture](#chat-component-architecture)
- [Naming Conventions](#naming-conventions)
- [Multi-Agent System](#multi-agent-system)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Customization](#customization)
- [Deployment](#deployment)

---

## 🎯 Core Architecture

### Two-Layer System: AI Chat + Conversational Forms

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                              │
│  - Chat Interface (message display & input)                     │
│  - Auto-detect: form response vs. AI chat                       │
│  - Send: { type: "chat"|"field_value", content|value }         │
└─────────────────────────────────────────────────────────────────┘
                            │
                  WebSocket (persistent)
                            │
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER SIDE                                │
│                 (Cloudflare Worker)                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Intent Detection Layer                                 │   │
│  │  ├─ detectIntent() → matches keywords to actions       │   │
│  │  └─ actionSchemas.ts → Single source of truth          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│      ┌──────────────┐            ┌──────────────┐              │
│      │ AI Response  │            │ Form Flow    │              │
│      │              │            │              │              │
│      │ Regular chat │            │ Conversational              │
│      │ → Claude API │            │ field questions             │
│      │ → Stream     │            │ → Validation                │
│      └──────────────┘            │ → Storage                   │
│                                  └──────────────┘              │
│                                       │                         │
│                                  ┌────────────────┐            │
│                                  │ Action Handlers│            │
│                                  │ - Contact CRUD │            │
│                                  │ - Content CRUD │            │
│                                  │ - Order Create │            │
│                                  │ - Subscribe    │            │
│                                  │ + Extensible   │            │
│                                  └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Key Capabilities

- **Flexible Architecture**: Choose between stateless and stateful patterns
- **Tool Integration**: Automatic tool detection and execution
- **Real-time Streaming**: Server-Sent Events (SSE) for progressive token streaming
- **Session Management**: Multi-session support with isolated state
- **WebSocket Communication**: Persistent bidirectional connection
- **Agent Framework Integration**: Full Durable Objects and RPC support

---

## 📋 Chat Component Architecture

### Component Tree

```
ChatEngine (Orchestrator - 70 lines)
│
├─ useChatConnection() ──> WebSocket Management
│  └─ Handles: connection, messages, errors
│
├─ useChatState() ──> State Management
│  └─ Manages: messages[], loading, error
│
├─ ChatHeader (30 lines)
│  ├─ Title: "SuperHuman"
│  └─ Action: Clear History
│
├─ ChatWelcome (40 lines) OR ChatMessages (50 lines)
│  │
│  ├─ ChatWelcome (initial state)
│  │  └─ Quick action suggestions
│  │
│  └─ ChatMessages (conversation)
│     ├─ MessageRenderer (from ChatRenderer.tsx)
│     │  ├─ User message bubble
│     │  ├─ Assistant message bubble
│     │  ├─ Success state
│     │  └─ Components (A2UI)
│     │
│     ├─ MarkdownMessage (for markdown content)
│     ├─ TypingIndicator (for loading)
│     └─ Error display
│
└─ ChatInput (40 lines)
   ├─ Text input field
   ├─ Submit button
   └─ Keyboard handlers (Enter)
```

### Data Flow

```
User Action
    │
    ├─ Type message ──> ChatInput.onChange ──> setInput
    │
    ├─ Submit message ──> handleSubmit ──> sendChatMessage
    │                                           │
    │                                           └─> useChatConnection.sendMessage()
    │                                               └─ WebSocket.send(JSON)
    │
    └─ Receive message ──> WebSocket.onmessage
                               │
                               └─> handleMessage() [in hook]
                                   │
                                   └─> onMessageReceived() callback
                                       │
                                       └─> useChatState.addMessage()
                                           │
                                           └─ setMessages() [React state]
                                               │
                                               └─ ChatMessages renders
                                                   │
                                                   └─ MessageRenderer displays
                                                       │
                                                       ├─ MarkdownMessage
                                                       ├─ UIRenderer (components)
                                                       └─ Success states
```

### Supported Message Types (22 types)

**Connection:**

- `connected` - Agent connected
- `history` - Load conversation history
- `error` - General errors

**Chat Flow:**

- `message_added` - User message added
- `message_stream` - Streaming response chunks
- `message_complete` - Message finished

**Form Flow:**

- `field_question` - Ask for field value
- `field_valid` - Field validated
- `field_error` - Field validation failed

**Workflow:**

- `progress` - Progress update
- `success` - Workflow completed
- `flow_error` - Workflow error

**Wizard Flow:**

- `wizard_open` - Open wizard dialog
- `history_cleared` - History cleared

### Hook Specifications

#### useChatConnection(sessionId, callbacks)

**Input:**

- `sessionId` (string) - Session identifier
- `onMessageReceived` (callback) - Message handler
- `onError` (callback) - Error handler
- `onLoadingChange` (callback) - Loading state change

**Output:**

```ts
{
  isConnected: boolean,
  error: string | null,
  sendMessage(type, payload): boolean,
  clearHistory(): void,
  wsRef: WebSocket ref
}
```

**Responsibilities:**

- WebSocket lifecycle (open, close, error)
- 22 message type handlers via switch statement
- Message parsing and validation
- Logging and debugging
- Error recovery

#### useChatState()

**Input:** None

**Output:**

```ts
{
  messages: RenderedMessage[],
  isLoading: boolean,
  error: string | null,
  setIsLoading(bool): void,
  setError(string): void,
  addMessage(msg): void,
  clearMessages(): void,
  messagesEndRef: React.RefObject<HTMLDivElement>
}
```

**Responsibilities:**

- Message state management
- Streaming message accumulation (by message ID)
- Auto-scroll functionality
- Loading/error states

### File Organization

**`src/components/chat/` - Chat Feature Components**

```
src/components/chat/
├── ChatEngine.tsx (70 lines) .............. Main orchestrator component
├── ChatHeader.tsx (30 lines) ............. Header with clear action
├── ChatMessages.tsx (50 lines) ........... Message list & rendering
├── ChatInput.tsx (40 lines) .............. User input form
├── ChatWelcome.tsx (40 lines) ............ Initial welcome screen
├── ChatRenderer.tsx (281 lines) .......... Message rendering logic
├── MarkdownMessage.tsx (30 lines) ........ Markdown content rendering
├── TypingIndicator.tsx (23 lines) ....... Loading indicator
└── hooks/
    ├── useChatConnection.ts (280 lines) . WebSocket management
    └── useChatState.ts (50 lines) ........ State management
```

**`src/components/auth/` - Authentication**

```
src/components/auth/
└── LoginForm.tsx (103 lines) ............. User authentication
```

### Code Refactoring Summary

**Before Refactoring:**

- ChatEngine: 570 lines (monolithic - mixed WebSocket + state + UI)

**After Refactoring:**

- ChatEngine: 70 lines (orchestrator only)
- useChatConnection: 280 lines (WebSocket isolated)
- useChatState: 50 lines (state isolated)
- Presentational components: ~280 lines total

**Result: 87.7% reduction in main component size**

### Performance Optimizations

1. **Separation of Concerns**
   - WebSocket logic doesn't re-render on state changes
   - Components only render when props change

2. **useCallback Memoization**
   - `sendChatMessage`, `handleSubmit`, `handleTipClick` all memoized
   - Prevents unnecessary renders

3. **Message Streaming**
   - Chunks accumulate without creating new messages
   - Efficient update detection by message ID

4. **Ref Usage**
   - `messagesEndRef` for scroll without re-renders
   - `wsRef` for WebSocket access without closure issues

### Benefits Summary

✅ **Maintainability** - 10x easier to locate and modify features
✅ **Testability** - 100% testable WebSocket logic
✅ **Reusability** - Hooks can be used in other components
✅ **Scalability** - Easy to add new message types or features
✅ **Performance** - Better memoization and rendering control
✅ **Readability** - Clear component responsibilities
✅ **Debugging** - Isolated logic easier to debug

---

## 🎨 Naming Conventions

All components use consistent `Chat*` prefix for clarity and discoverability:

| Component         | Purpose                      | Lines |
| ----------------- | ---------------------------- | ----- |
| ChatEngine        | Main orchestrator component  | 70    |
| ChatHeader        | Header section               | 30    |
| ChatMessages      | Message list display         | 50    |
| ChatInput         | User input form              | 40    |
| ChatWelcome       | Welcome/initial state screen | 40    |
| ChatRenderer      | Message rendering logic      | 281   |
| MarkdownMessage   | Markdown content rendering   | 30    |
| TypingIndicator   | Loading state animation      | 23    |
| useChatConnection | WebSocket management hook    | 280   |
| useChatState      | State management hook        | 50    |

---

## 👥 Multi-Agent System

### Architecture Overview

The multi-agent router system enables intelligent message routing to specialized agents based on intent detection:

```
Chat.tsx
  ↓ imports
RouterAgent (router-agent.ts)
  ├─ imports
  ├─ DetectIntent (intent-detector.ts)
  ├─ MemoryManager (memory-manager.ts)
  │  └─ uses MemoryBlocks (agent-memory.ts)
  ├─ SDRAgent (agents/sdr-agent.ts)
  │  └─ uses MemoryBlocks (agent-memory.ts)
  └─ AEAgent (agents/ae-agent.ts)
     └─ uses MemoryBlocks (agent-memory.ts)
```

### Core Components

#### 1. Intent Detection (`src/server/router/intent-detector.ts`)

- **Purpose:** Classify user messages into agent categories
- **Size:** ~250 lines
- **Classifies Into:**
  - `support` - Bug, error, how-to, troubleshooting
  - `sdr` - Lead inquiry, pricing, features, demo
  - `ae` - Deal, negotiation, contract, enterprise
  - `csm` - Expansion, upsell, adoption, training
  - `human` - Escalation, complaint, special request
- **Returns:** `DetectedIntent` with confidence, reason, urgency

#### 2. Memory Manager (`src/server/memory-manager.ts`)

- **Purpose:** Persistence layer for agent memory
- **Size:** ~300 lines
- **Features:**
  - Automatic serialization/deserialization
  - 7-day TTL for KV entries
  - In-memory cache for performance
  - Per-session isolation
- **Storage:** Cloudflare KV (with local cache fallback)

#### 3. Agent Tools (`src/server/router/agent-tools.ts`)

- **Purpose:** Tool definitions for agent tool calling
- **Size:** ~400 lines
- **Tool Categories:**
  - `memoryTools` - memoryInsert, memoryReplace, memoryUpdate
  - `routerTools` - delegateToAgent, stayWithAgent, escalateToHuman
  - `supportTools` - updateIssueStatus, suggestSolution
  - `sdrTools` - scoreQualified, scheduleDemo, escalateToAE
  - `aeTools` - createQuote, updateDealStage, requestApproval
  - `csmTools` - updateHealthScore, logExpansionOpportunity

#### 4. Router Agent (`src/server/router-agent.ts`)

- **Purpose:** Main orchestrator - routes messages to appropriate agents
- **Size:** ~500 lines
- **Key Methods:**
  - `processMessage(userMessage, context)` - Main entry point
  - `makeRoutingDecision()` - Determines target agent
  - `delegateToAgent()` - Hands off to specialized agent
  - `buildAgentSystemPrompt()` - Creates role-specific instructions
  - `callAI()` - Calls Cloudflare AI
  - `executeAgentTool()` - Processes tool calls from AI
  - `shouldEscalate()` - Detects escalation signals

#### 5. Specialized Agents

**SDR Agent** (`src/server/agents/sdr-agent.ts`)

- **Purpose:** Lead qualification (top of funnel)
- **Size:** ~400 lines
- **Responsibilities:**
  - Lead qualification using BANT framework
  - Demo/meeting scheduling
  - Escalation to AE when qualified
- **Success Metric:** 30% qualified lead rate

**AE Agent** (`src/server/agents/ae-agent.ts`)

- **Purpose:** Deal closing (mid-funnel)
- **Size:** ~450 lines
- **Responsibilities:**
  - Present solutions & handle objections
  - Negotiate pricing and terms
  - Create quotes and move deals
  - Request manager approval
- **Success Metric:** 25% closure rate, $50k+ ACV

#### 6. Agent Memory (`src/types/agent-memory.ts`)

- **Purpose:** Memory block definitions for all agents
- **Size:** ~600 lines
- **Memory Blocks:**
  - Router (4 blocks)
  - SDR (4 blocks)
  - AE (4 blocks)
  - CSM (4 blocks)
  - Support (4 blocks)

### Integration Points

#### `src/entry.cloudflare.ts`

```typescript
import { initializeMemoryManager } from "./server/memory-manager";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (typeof env.AGENTS_KV !== "undefined") {
      initializeMemoryManager({
        kvNamespace: env.AGENTS_KV,
        enableLocalCache: true,
      });
    }
    // ... rest of handler
  },
};
```

#### Chat Component Integration

```typescript
import { getRouterAgent } from "@/server/router/router-agent";

const router = getRouterAgent();
const result = await router.processMessage(message, {
  sessionId: chatId,
  userId: userId,
  env: env,
  ws: websocket,
});
// Use result.response, result.routedTo, result.chatFlowComponents
```

#### `wrangler.jsonc` Configuration

```jsonc
{
  "env": {
    "production": {
      "kv_namespaces": [
        {
          "binding": "AGENTS_KV",
          "id": "your-kv-namespace-id",
        },
      ],
    },
  },
}
```

### File Statistics

```
Multi-Agent System Files: 10
Total Lines of Code: ~2,500

By Category:
├── Types/Interfaces: 600 lines (agent-memory.ts)
├── Infrastructure: 800 lines (memory-manager, intent-detector)
├── Router Core: 500 lines (router-agent.ts)
├── Agents: 850 lines (sdr-agent, ae-agent)
└── Tools: 400 lines (agent-tools.ts)
```

---

## 📋 Tech Stack

### Frontend

- **Framework**: TanStack React Start (React 19+)
- **Styling**: Tailwind CSS with flexible layouts
- **Icons**: Lucide React
- **Type Safety**: TypeScript 5.7+ with strict typing
- **Markdown**: ReactMarkdown with remark-gfm

### Backend

- **Server Functions**: TanStack React Start `createServerFn()`
- **Cloud Platform**: Cloudflare Workers (serverless compute)
- **AI Model**: `@cf/meta/llama-3.1-8b-instruct` (swappable)
- **Transport**: WebSocket for real-time communication
- **State Management**: Durable Objects with KV/D1 persistence

### Build & Deploy

- **Build Tool**: Vite 7.1+
- **Platform**: Cloudflare Workers
- **Type System**: TypeScript strict mode
- **Package Manager**: npm or pnpm

### Core Features

- **Real-time Streaming**: Token-by-token response delivery
- **Session Management**: Multi-session support with isolated state
- **Tool System**: Automatic detection and execution
- **State Persistence**: Cloudflare KV with optional D1 SQL
- **Error Handling**: Graceful error recovery and user feedback

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare Workers account
- (Optional) Cloudflare API token for deployment

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Navigate to http://localhost:3000/chat
```

### Try It Out

1. **Direct Prompt**: "What time is it?" (tests getCurrentTime tool)
2. **Conversation**: Send multiple messages (maintains session context)
3. **Tool Call**: "Summarize our conversation" (uses summarizeConversation)
4. **Free-form**: Any natural language prompt works

---

## 📝 API Reference

### Server Functions

#### `handleMessage(input: MessageInput): Promise<MessageResponse>`

Main message handler with full conversation state management.

**Input:**

```typescript
interface MessageInput {
  message: string;
  sessionId?: string;
  userId?: string;
  context?: Record<string, any>;
  conversationHistory?: AgentMessage[];
}
```

**Output:**

```typescript
interface MessageResponse {
  id: string;
  response: string;
  timestamp: number;
  tokens?: number;
  conversationHistory: AgentMessage[];
  metadata: {
    model: string;
    processingTime: number;
    toolsUsed?: string[];
  };
}
```

#### `streamMessage(input: MessageInput): Response`

Streaming message handler with Server-Sent Events.

**Response Format**: SSE stream with events

```
data: {"type":"token","content":"Hello","timestamp":1702...}
data: {"type":"token","content":" ","timestamp":1702...}
data: {"type":"complete","conversationHistory":[...],"timestamp":1702...}
```

#### `getConversationHistory(sessionId: string)`

Retrieve full conversation history for a session.

```typescript
const history = await getConversationHistory({ sessionId: "session_123" });
// Returns: { sessionId, messages[], messageCount, lastUpdated }
```

#### `clearConversation(sessionId: string)`

Clear conversation history for a session.

```typescript
await clearConversation({ sessionId: "session_123" });
// Returns: { success: true, sessionId, message }
```

#### `getAvailableTools()`

List all available tools the agent can use.

```typescript
const tools = await getAvailableTools();
// Returns: { tools: [{name, description}], count }
```

---

## 🛠️ Customization

### Adding Custom Tools

Edit `src/server/ai.ts`:

```typescript
const tools: Record<string, Tool> = {
  // ... existing tools

  myCustomTool: {
    name: "myCustomTool",
    description: "Brief description",
    execute: async (args: Record<string, any>) => {
      // Your custom logic
      const result = await doSomething(args);
      return JSON.stringify({ success: true, result });
    },
  },
};
```

### Changing AI Model

In `src/server/ai.ts`, change the model constant:

```typescript
const model = "@cf/meta/llama-3.1-8b-instruct"; // Change this
```

**Available Models:**

- `@cf/meta/llama-3.1-8b-instruct` (default)
- `@cf/mistral/mistral-7b-instruct-v0.1`
- `@cf/meta/llama-2-7b-chat-int8`
- [View all models](https://developers.cloudflare.com/workers-ai/models/)

### Customizing System Prompt

Edit `buildSystemPrompt()` in `src/server/ai.ts`:

```typescript
function buildSystemPrompt(context?: Record<string, any>): string {
  return `You are a helpful AI assistant...
  
  [Add custom instructions here]
  
  Available tools:
  ${toolsList}`;
}
```

### Adding Message Types

1. Edit `src/components/chat/hooks/useChatConnection.ts` `handleMessage()` function
2. Add new case to switch statement
3. Call appropriate callback with data

---

## 🚀 Deployment

### Deploy to Cloudflare Workers

```bash
# Build for production
npm run build

# Deploy to Cloudflare
wrangler deploy

# Monitor logs in real-time
wrangler tail
```

### Configuration

Edit `wrangler.jsonc` for:

- AI binding setup
- Environment variables
- Durable Objects (for persistence)
- KV namespaces (for message history)

### State Persistence (Advanced)

Current implementation uses in-memory state. For production:

**Option 1: Cloudflare KV (Simple)**

```jsonc
{
  "kv_namespaces": [{ "binding": "SESSIONS", "id": "namespace-id" }],
}
```

**Option 2: Cloudflare D1 (SQL)**

```jsonc
{
  "d1_databases": [{ "binding": "DB", "database_name": "chat_db" }],
}
```

**Option 3: Durable Objects (Stateful)**

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "AGENT", "class_name": "Agent" }],
  },
}
```

### Production Checklist

- [ ] Build succeeds without errors
- [ ] AI binding configured in wrangler.jsonc
- [ ] Test locally with `npm run dev`
- [ ] Deploy to staging first
- [ ] Verify streaming works in production
- [ ] Monitor error rates
- [ ] KV namespace created with correct ID
- [ ] Environment variables configured

---

## 🔄 AI Agent Lifecycle

```
User connects → Session initialized
              ↓
User sends message → State loaded/created
              ↓
Build context (history + tools)
              ↓
Call AI model → Get response
              ↓
Check for tool calls
              ↓
Execute tools if needed → Get results
              ↓
Generate final response
              ↓
Update session state
              ↓
Stream to user
```

---

## 💡 Best Practices

1. **Use Sessions for Context**: Stateful conversations are more helpful
2. **Tool Descriptions**: Keep tool descriptions clear for AI to use correctly
3. **Error Handling**: All tool execution errors are gracefully handled
4. **Message Limits**: Consider limiting conversation history for performance
5. **Context Relevance**: Only include relevant context in prompts
6. **Naming Consistency**: Use `Chat*` prefix for all chat-related components
7. **Separation of Concerns**: Keep WebSocket logic separate from UI components
8. **Memoization**: Use useCallback for handler functions to prevent renders

---

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear and rebuild
rm -rf node_modules .wrangler dist
npm install
npm run build
```

### AI Not Responding

1. Check `wrangler.jsonc` has AI binding
2. Verify Cloudflare account has AI access
3. Check browser DevTools console for errors
4. Monitor logs: `wrangler tail`

### Session Not Persisting

Sessions are in-memory by default (reset on server restart).

To persist:

- Use KV for sessions: See "State Persistence (Advanced)"
- Use Durable Objects for real-time sync
- Use D1 for SQL-based storage

### WebSocket Connection Issues

1. Verify WebSocket endpoint is accessible
2. Check CORS configuration if using cross-origin requests
3. Monitor browser Network tab for WebSocket handshake
4. Check worker logs for connection errors

---

## 📚 Resources

- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Agents Framework](https://github.com/cloudflare/agents)
- [TanStack Start](https://tanstack.com/start)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Vercel AI SDK](https://sdk.vercel.com/)

---

**Built with ❤️ using TanStack Start and Cloudflare Workers AI**
