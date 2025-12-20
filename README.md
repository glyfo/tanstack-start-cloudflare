# TanStack Start + Cloudflare AI Agent

A production-grade AI chat application built with **TanStack React Start**, **Cloudflare Workers AI**, and **Cloudflare Agents Framework**, featuring real-time WebSocket communication, persistent agent state, and professional-grade AI orchestration.

## 🚀 Features

### ⭐ Pure WebSocket Agent (Option 2 - Active)

#### Real-time Bidirectional Communication

- **WebSocket First**: Direct connection to `/agents/ChatAgent/{sessionId}`
- **Token Streaming**: AI response tokens streamed in real-time
- **Persistent State**: Conversation history stored in SQL via Durable Objects
- **Automatic Broadcasting**: All connected clients receive state updates

#### Agent Framework Integration

- **Durable Objects**: Stateful agent instances per session
- **RPC Methods**: Type-safe @callable methods
- **State Persistence**: Auto-saved to SQL (cf_agents_state)
- **Lifecycle Hooks**: onConnect, onMessage, onClose, onError

#### Clean Architecture

- **No Server Functions**: Pure Agent-based communication
- **Minimal Configuration**: wrangler.jsonc with essential bindings only
- **Type-Safe**: Full TypeScript support for RPC methods
- **Scalable**: No in-memory state, session data in persistent storage

```

- **Cloudflare Agents Framework**: Proper Agent class and lifecycle
- **6 Built-in Tools**: Time, sessions, tasks, context, knowledge search, workflows
- **Custom Tool Support**: Easy to add your own tools
- **Automatic Tool Detection**: AI decides when to use tools

#### Enhanced Storage

- **Durable Objects**: Stateful computation and persistence
- **D1 Database**: Optional SQL database for structured data
- **KV Namespaces**: Fast caching layer
- **R2 Storage**: Optional file storage integration

### Two Interaction Patterns

#### 1. **Direct Messaging** (Stateless)

Simple, fast, no memory between requests:

- Quick responses to single prompts
- Lightweight and responsive
- Perfect for simple queries
- Best for simple use cases

#### 2. **Agent Conversations** (Stateful with Durable Objects)

Intelligent interactions with persistent state:

- Full conversation history per session
- Tool calling and execution
- Context awareness across messages
- Real-time WebSocket streaming
- Automatic persistence

### Core Capabilities

- **Flexible Architecture**: Choose between stateless and stateful patterns
- **Tool Integration**: Automatic tool detection and execution
- **Real-time Streaming**: Server-Sent Events (SSE) for progressive token streaming
- **Session Management**: Multi-session support with isolated state
- **Human-Agent Flexibility**: Support both free-form prompts and structured agent communication

### Available Tools

1. **getCurrentTime** - Get current date and time
2. **getContextInfo** - Access conversation context data
3. **summarizeConversation** - Generate conversation summaries
4. **Extensible**: Easy to add custom tools

### UI/UX Features

- **Error Handling**: User-friendly error display with retry capability
- **Message Management**: Copy, clear, and regenerate functionality
- **Timestamps**: HH:MM format for every message
- **Loading States**: Smooth typing indicators during generation
- **Responsive Design**: Fully responsive with Tailwind CSS
- **Auto-Scroll**: Automatic scrolling to latest messages

## 📋 Tech Stack

### Frontend

- **Framework**: TanStack React Start (React 19+)
- **Styling**: Tailwind CSS with flexible layouts
- **Icons**: Lucide React
- **Type Safety**: TypeScript 5.7+ with strict typing

### Backend

- **Server Functions**: TanStack React Start `createServerFn()`
- **Cloud Platform**: Cloudflare Workers (serverless compute)
- **AI Model**: `@cf/meta/llama-3.1-8b-instruct` (swappable)
- **Transport**: Server-Sent Events (SSE) for streaming
- **State Management**: In-memory session store (extensible to KV/D1)

### Build & Deploy

- **Build Tool**: Vite 7.1+
- **Platform**: Cloudflare Workers
- **Type System**: TypeScript strict mode

## 🏗️ Project Structure

```

src/
├── server/
│ └── ai.ts # Core AI agent implementation
├── components/
│ ├── Chat.tsx # Main chat UI component
│ ├── ChatMessages.tsx # Message list with auto-scroll
│ ├── MessageBubble.tsx # Individual message rendering
│ ├── ChatInput.tsx # Input form with keyboard handling
│ └── TypingIndicator.tsx # Loading animation
├── routes/
│ ├── \_\_root.tsx # Root layout
│ ├── index.tsx # Home/landing page
│ └── chat.tsx # Chat interface route
└── styles.css # Global Tailwind styles

````

## 🔑 Key Concepts

### Architecture Comparison

| Aspect       | Direct Messaging           | Agent Conversations                |
| ------------ | -------------------------- | ---------------------------------- |
| **State**    | Stateless                  | Persistent per session             |
| **Memory**   | No history                 | Full conversation history          |
| **Tools**    | Manual handling            | Automatic detection                |
| **Latency**  | Minimal                    | Slightly higher (state management) |
| **Use Case** | Quick queries              | Complex multi-turn dialogs         |
| **Context**  | Limited to current message | Entire session context             |

### Server Functions

Located in `src/server/ai.ts`:

**Option 1: Direct Messaging** (`handleMessage`)

```typescript
- Input: message string
- Output: AI response + metadata
- Stateless, fast, no history
- Good for: Single-turn queries
````

**Option 2: Agent Streaming** (`streamMessage`)

```typescript
- Input: message + sessionId
- Output: SSE stream with state updates
- Stateful, maintains context
- Good for: Multi-turn conversations
```

### State Management

**Session-Based State**:

- Unique session ID per conversation
- Tracks conversation history
- Maintains context between requests
- Isolated per user session

```typescript
interface AgentState {
  sessionId: string; // Unique session identifier
  messages: AgentMessage[]; // Full conversation history
  context: Record<string, any>; // Custom context data
  lastUpdated: number; // Timestamp of last update
}
```

### Tool System

Tools are detected automatically when the AI model decides to use them:

```typescript
const tools: Record<string, Tool> = {
  toolName: {
    name: "toolName",
    description: "What it does",
    execute: async (args) => {
      // Tool implementation
      return JSON.stringify({ result });
    },
  },
};
```

**Execution Flow**:

```
User Message
    ↓
AI Model (with tool list in prompt)
    ↓
Detects tool call in response
    ↓
Execute tool with AI's parameters
    ↓
Get tool result
    ↓
Follow-up AI response with tool result
    ↓
Final answer to user
```

## 🔧 Getting Started

### Prerequisites

- Node.js 18+
- npm
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

## 📝 API Reference

### Server Functions

#### `handleMessage(input: MessageInput): Promise<MessageResponse>`

Non-streaming message handler with state management.

**When to use**: Multi-turn conversations with history

**Returns**: Full response with conversation history and metadata

#### `streamMessage(input: MessageInput): Response`

Streaming message handler with real-time SSE events.

**When to use**: Real-time chat with progressive token display

**Response Format**:

```
data: {"type":"token","content":"Hello"}
data: {"type":"complete","conversationHistory":[...]}
```

#### `getConversationHistory(sessionId: string)`

Retrieve full conversation history for a session.

#### `clearConversation(sessionId: string)`

Reset conversation state for a session.

#### `getAvailableTools()`

List all available tools the agent can call.

## 🎯 Usage Patterns

### Pattern 1: Quick Query (Stateless)

```typescript
const response = await handleMessage({
  message: "What's 2+2?",
  // No sessionId = stateless, no history
});
```

### Pattern 2: Conversation (Stateful)

```typescript
// First message
const response1 = await streamMessage({
  message: "Tell me about React",
  sessionId: "user_123_chat_1", // Creates session
});

// Follow-up message (has context from first message)
const response2 = await streamMessage({
  message: "How about Vue?",
  sessionId: "user_123_chat_1", // Same session = history preserved
});
```

### Pattern 3: Tool Integration

```typescript
const response = await handleMessage({
  message: "What time is it? Please also summarize our conversation",
  sessionId: "user_123",
  // Agent automatically detects both tool calls:
  // - getCurrentTime tool
  // - summarizeConversation tool
});
// Response includes execution results from both tools
```

## 🛠️ Customization

### Adding a Custom Tool

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

The system automatically:

- Includes tool in system prompt
- Detects when AI wants to call it
- Executes with AI-provided arguments
- Incorporates results into response

### Changing AI Model

In `src/server/ai.ts`, change the model constant:

```typescript
const model = "@cf/meta/llama-3.1-8b-instruct"; // Change this
```

**Available Models**:

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

## 🔄 State Persistence (Advanced)

Current implementation uses in-memory state. For production:

### Option 1: Cloudflare KV (Simple)

```jsonc
{
  "kv_namespaces": [{ "binding": "SESSIONS", "id": "namespace-id" }],
}
```

### Option 2: Cloudflare D1 (SQL)

```jsonc
{
  "d1_databases": [{ "binding": "DB", "database_name": "chat_db" }],
}
```

### Option 3: Durable Objects (Stateful)

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "AGENT", "class_name": "Agent" }],
  },
}
```

## 🧠 AI Agent Lifecycle

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

## 💡 Best Practices

1. **Use Sessions for Context**: Stateful conversations are more helpful
2. **Tool Descriptions**: Keep tool descriptions clear for AI to use correctly
3. **Error Handling**: All tool execution errors are gracefully handled
4. **Message Limits**: Consider limiting conversation history for performance
5. **Context Relevance**: Only include relevant context in prompts

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

## 📚 Resources

- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Agents Framework](https://github.com/cloudflare/agents)
- [TanStack Start](https://tanstack.com/start)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [AI SDK](https://sdk.vercel.com/)

## 🔗 Related

- **Cloudflare Agents**: Full stateful agent framework with Durable Objects
- **Vercel AI SDK**: Universal AI interface (inspiration)
- **TanStack**: React framework (UI layer)

---

**Built with ❤️ using TanStack Start and Cloudflare Workers AI**

````

### Development

```bash
# Start development server
npm run dev

# Navigate to http://localhost:3000/chat
````

### Building & Deployment

```bash
# Build for production
npm run build

# Deploy to Cloudflare Workers
wrangler deploy
```

## 📝 API Reference

### Server Functions

#### `handleMessage(input: MessageInput): Promise<MessageResponse>`

Main message handler with full conversation state management.

**Input**:

```typescript
interface MessageInput {
  message: string;
  sessionId?: string;
  userId?: string;
  context?: Record<string, any>;
  conversationHistory?: AgentMessage[];
}
```

**Output**:

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

**Usage**:

```typescript
import { handleMessage } from "@/server/ai";

const response = await handleMessage({
  message: "What time is it?",
  sessionId: "session_123",
  userId: "user_456",
});

console.log(response.response); // AI response
console.log(response.metadata.toolsUsed); // ["getCurrentTime"]
```

#### `streamMessage(input: MessageInput): Response`

Streaming message handler with Server-Sent Events.

**Response Format**: SSE stream with events

```
data: {"type":"token","content":"Hello","timestamp":1702...}

data: {"type":"token","content":" ","timestamp":1702...}

data: {"type":"complete","conversationHistory":[...],"timestamp":1702...}
```

**Usage**:

```typescript
import { streamMessage } from "@/server/ai";

const response = await streamMessage({
  message: "Tell me a story",
  sessionId: "session_123",
});

const reader = response.body.getReader();
// Process stream...
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

## 🎯 Agent System Architecture

### State Management

The agent maintains session-based state including:

- **Messages**: Full conversation history with roles and timestamps
- **Context**: Custom data passed between requests
- **Loading State**: Track ongoing AI operations
- **User Info**: Session and user identification

### Tool Execution Flow

```
User Message → Agent Detects Tool Call
              ↓
         Execute Tool
              ↓
    Get Tool Result → Follow-up AI Response
              ↓
    Return Enhanced Answer
```

### Adding Custom Tools

Add new tools to the `tools` object in `ai.ts`:

```typescript
const tools: Record<string, Tool> = {
  myCustomTool: {
    name: "myCustomTool",
    description: "Description of what it does",
    execute: async (args: Record<string, any>) => {
      // Your tool logic
      return JSON.stringify({ result: "..." });
    },
  },
};
```

The system prompt automatically includes all tools, and the agent will call them when appropriate.

## 🎨 Component Overview

### Chat.tsx (Main Component)

**Responsibilities**:

- Session management and message state
- Message sending (streaming or non-streaming)
- UI interactions (copy, clear, regenerate)
- Error handling and recovery

**Key Functions**:

- `sendMessage(content)` - Main message handler
- `copyToClipboard(text, messageId)` - Copy with feedback
- `handleClearChat()` - Clear with confirmation
- `handleRegenerateMessage()` - Retry last message

### ChatMessages.tsx

- Displays message list with auto-scroll
- Empty state when no messages
- Passes handlers to individual messages

### MessageBubble.tsx

- Renders individual messages (user/assistant)
- Copy button with visual feedback
- Timestamps (HH:MM format)
- Markdown support for bold text

### ChatInput.tsx

- Textarea with auto-resize
- Enter to send, Shift+Enter for newline
- Submit button with loading state

### TypingIndicator.tsx

- Animated dots for loading state
- Shown while AI is generating

## 🔌 Cloudflare Workers AI Integration

### How It Works

1. **User Sends Message** → Client calls server function
2. **State Management** → Session initialized or retrieved
3. **Context Building** → Conversation history + system prompt
4. **AI Inference** → Cloudflare AI generates response
5. **Tool Detection** → Check if response contains tool call
6. **Tool Execution** → Execute tool if needed
7. **Final Response** → Return answer with metadata
8. **State Update** → Save to conversation history

### Configuration

The AI agent is configured in `/src/server/ai.ts`:

```typescript
const model = "@cf/meta/llama-3.1-8b-instruct";
const response = await AI.run(model, {
  prompt: enhancedPromptWithHistory,
  stream: false, // or true for streaming
});
```

### Bindings Setup (wrangler.jsonc)

```json
{
  "ai": {
    "binding": "AI"
  }
}
```

## 🔧 Configuration

### Environment Variables

No environment variables needed - uses Cloudflare bindings directly.

### Wrangler Configuration

See `wrangler.jsonc` for full configuration:

- AI binding
- Node compatibility
- Build settings
- Routes and compatibility dates

## 🚀 Deployment

### Deploy to Cloudflare Workers

```bash
# Build the project
npm run build

# Deploy using Wrangler
wrangler deploy

# Monitor logs
wrangler tail
```

### Production Checklist

- [ ] Build succeeds without errors
- [ ] AI binding configured in wrangler.jsonc
- [ ] Test locally with `npm run dev`
- [ ] Deploy to staging first
- [ ] Verify streaming works in production
- [ ] Monitor error rates

## 📊 Features Roadmap

### Current Version (v1.0)

- ✅ Intelligent agent with state management
- ✅ Tool calling system
- ✅ Conversation history
- ✅ Streaming responses
- ✅ Session management
- ✅ Error handling

### Future Enhancements

- [ ] Persistent storage (KV or D1)
- [ ] User authentication
- [ ] Multi-user sessions
- [ ] Advanced tool library
- [ ] File upload support
- [ ] Custom model selection
- [ ] Rate limiting
- [ ] Analytics dashboard

## 🤝 Contributing

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Resources

- [TanStack Start Documentation](https://tanstack.com/start)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

**Built with ❤️ using TanStack Start and Cloudflare Workers AI**

</div>
);
}

export default App;

```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
```
