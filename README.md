# TanStack Start + Cloudflare AI Chat

A production-grade AI chat application built with **TanStack React Start**, **Cloudflare Workers AI**, and **Cloudflare Agents Framework**.

Features real-time WebSocket communication with streaming AI responses, persistent message storage using Durable Objects key-value storage, and professional-grade UI with markdown rendering.

## ✨ Key Features

- 🤖 **Real-time AI Chat** - Streaming responses via WebSocket with ChatGPT-style UI
- ⚡ **WebSocket Architecture** - Cloudflare Agents framework with Connection API
- 💾 **Persistent Storage** - Durable Objects key-value storage for conversation history
- 📝 **Markdown Support** - Rich text formatting with react-markdown
- 🎨 **Modern UI** - React 19 + TailwindCSS with ChatGPT-inspired design
- 🚀 **Edge Deployment** - Cloudflare Workers for global low-latency
- 💰 **No API Keys** - Uses Cloudflare Workers AI (no OpenAI required)

## 📚 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Agent State Machine](#agent-state-machine)
- [Tech Stack](#tech-stack)
- [Storage Architecture](#storage-architecture)
- [Database Structure](#database-structure)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [WebSocket Communication](#websocket-communication)
- [Development](#development)
- [Deployment](#deployment)

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌────────────────────────────────────────────────────────────────┐
│                  CLIENT (React + WebSocket)                    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ChatEngine.tsx                                        │   │
│  │  - useAgent() hook from agents/react                  │   │
│  │  - Manages WebSocket connection                       │   │
│  │  - Renders markdown messages                          │   │
│  │  - Auto-expanding textarea input                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                     │
│                    WebSocket                                   │
│         (wss://your-app.workers.dev/agents/chat-agent/session) │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (Edge Runtime)                   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ChatAgent (Durable Object - extends Agent)            │  │
│  │                                                         │  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │ Connection Management                         │     │  │
│  │  │  - onConnect(connection): Track connections   │     │  │
│  │  │  - onClose(connection, code, reason): Cleanup │     │  │
│  │  │  - onError(connection, error): Handle errors  │     │  │
│  │  │  - broadcast(data): Send to all connections   │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │                        │                               │  │
│  │  ┌─────────────────────▼───────────────────────┐     │  │
│  │  │ Message Processing                            │     │  │
│  │  │  - onMessage(connection, data)                │     │  │
│  │  │  - handleChat(connection, content)            │     │  │
│  │  │  - Stream AI response chunks                  │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │                        │                               │  │
│  │  ┌─────────────────────▼───────────────────────┐     │  │
│  │  │ Durable Object Storage (Key-Value)            │     │  │
│  │  │  - saveMessage(message)                       │     │  │
│  │  │  - getMessages()                              │     │  │
│  │  │  - Key: "message:{uuid}"                      │     │  │
│  │  │  - Value: Message object (JSON)               │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                     │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  Cloudflare Workers AI                                  │  │
│  │  Model: @cf/meta/llama-3.1-8b-instruct                 │  │
│  │   - Streaming text generation via SSE                   │  │
│  │   - Context window: Full conversation history          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│           Stream tokens back via WebSocket                     │
│         (message-start → message-chunk → message-done)         │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### **1. Frontend (Client-Side)**

| File             | Lines | Purpose                                  |
| ---------------- | ----- | ---------------------------------------- |
| `ChatEngine.tsx` | 192   | Main chat UI with markdown rendering     |
| `agents/react`   | -     | Cloudflare useAgent() hook for WebSocket |

**Key Features:**

- Auto-reconnecting WebSocket via `useAgent` hook
- Streaming message updates with cursor animation
- Markdown rendering with `react-markdown` + `remark-gfm`
- ChatGPT-style rounded input with upward arrow button
- Message persistence loaded on connection

#### **2. Backend (Cloudflare Workers)**

| File                     | Lines | Purpose                                  |
| ------------------------ | ----- | ---------------------------------------- |
| `chat-agent.ts`          | 338   | ChatAgent with state machine integration |
| `agent-state-machine.ts` | 95    | State machine for autonomous agent loop  |
| `types.ts`               | 27    | TypeScript interfaces for agent state    |
| `entry.cloudflare.ts`    | -     | Routes WebSocket requests to agent       |

**Key Features:**

- Extends Cloudflare `Agent` class with state machine support
- Autonomous agent loop (observe → think → act → learn)
- Automatic state synchronization to all connected clients
- SDK-managed state persistence (embedded SQL)
- Tracks active connections with `Set<Connection>`
- Broadcasts responses to all connected clients
- Streams AI responses via Server-Sent Events (SSE) parsing
- Persists messages and learning outcomes to storage

---

## 🤖 Agent State Machine

### **Overview**

The ChatAgent implements an autonomous **Agent Loop** (observe → think → act → learn) using a state machine pattern with automatic client synchronization via Cloudflare's Agent SDK.

### **State Machine Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      ChatAgent State Lifecycle                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│    IDLE      │ ◄──────────────────────────────────┐
│ (Waiting for │                                    │
│   goal)      │                                    │
└──────┬───────┘                                    │
       │                                            │
       │ User sends "agent-goal" message            │
       │                                            │
       ▼                                            │
┌──────────────┐                                    │
│  OBSERVING   │                                    │
│ (Gathering   │                                    │
│  context)    │                                    │
└──────┬───────┘                                    │
       │                                            │
       │ Collect conversation history               │
       │                                            │
       ▼                                            │
┌──────────────┐                                    │
│   THINKING   │                                    │
│ (Planning    │                                    │
│  action)     │                                    │
└──────┬───────┘                                    │
       │                                            │
       │ LLM decides next action                    │
       │                                            │
       ▼                                            │
┌──────────────┐                                    │
│    ACTING    │                                    │
│ (Executing   │                                    │
│  action)     │                                    │
└──────┬───────┘                                    │
       │                                            │
       │ Execute tool/respond                       │
       │                                            │
       ▼                                            │
┌──────────────┐                                    │
│   LEARNING   │                                    │
│ (Storing     │                                    │
│  results)    │                                    │
└──────┬───────┘                                    │
       │                                            │
       │ Save outcome to memory                     │
       │                                            │
       ▼                                            │
    ┌──────┐                                        │
    │Check │                                        │
    │Goal? │                                        │
    └──┬───┘                                        │
       │                                            │
    ┌──┴───┐                                        │
    │      │                                        │
 Yes│   No│                                         │
    │      │                                        │
    ▼      └───────► Continue loop ────────┘       │
Complete goal                                       │
    │                                               │
    └───────────────────────────────────────────────┘
```

### **State Machine Files**

| File                      | Lines | Purpose                             |
| ------------------------- | ----- | ----------------------------------- |
| `types.ts`                | 27    | TypeScript interfaces for state     |
| `agent-state-machine.ts`  | 95    | State machine logic with SDK sync   |
| `chat-agent.ts` (updated) | 338   | Agent with integrated state machine |

### **Initialization Flow (Step-by-Step)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Agent Construction                                        │
│    new ChatAgent(state, env)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SDK Initializes State (Before Constructor Body)          │
│    - Reads initialState property from class                 │
│    - Sets this.state = initialState                         │
│    - Persists to embedded SQL database                      │
│                                                              │
│    initialState: ChatAgentState = {                         │
│      agentLoop: {                                           │
│        phase: "idle",                                       │
│        iteration: 0,                                        │
│        maxIterations: 10,                                   │
│        progress: 0,                                         │
│        lastUpdate: Date.now()                               │
│      }                                                       │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. super(state, env) Call                                   │
│    - Calls Agent base class constructor                     │
│    - Completes SDK initialization                           │
│    - this.state is now fully ready                          │
│    - State is persisted and ready for access                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Initialize StateMachine                                  │
│    this.stateMachine = new AgentStateMachine(this)          │
│    - Passes reference to fully-initialized agent            │
│    - Can safely access this.state.agentLoop                 │
│    - Ready to manage state transitions                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Ready for Connections                                    │
│    - onConnect() can be called                              │
│    - onMessage() can access state safely                    │
│    - stateMachine.isActive() works correctly                │
│    - Client connections auto-sync state                     │
└─────────────────────────────────────────────────────────────┘
```

### **Key State Machine Methods**

#### **AgentStateMachine Class**

```typescript
class AgentStateMachine {
  // Initialize new goal with max iterations
  async initialize(goal: string, maxIterations?: number): Promise<void>;

  // Transition to new phase with optional data
  async transition(
    phase: LoopPhase,
    data?: Partial<AgentLoopState>
  ): Promise<void>;

  // Update progress (0-100%) with optional status
  async updateProgress(
    progress: number,
    currentAction?: string,
    reasoning?: string
  ): Promise<void>;

  // Move to next iteration, returns false if max reached
  async nextIteration(): Promise<boolean>;

  // Mark goal complete (success/failure)
  async complete(success: boolean, result?: any): Promise<void>;

  // Check if agent is currently processing a goal
  isActive(): boolean;

  // Get current state
  getState(): AgentLoopState | undefined;
}
```

### **State Synchronization**

All state updates use Cloudflare's Agent SDK `setState()` which:

- ✅ **Persists** state to embedded SQL database
- ✅ **Broadcasts** changes to all connected WebSocket clients automatically
- ✅ **Serializes** JSON-compatible data
- ✅ **Guarantees** immediate consistency (read-your-own-writes)
- ✅ **Handles** concurrent updates safely (thread-safe)
- ✅ **Colocated** storage (zero network latency)

**Example: Client receives automatic updates**

```typescript
// Frontend (React)
const agent = useAgent({
  agent: "chat-agent",
  name: "session-123",
  onStateUpdate: (newState) => {
    // Automatically called when agent calls setState()
    console.log("Agent phase:", newState.agentLoop.phase);
    console.log("Progress:", newState.agentLoop.progress);
    console.log("Current action:", newState.agentLoop.currentAction);
  },
});
```

### **State Type Definitions**

```typescript
// Phase of the agent loop
export type LoopPhase =
  | "idle"
  | "observing"
  | "thinking"
  | "acting"
  | "learning";

// Agent loop state structure
export interface AgentLoopState {
  phase: LoopPhase; // Current phase
  goal?: string; // User's goal (e.g., "Tell me a joke")
  iteration: number; // Current iteration (0-based)
  maxIterations: number; // Max iterations before stopping
  currentAction?: string; // What agent is doing now
  reasoning?: string; // Why agent chose this action
  progress: number; // 0-100 completion percentage
  lastUpdate: number; // Timestamp of last state change
}

// Complete agent state
export interface ChatAgentState {
  agentLoop?: AgentLoopState; // Current loop state
  lastGoalResult?: {
    // Result of last completed goal
    success: boolean;
    result?: any;
    completedAt: number;
  };
}
```

### **Usage Example**

```typescript
// Client sends goal to agent
agent.send({
  type: "agent-goal",
  content: "Tell me a joke, then explain why it's funny",
  maxIterations: 10,
});

// Agent processes autonomously:
// 1. OBSERVING → Load conversation history
// 2. THINKING  → LLM decides: "respond with joke"
// 3. ACTING    → Send joke to user
// 4. LEARNING  → Store action result
// 5. THINKING  → LLM decides: "respond with explanation"
// 6. ACTING    → Send explanation to user
// 7. LEARNING  → Store result
// 8. Complete  → Goal achieved, return to IDLE

// Client UI automatically updates with progress during each phase
```

### **Benefits of State Machine Pattern**

| Benefit              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| **Autonomous**       | Agent runs multi-step workflows without user interaction |
| **Observable**       | Clients see real-time progress updates                   |
| **Recoverable**      | State persisted, survives agent restarts                 |
| **Type-Safe**        | Full TypeScript typing across agent and client           |
| **Zero Boilerplate** | SDK handles all WebSocket broadcasting automatically     |
| **Concurrent Safe**  | Multiple clients can connect safely                      |

---

## 💾 Storage Architecture

### **Durable Object Key-Value Storage**

Your application uses **Cloudflare Durable Objects Storage** - a **strongly consistent key-value store** built into each Durable Object instance.

#### **Storage Type: Key-Value (Not SQL)**

```typescript
// Storage Interface
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  get<T>(keys: string[]): Promise<Map<string, T>>;
  put<T>(key: string, value: T): Promise<void>;
  put<T>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T>(options?: ListOptions): Promise<Map<string, T>>;
  transaction<T>(
    closure: (txn: DurableObjectTransaction) => Promise<T>
  ): Promise<T>;
}
```

#### **Why Key-Value vs D1/SQLite?**

| Feature              | Durable Object Storage (Current) | D1 (SQLite) Alternative          |
| -------------------- | -------------------------------- | -------------------------------- |
| **Type**             | Key-Value Store                  | Relational SQL Database          |
| **Consistency**      | Strongly consistent per object   | Eventually consistent            |
| **Query Capability** | Key lookup, prefix scan          | Full SQL (JOIN, WHERE, GROUP BY) |
| **Performance**      | ~1-2ms (in-memory)               | ~10-50ms (network query)         |
| **Use Case**         | Session state, simple data       | Complex queries, relations       |
| **Setup**            | Built-in, no configuration       | Requires D1 binding setup        |
| **Best For**         | Chat history, user sessions      | Multi-user analytics, reports    |

**Current Implementation:** Key-value is **optimal** for chat messages because:

- ✅ Fast sequential access for conversation history
- ✅ Simple data model (messages only)
- ✅ No complex queries needed
- ✅ Per-session isolation (each session = separate Durable Object)

**When to use D1:**

- ❌ If you need cross-session queries ("show all messages from user X")
- ❌ If you need complex filtering ("messages containing word Y sent after date Z")
- ❌ If you need JOINs across multiple tables

---

## 📊 Database Structure

### **Current Schema (Key-Value)**

#### **Message Storage**

```typescript
// Storage Key Pattern
Key: "message:{uuid}"
// Examples:
// "message:a1b2c3d4-e5f6-7890-abcd-ef1234567890"
// "message:f9e8d7c6-b5a4-3210-9876-543210fedcba"

// Storage Value (Message Interface)
interface Message {
  id: string;                                    // UUID v4
  role: "user" | "assistant";                    // Message sender
  content: string;                               // Plain text content
  parts: Array<{                                 // AI SDK v6 format
    type: "text";
    text: string;
  }>;
  timestamp: number;                             // Unix timestamp (ms)
}

// Example stored message
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "role": "user",
  "content": "What is the capital of France?",
  "parts": [
    {
      "type": "text",
      "text": "What is the capital of France?"
    }
  ],
  "timestamp": 1704412800000
}
```

#### **Storage Operations**

```typescript
// 1. SAVE MESSAGE (Write)
await ctx.storage.put(`message:${message.id}`, message);

// 2. GET ALL MESSAGES (Read with prefix scan)
const entries = await ctx.storage.list({ prefix: "message:" });
const messages = Array.from(entries.values());

// 3. DELETE MESSAGE (Delete)
await ctx.storage.delete(`message:${messageId}`);

// 4. CLEAR CONVERSATION (Batch delete)
const keys = await ctx.storage.list({ prefix: "message:" });
await ctx.storage.delete(Array.from(keys.keys()));
```

#### **Storage Limits**

| Limit              | Value              |
| ------------------ | ------------------ |
| Max key size       | 2,048 bytes        |
| Max value size     | 128 KB per key     |
| Max storage per DO | No hard limit      |
| Cost               | $0.20 per GB-month |
| Read latency       | ~1-2ms             |
| Write latency      | ~2-5ms             |

#### **Data Persistence**

- **Scope**: Per Durable Object instance (per `sessionId`)
- **Lifetime**: Indefinite (persists until explicitly deleted)
- **Location**: Cloudflare edge (closest to user)
- **Replication**: Automatically replicated across Cloudflare network
- **Backup**: Handled by Cloudflare infrastructure

---

### **Alternative: D1 (SQLite) Schema**

If you wanted to switch to D1 for cross-session queries, here's the equivalent schema:

```sql
-- D1 Migration: 0001_create_messages_table.sql

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  parts TEXT NOT NULL,  -- JSON array
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_messages_session ON messages(session_id, timestamp);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);

-- Example queries possible with D1:
-- 1. Get conversation for specific session
SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC;

-- 2. Search across all sessions
SELECT * FROM messages WHERE content LIKE '%keyword%';

-- 3. Get most recent messages across all users
SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100;

-- 4. Count messages per user
SELECT session_id, COUNT(*) as message_count
FROM messages
GROUP BY session_id;
```

**D1 Setup (if switching):**

```jsonc
// wrangler.jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "chat-history",
      "database_id": "your-d1-database-id"
    }
  ]
}
```

**Cost Comparison:**

| Storage Type           | Cost                                     | Best For              |
| ---------------------- | ---------------------------------------- | --------------------- |
| Durable Object Storage | $0.20/GB-month                           | Per-session data      |
| D1 (SQLite)            | $0.75/GB-month<br>+$0.001 per 1000 reads | Cross-session queries |

---

## � WebSocket Communication

### **Cloudflare Agents Framework**

The application uses the **Cloudflare Agents** library, which provides a high-level abstraction over WebSockets.

#### **Connection API Pattern**

```typescript
import { Agent } from "agents";

export class ChatAgent extends Agent<any> {
  private connections = new Set<Connection>();

  // 1. CONNECTION LIFECYCLE
  onConnect(connection: Connection) {
    console.log("Client connected");
    this.connections.add(connection);

    // Send conversation history on connect
    const messages = await this.getMessages();
    connection.send({ type: "messages-list", messages });
  }

  onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    console.log(`Client disconnected: ${reason} (${code})`);
    this.connections.delete(connection);
  }

  onError(connection: Connection, error: Error) {
    console.error("Connection error:", error);
    connection.send({ type: "error", error: error.message });
  }

  // 2. MESSAGE HANDLING
  onMessage(connection: Connection, data: any) {
    if (data.type === "user-message") {
      await this.handleChat(connection, data.content);
    }
  }

  // 3. BROADCASTING
  async handleChat(connection: Connection, content: string) {
    // Save user message
    await this.saveMessage({ role: "user", content });

    // Stream AI response to ALL connected clients
    this.broadcast({
      type: "message-start",
      role: "assistant",
    });

    for await (const chunk of aiStream) {
      this.broadcast({
        type: "message-chunk",
        content: chunk,
      });
    }

    this.broadcast({
      type: "message-done",
    });
  }
}
```

#### **Client-Side (React)**

```typescript
import { useAgent } from "agents/react";

function ChatEngine() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChunk, setCurrentChunk] = useState("");

  const { connectionState, send } = useAgent({
    url: "/agents/chat-agent/my-session-id",
    onMessage: (data) => {
      switch (data.type) {
        case "messages-list":
          setMessages(data.messages);
          break;

        case "message-start":
          setCurrentChunk("");
          break;

        case "message-chunk":
          setCurrentChunk((prev) => prev + data.content);
          break;

        case "message-done":
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: currentChunk },
          ]);
          setCurrentChunk("");
          break;
      }
    },
  });

  const handleSubmit = (content: string) => {
    send({ type: "user-message", content });
  };

  return (
    <div>
      {messages.map((msg) => (
        <Message key={msg.id} {...msg} />
      ))}
      {currentChunk && <Message role="assistant" content={currentChunk} />}
      <input onSubmit={handleSubmit} />
    </div>
  );
}
```

#### **WebSocket URL Format**

```
wss://your-app.workers.dev/agents/{agentName}/{sessionId}
                                   └─────┬─────┘  └───┬───┘
                                    Agent class    DO instance
```

Example:

```
wss://chat.example.com/agents/chat-agent/user-abc-123
                               └────┬────┘ └─────┬─────┘
                                 Maps to   Unique per
                              ChatAgent    conversation
```

---

## 📋 Tech Stack

### Frontend

| Package        | Version  | Purpose                                        |
| -------------- | -------- | ---------------------------------------------- |
| React          | 19.2.3   | UI framework                                   |
| TanStack Start | 1.143.11 | Full-stack React framework                     |
| TailwindCSS    | 4.1.18   | Utility-first styling                          |
| react-markdown | 10.1.0   | Markdown rendering (bold, italic, code, lists) |
| remark-gfm     | 5.0.0    | GitHub Flavored Markdown support               |
| lucide-react   | 0.562.0  | Icon library                                   |

### Backend

| Package             | Version | Purpose                         |
| ------------------- | ------- | ------------------------------- |
| ai                  | 6.0.5   | AI SDK for streaming responses  |
| workers-ai-provider | 3.0.2   | Cloudflare Workers AI adapter   |
| agents              | 0.3.3   | Cloudflare Agents WebSocket SDK |
| zod                 | 4.2.1   | Schema validation               |

### Cloudflare Services

| Service             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| **Workers**         | Edge compute runtime (serverless)                   |
| **Durable Objects** | Stateful WebSocket & storage per session            |
| **Workers AI**      | Built-in AI models (@cf/meta/llama-3.1-8b-instruct) |
| **AI Gateway**      | Optional caching & analytics for AI requests        |

### Build & Deploy

| Tool       | Purpose                 |
| ---------- | ----------------------- |
| Vite       | Build tool & dev server |
| Wrangler   | Cloudflare Workers CLI  |
| TypeScript | Type safety             |
| pnpm       | Package manager         |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- Cloudflare account (free tier works)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd tanstack-start-cloudflare

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open browser
open http://localhost:3000/chat
```

### Try It Out

Once running, try these commands:

1. **"Create a contact named John Doe with email john@example.com"**

   - Tests the `createContact` tool
   - Returns success message with ID

2. **"Show me all contacts"**

   - Uses the `listContacts` tool
   - Displays paginated results

3. **"Search for contacts with gmail"**

   - Uses the `searchContacts` tool
   - Filters by query string

4. **General conversation**
   - "What can you help me with?"
   - "Tell me about your capabilities"

---

## 📁 Project Structure

```
tanstack-start-cloudflare/
├── src/
│   ├── server/
│   │   └── agents/                       ← Agent system with state machine
│   │       ├── chat-agent.ts             ← Main agent (338 lines)
│   │       ├── agent-state-machine.ts    ← State machine logic (95 lines)
│   │       ├── types.ts                  ← State type definitions (27 lines)
│   │       ├── orchestrator-agent.ts     ← Core AI logic + tools (future)
│   │       ├── planning-agent.ts         ← Task breakdown (future)
│   │       ├── knowledge-agent.ts        ← Data retrieval (future)
│   │       ├── execution-agent.ts        ← CRM actions (future)
│   │       ├── verification-agent.ts     ← Data validation (future)
│   │       └── index.ts                  ← Central exports
│   │
│   ├── components/
│   │   └── chat/
│   │       ├── ChatEngine.tsx            ← Main UI component
│   │       ├── hooks/
│   │       │   ├── useChatConnection.ts  ← WebSocket logic
│   │       │   └── useChatState.ts       ← State management
│   │       └── [other components]
│   │
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   └── chat.tsx                      ← Chat page route
│   │
│   ├── entry.cloudflare.ts               ← Worker entry + DO exports
│   └── router.tsx                        ← TanStack routing
│
├── wrangler.jsonc                        ← Cloudflare configuration
├── package.json
├── vite.config.ts
├── tsconfig.json
├── ARCHITECTURE.md                       ← Detailed architecture docs
└── README.md                             ← This file
```

---

## 👥 Agent System

### Current Implementation

#### ChatAgent (Main Implementation)

**File:** `src/server/agents/chat-agent.ts` (338 lines)

```typescript
export class ChatAgent extends Agent<any, ChatAgentState> {
  private stateMachine: AgentStateMachine;

  // SDK-recommended state initialization
  initialState: ChatAgentState = {
    agentLoop: {
      phase: "idle",
      iteration: 0,
      maxIterations: 10,
      progress: 0,
      lastUpdate: Date.now(),
    },
  };

  // Handle incoming messages
  async onMessage(connection: Connection, data: any) {
    // Route based on message type:
    // - "user-message" → handleChat() for normal chat
    // - "agent-goal" → executeAgentLoop() for autonomous execution
    // - "get-messages" → Return conversation history
  }

  // Autonomous agent loop
  private async executeAgentLoop(connection, goal, maxIterations) {
    while (!goalAchieved && canContinue) {
      // OBSERVE → THINK → ACT → LEARN → Repeat
    }
  }
}
```

**Built-in Message Types:**

1. **user-message** - Normal chat message

   - Streams AI response via WebSocket
   - Persists conversation history
   - Uses Llama 3.1 8B Instruct model

2. **agent-goal** - Autonomous goal execution

   - Triggers agent loop state machine
   - Multi-step autonomous processing
   - Real-time progress updates

3. **get-messages** - Retrieve conversation history
   - Returns all messages for session
   - Sorted by timestamp

**Key Features:**

- State machine integration for autonomous behavior
- Automatic state sync to all connected clients
- SDK-managed persistence (embedded SQL)
- Streaming AI responses with proper chunking
- Message history with Durable Object storage
- Learning outcomes stored for future context

### Future Agents (Scaffolded)

- **PlanningAgent** - Complex task breakdown
- **KnowledgeAgent** - Advanced search & insights
- **ExecutionAgent** - Batch operations & automation
- **VerificationAgent** - Data quality & validation

---

## 🤖 AI SDK v6 Integration

### Critical: Tool Format Change

AI SDK v6 uses **plain object tools** (no wrapper function).

**✅ Correct (v6):**

```typescript
const tools = {
  createContact: {
    description: "Create a new contact",
    parameters: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    execute: async ({ name, email }) => {
      // Implementation
      return JSON.stringify({ success: true, id: "123" });
    },
  },
};
```

**❌ Incorrect (v3/old):**

```typescript
const tools = {
  createContact: tool({  // ❌ No tool() wrapper in v6!
    description: "Create a new contact",
    parameters: z.object({ ... }),
    execute: async (args) => { ... }
  })
};
```

### Streaming Implementation

```typescript
import { streamText, convertToModelMessages } from "ai";
import { createWorkersAI } from "workers-ai-provider";

const result = streamText({
  model: workersai("@cf/meta/llama-3-8b-instruct"),
  messages: await convertToModelMessages(this.messages),
  system: this.getSystemPrompt(),
  tools: this.getTools(),
  temperature: 0.3,
});

// Stream to client
return createUIMessageStreamResponse({
  stream: result.toUIMessageStream(),
});
```

---

## 💻 Development

### Development Server

```bash
# Start with hot reload
pnpm dev

# Runs on http://localhost:3000
```

### Type Checking

```bash
# Check types without building
pnpm tsc --noEmit
```

### View Logs

```bash
# Tail worker logs in real-time
wrangler tail
```

### Testing Tools

Use the chat interface to test:

```
User: Create a contact named Alice with email alice@test.com
AI: [Creates contact, returns success message]

User: List all contacts
AI: [Shows all created contacts]

User: Search for alice
AI: [Returns filtered results]
```

---

## 🚀 Deployment

### Build & Deploy

```bash
# Build production bundle
pnpm build

# Deploy to Cloudflare
wrangler deploy

# Or combined
pnpm deploy
```

### Configuration

**wrangler.jsonc:**

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
      { "name": "CHAT_AGENT", "class_name": "ChatAgent" }
      // ... other agents
    ]
  }
}
```

### Environment Setup

No environment variables needed! Cloudflare Workers AI is included with your account.

### Deployment Checklist

- [ ] `pnpm build` succeeds
- [ ] Test locally with `pnpm dev`
- [ ] Verify AI binding in wrangler.jsonc
- [ ] Run `wrangler deploy`
- [ ] Test deployed URL
- [ ] Monitor with `wrangler tail`

---

## 📝 API Reference

### Agent Connection

```typescript
const agent = useAgent({
  agent: "ChatAgent",
  name: sessionId, // Unique session ID
  onOpen: () => console.log("Connected"),
  onClose: () => console.log("Disconnected"),
  onError: (err) => console.error(err),
});
```

### Send Message

```typescript
const { sendMessage } = useAgentChat({ agent });

await sendMessage({
  role: "user",
  parts: [{ type: "text", text: "Hello" }],
});
```

### Clear History

```typescript
const { clearHistory } = useAgentChat({ agent });

await clearHistory();
```

### Message Format

**Client → Server:**

```json
{
  "role": "user",
  "parts": [{ "type": "text", "text": "Create contact" }]
}
```

**Server → Client (Streaming):**

```json
{ "type": "text-delta", "textDelta": "Creating..." }
{ "type": "tool-call", "toolName": "createContact" }
{ "type": "tool-result", "result": "{...}" }
{ "type": "finish", "finishReason": "stop" }
```

---

## 🛠️ Customization

### Adding a New Tool

Edit `src/server/agents/orchestrator-agent.ts`:

```typescript
private getTools() {
  return {
    // ... existing tools

    myCustomTool: {
      description: "Description for AI to understand when to use this",
      parameters: z.object({
        param1: z.string(),
        param2: z.number().optional()
      }),
      execute: async ({ param1, param2 }) => {
        // Your logic here
        const result = await doSomething(param1, param2);
        return JSON.stringify({ success: true, data: result });
      }
    }
  };
}
```

### Changing AI Model

Edit `orchestrator-agent.ts`:

```typescript
private getModel() {
  const env = (this as any).env;
  const workersai = createWorkersAI({ binding: env.AI });

  // Change this line:
  return workersai("@cf/meta/llama-3-8b-instruct");

  // Available models:
  // - "@cf/meta/llama-3.1-8b-instruct"
  // - "@cf/mistral/mistral-7b-instruct-v0.1"
  // - "@cf/meta/llama-2-7b-chat-int8"
}
```

[View all models](https://developers.cloudflare.com/workers-ai/models/)

### Customizing System Prompt

Edit `getSystemPrompt()` in `orchestrator-agent.ts`:

```typescript
private getSystemPrompt(): string {
  return `You are an intelligent CRM assistant...

  [Add your custom instructions here]

  Available tools:
  - createContact: Create new contacts
  - listContacts: View all contacts
  - searchContacts: Find specific contacts
  `;
}
```

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
          "id": "your-kv-namespace-id"
        }
      ]
    }
  }
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
- **Transport**: WebSocket for ---

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear everything and rebuild
rm -rf node_modules .wrangler dist
pnpm install
pnpm build
```

### AI Not Responding

1. ✅ Check `wrangler.jsonc` has AI binding configured
2. ✅ Verify Cloudflare account has Workers AI access
3. ✅ Check browser console for errors
4. ✅ Run `wrangler tail` to see worker logs
5. ✅ Verify WebSocket connection is established

### Session Not Persisting

Sessions use Durable Objects by default (persistent across restarts).

**Verify:**

- Check Durable Objects are configured in `wrangler.jsonc`
- Ensure agents are exported in `entry.cloudflare.ts`
- View DO instances: `wrangler durable-objects:list CHAT_AGENT`

### WebSocket Connection Issues

1. Check browser Network tab for WebSocket handshake
2. Verify agent bindings in wrangler.jsonc
3. Look for errors in `wrangler tail`
4. Ensure sessionId is unique per user

### TypeScript Errors

```bash
# Regenerate types
pnpm cf-typegen

# Check for errors
pnpm tsc --noEmit
```

---

## 💡 Best Practices

### 1. Session Management

- Use unique sessionId per user (e.g., UUID)
- Don't share sessions across users
- Clear history when starting new conversations

### 2. Tool Development

- Keep tool descriptions clear for AI understanding
- Return JSON strings from execute functions
- Validate parameters with Zod schemas
- Handle errors gracefully

### 3. Performance

- Use Durable Objects for session state
- Implement pagination for large data sets
- Stream responses for better UX
- Keep tools focused and single-purpose

### 4. Code Organization

- All agents in `src/server/agents/`
- UI components in `src/components/chat/`
- Use hooks for WebSocket and state logic
- Follow naming convention: `Chat*` prefix

### 5. Deployment

- Test locally before deploying
- Use `wrangler tail` to monitor production
- Deploy during low-traffic periods
- Keep dependencies updated

---

## 📚 Resources

### Official Documentation

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Agents Framework](https://github.com/cloudflare/agents)
- [AI SDK Documentation](https://sdk.vercel.ai/)
- [TanStack Start](https://tanstack.com/start)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Related Projects

- [AI SDK Examples](https://github.com/vercel/ai)
- [Cloudflare Workers Examples](https://github.com/cloudflare/workers-sdk)

### Community

- [TanStack Discord](https://discord.gg/tanstack)
- [Cloudflare Discord](https://discord.gg/cloudflare)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

MIT License - feel free to use this project for learning or commercial purposes.

---

## 🔥 What Makes This Special

1. **No API Keys Required** - Uses Cloudflare Workers AI (included in your account)
2. **Edge Deployment** - Low latency worldwide via Cloudflare's global network
3. **Persistent State** - Durable Objects maintain conversation history
4. **Modern Stack** - React 19 + AI SDK v6 + TanStack Start
5. **Production Ready** - Error handling, streaming, type safety
6. **Simple Architecture** - All agents in one folder, easy to understand
7. **Real-time Streaming** - Token-by-token response delivery
8. **Extensible** - Easy to add new tools and agents

---

**Built with ❤️ using TanStack Start and Cloudflare Workers AI**

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)

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
  "kv_namespaces": [{ "binding": "SESSIONS", "id": "namespace-id" }]
}
```

**Option 2: Cloudflare D1 (SQL)**

```jsonc
{
  "d1_databases": [{ "binding": "DB", "database_name": "chat_db" }]
}
```

**Option 3: Durable Objects (Stateful)**

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "AGENT", "class_name": "Agent" }]
  }
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

## � Development Guidelines

### Adding New Features

#### 1. Adding New Message Types

To add a new message type that the agent can handle:

**Step 1**: Update `chat-agent.ts` `onMessage()` method:

```typescript
async onMessage(connection: Connection, data: any): Promise<void> {
  const message = typeof data === "string" ? JSON.parse(data) : data;

  // Add your new message type
  if (message.type === "your-new-type") {
    await this.handleYourNewType(connection, message);
    return;
  }

  // Existing handlers...
}

private async handleYourNewType(connection: Connection, message: any): Promise<void> {
  // Your implementation
  connection.send(JSON.stringify({
    type: "your-response-type",
    data: { /* your data */ }
  }));
}
```

**Step 2**: Update frontend `ChatEngine.tsx`:

```typescript
const connection = useAgent({
  agent: "ChatAgent",
  name: sessionId,
  onMessage: (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "your-response-type") {
      // Handle the response
    }
  },
});

// Send your new message type
connection.send(
  JSON.stringify({
    type: "your-new-type",
    payload: {
      /* your data */
    },
  })
);
```

#### 2. Adding New Tools for AI Agent

Follow the **Tool Registry Pattern** to keep code organized:

**Step 1**: Create tool file `src/server/tools/your-domain.ts`:

```typescript
import { tool } from "ai";
import { z } from "zod";

export function yourDomainTools(state: any) {
  return {
    yourTool: tool({
      description:
        "Clear description for AI to understand when to use this tool",
      parameters: z.object({
        param1: z.string().describe("What this parameter is for"),
        param2: z.number().optional().describe("Optional parameter"),
      }),
      execute: async ({ param1, param2 }) => {
        // Your tool logic
        const result = await performOperation(param1, param2);
        return `✅ Operation completed: ${result}`;
      },
    }),
  };
}
```

**Step 2**: Register in `src/server/tools/registry.ts`:

```typescript
import { yourDomainTools } from "./your-domain";

export function getTools(state: any) {
  return {
    ...contactTools(state),
    ...yourDomainTools(state), // Add here
  };
}
```

**Step 3**: Update agent system prompt to mention new capabilities.

#### 3. Extending Agent State Machine

To add new phases or state properties:

**Step 1**: Update `types.ts`:

```typescript
export type LoopPhase =
  | "idle"
  | "observing"
  | "thinking"
  | "acting"
  | "learning"
  | "your-new-phase"; // Add new phase

export interface AgentLoopState {
  phase: LoopPhase;
  goal?: string;
  iteration: number;
  maxIterations: number;
  currentAction?: string;
  reasoning?: string;
  progress: number;
  lastUpdate: number;
  yourNewField?: string; // Add new field
}
```

**Step 2**: Update state machine transitions in `agent-state-machine.ts`.

**Step 3**: Update frontend to handle new state in `onStateUpdate`.

### Code Organization Best Practices

#### File Structure Guidelines

```
src/server/
  agents/           # Agent classes (chat-agent.ts)
  tools/            # Tool definitions (registry.ts, contacts.ts, deals.ts)
  workflows/        # Multi-step workflows (contact-workflows.ts)

src/components/
  chat/             # Chat UI components (ChatEngine.tsx)

src/routes/         # Page routes (chat.tsx, index.tsx)
```

**Rules:**

- ✅ One agent = one file
- ✅ Group related tools in domain files (contacts.ts, deals.ts)
- ✅ Keep chat-agent.ts under 500 lines
- ✅ Extract complex logic into separate functions/files
- ❌ Don't mix UI and business logic
- ❌ Don't put tool definitions in agent file

#### Naming Conventions

- **Agent files**: `*-agent.ts` (e.g., `chat-agent.ts`)
- **Tool files**: `*-tools.ts` or domain name (e.g., `contacts.ts`)
- **Component files**: PascalCase (e.g., `ChatEngine.tsx`)
- **Message types**: kebab-case (e.g., `"user-message"`, `"agent-goal"`)
- **State fields**: camelCase (e.g., `currentAction`, `maxIterations`)

### Testing Guidelines

#### Manual Testing Checklist

**Chat Functionality:**

- [ ] User can send messages
- [ ] AI responds with streaming text
- [ ] Messages persist across page refresh
- [ ] Multiple tabs stay synchronized
- [ ] "Thinking" indicator shows while AI processes
- [ ] Error messages display when something fails

**Agent Loop (if using agent-goal):**

- [ ] Agent transitions through phases correctly
- [ ] Progress updates are visible
- [ ] Loop completes successfully
- [ ] Can handle multiple iterations
- [ ] Errors are caught and reported

**Tool Execution:**

- [ ] Tools are called with correct parameters
- [ ] Tool results are formatted properly
- [ ] Failed tool calls are handled gracefully
- [ ] Tool descriptions help AI use them correctly

#### Testing Commands

```bash
# Local development testing
pnpm dev

# Test in browser
open http://localhost:3000/chat

# Monitor logs
pnpm run dev  # In one terminal
# Check terminal output for errors

# Production testing
pnpm run deploy
# Test on deployed URL
```

### Debugging Techniques

#### Backend Debugging

**1. Add Console Logs:**

```typescript
console.log("[ChatAgent] Processing message:", message.type);
console.log("[ChatAgent] State:", this.state);
console.error("[ChatAgent] Error:", error);
```

**2. Check Cloudflare Logs:**

```bash
wrangler tail  # Real-time logs
```

**3. Inspect Durable Object Storage:**

```typescript
// Temporary debug endpoint
async onMessage(connection: Connection, data: any) {
  if (message.type === "debug-state") {
    const allData = await (this as any).ctx.storage.list();
    console.log("Storage contents:", Array.from(allData.entries()));
  }
}
```

#### Frontend Debugging

**1. WebSocket Messages:**

```typescript
const connection = useAgent({
  agent: "ChatAgent",
  name: sessionId,
  onMessage: (event) => {
    console.log("Received:", event.data); // Debug incoming messages
    // Your handling logic
  },
});
```

**2. State Inspection:**

```typescript
const [messages, setMessages] = useState<Message[]>([]);

useEffect(() => {
  console.log("Messages updated:", messages);
}, [messages]);
```

**3. Browser DevTools:**

- Network tab → WS filter → See all WebSocket messages
- Console → Check for errors
- React DevTools → Inspect component state

### Performance Optimization

#### Reduce Token Usage

```typescript
// Limit conversation history sent to AI
const messages = history.slice(-10); // Only last 10 messages

// Trim long messages
const trimmedContent =
  content.length > 1000 ? content.slice(0, 1000) + "..." : content;
```

#### Optimize State Updates

```typescript
// Batch state updates
await this.setState({
  agentLoop: { ...updates },
  lastUpdate: Date.now(),
  // Multiple updates in one call
});

// Use SDK state sync (automatic broadcasting)
// Instead of manual broadcast() calls
```

#### Stream Processing

```typescript
// Already optimized: Streaming responses
// Chunks sent as they arrive (no buffering)
const reader = response.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  this.broadcast(JSON.stringify({ chunk: value }));
}
```

### Security Best Practices

#### Input Validation

```typescript
// Validate message types
const validTypes = ["user-message", "get-messages", "agent-goal"];
if (!validTypes.includes(message.type)) {
  throw new Error("Invalid message type");
}

// Sanitize user input
const sanitized = content.trim().replace(/<script>/g, "");
```

#### Rate Limiting

```typescript
// Track requests per session
private requestCounts = new Map<string, number>();

async onMessage(connection: Connection, data: any) {
  const count = this.requestCounts.get(sessionId) || 0;
  if (count > 100) {
    connection.send(JSON.stringify({
      type: "error",
      message: "Rate limit exceeded"
    }));
    return;
  }
  this.requestCounts.set(sessionId, count + 1);
}
```

#### Authentication (when needed)

```typescript
async onConnect(connection: Connection) {
  // Extract auth token from URL or headers
  const token = connection.request.headers.get("Authorization");

  if (!token || !this.validateToken(token)) {
    connection.close(1008, "Unauthorized");
    return;
  }

  this.connections.add(connection);
}
```

### Common Patterns

#### Pattern 1: Conversational Parameter Gathering

Agent asks for missing required parameters:

```typescript
if (!firstName || !lastName || !email) {
  return "Please provide: First Name, Last Name, and Email";
}
```

#### Pattern 2: Optimistic UI Updates

Show message immediately, update when confirmed:

```typescript
// Client-side
const tempId = crypto.randomUUID();
setMessages([...messages, { id: tempId, ...message }]);

// Replace temp message when real message arrives
if (message.type === "message-start") {
  setMessages((prev) =>
    prev.map((m) => (m.id === tempId ? { ...m, id: message.messageId } : m))
  );
}
```

#### Pattern 3: State Machine Integration

Use for multi-step autonomous operations:

```typescript
// User sends goal
connection.send(
  JSON.stringify({
    type: "agent-goal",
    content: "Research and create contact for John Doe",
    maxIterations: 10,
  })
);

// Agent processes autonomously through loop
// observe → think → act → learn → repeat
```

### Migration Guides

#### From Single Agent to Multi-Agent

If you need specialized agents:

1. Keep `chat-agent.ts` as coordinator
2. Create specialized agents in separate files
3. Use subagent pattern to delegate tasks
4. Maintain shared state via SDK

#### From Manual Broadcasting to SDK State

Replace manual `broadcast()` with SDK `setState()`:

**Before:**

```typescript
this.broadcast(JSON.stringify({ progress: 50 }));
```

**After:**

```typescript
await this.setState({ progress: 50 }); // Auto-broadcasts to all clients
```

### Troubleshooting Common Issues

#### Issue: "Cannot read properties of undefined (reading 'agentLoop')"

**Cause**: State not initialized before access

**Solution**: Use `initialState` property:

```typescript
export class ChatAgent extends Agent<any, ChatAgentState> {
  initialState: ChatAgentState = {
    agentLoop: {
      phase: "idle",
      // ... initial values
    },
  };
}
```

#### Issue: Messages not persisting across refresh

**Cause**: Not loading messages on connect

**Solution**: Fetch messages in `onOpen`:

```typescript
const connection = useAgent({
  // ...
  onOpen: () => {
    connection.send(JSON.stringify({ type: "get-messages" }));
  },
});
```

#### Issue: No visual feedback when sending message

**Cause**: Missing "thinking" indicator

**Solution**: Add temporary thinking message (see ChatEngine.tsx implementation)

#### Issue: Agent loop not progressing

**Cause**: Missing state transitions or progress updates

**Solution**: Ensure all phases call `stateMachine.transition()` and `updateProgress()`

#### Issue: Tool not being called by AI

**Cause**: Poor tool description or parameters

**Solution**:

- Make description clear and specific
- Use `.describe()` on all parameters
- Test with explicit user requests
- Check system prompt mentions the tool

---

## �📚 Resources

- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Agents Framework](https://github.com/cloudflare/agents)
- [TanStack Start](https://tanstack.com/start)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Vercel AI SDK](https://sdk.vercel.com/)

---

**Built with ❤️ using TanStack Start and Cloudflare Workers AI**
