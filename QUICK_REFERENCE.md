# Quick Reference: WebSocket Agent Chat

## Architecture Overview

```
Browser (Chat.tsx) ←→ WebSocket ←→ Durable Object (ChatAgent) ←→ AI Model
```

---

## File Locations

| Component  | Path                         | Purpose                                 |
| ---------- | ---------------------------- | --------------------------------------- |
| **Agent**  | `src/server/agent-chat.ts`   | Durable Object handling WebSocket & RPC |
| **Client** | `src/components/Chat.tsx`    | React component for chat UI             |
| **Router** | `src/server/agent-router.ts` | Optional routing helper                 |
| **Config** | `wrangler.jsonc`             | Cloudflare Workers configuration        |
| **Route**  | `src/routes/chat/`           | Chat page route                         |

---

## WebSocket Connection

### Connect

```typescript
const sessionId = crypto.randomUUID();
const ws = new WebSocket(`wss://localhost:3000/agents/ChatAgent/${sessionId}`);
```

### Send Message

```typescript
ws.send(
  JSON.stringify({
    type: "chat",
    content: "What's in my pipeline?",
  })
);
```

### Listen to Messages

```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "connected": // Ready
    case "history": // Load messages[]
    case "message_added": // User message
    case "message_update": // Token received
    case "message_complete": // Response done
    case "history_cleared": // Reset
    case "error": // Error occurred
  }
};
```

---

## ChatAgent RPC Methods

### @callable sendMessage()

Send message and get streamed response

```typescript
// RPC call (from external)
POST /agents/ChatAgent/{sessionId}
{
  "method": "sendMessage",
  "params": ["Your question here"]
}
```

### @callable getHistory()

Retrieve all messages in conversation

```typescript
POST /agents/ChatAgent/{sessionId}
{
  "method": "getHistory"
}
```

### @callable clearHistory()

Clear all messages

```typescript
POST /agents/ChatAgent/{sessionId}
{
  "method": "clearHistory"
}
```

### @callable getState()

Get current agent state

```typescript
POST /agents/ChatAgent/{sessionId}
{
  "method": "getState"
}
```

---

## Message Types (WebSocket)

### connected

Agent is ready, session established

```json
{
  "type": "connected",
  "sessionId": "uuid"
}
```

### history

Full conversation history loaded

```json
{
  "type": "history",
  "messages": [
    { "id": "1", "role": "user", "content": "...", "timestamp": 123 },
    { "id": "2", "role": "assistant", "content": "...", "timestamp": 124 }
  ]
}
```

### message_added

New message added to conversation

```json
{
  "type": "message_added",
  "message": { "id": "3", "role": "user", "content": "Hi", "timestamp": 125 }
}
```

### message_update

Token received from AI stream

```json
{
  "type": "message_update",
  "token": "Hello"
}
```

### message_complete

AI response finished

```json
{
  "type": "message_complete",
  "message": {
    "id": "4",
    "role": "assistant",
    "content": "Hello! How can I help?",
    "timestamp": 126
  }
}
```

### history_cleared

All messages cleared

```json
{
  "type": "history_cleared"
}
```

### error

Error occurred

```json
{
  "type": "error",
  "error": "Failed to process message"
}
```

---

## State Structure

### ChatState (Server)

```typescript
interface ChatState {
  sessionId: string; // UUID
  userId: string; // User identifier
  messages: ChatMessage[]; // All messages
  context: Record<string, any>; // Custom data
  lastUpdated: number; // Timestamp
}

interface ChatMessage {
  id: string; // UUID
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
```

---

## Deployment

### Local Development

```bash
npm run dev
# Opens http://localhost:3000
```

### Production Build

```bash
npm run build
wrangler deploy
```

### Configuration

```json
{
  "ai": { "binding": "AI" },
  "durable_objects": {
    "bindings": [
      {
        "name": "CHAT_AGENT",
        "class_name": "ChatAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_classes": ["ChatAgent"]
    }
  ]
}
```

---

## Error Handling

### Connection Errors

```typescript
ws.onerror = () => {
  console.error("WebSocket error");
  // Implement reconnection logic
};

ws.onclose = () => {
  console.log("WebSocket closed");
  // Try to reconnect
};
```

### Message Errors

```typescript
if (data.type === "error") {
  console.error(data.error);
  // Show user-friendly message
}
```

---

## Performance Tips

1. **Batch Messages**: Send related messages together
2. **Debounce Input**: Don't send on every keystroke
3. **Pagination**: Load history in chunks for large conversations
4. **Connection Reuse**: Keep WebSocket open for multiple messages
5. **Cache State**: Store in localStorage if needed

---

## Debugging

### Check WebSocket Connection

```bash
# Browser DevTools
# Network tab → WS filter → Look for /agents/ChatAgent/...
```

### View Agent State

```typescript
// In DevTools console
ws.send(
  JSON.stringify({
    type: "rpc",
    method: "getState",
  })
);
```

### Monitor Broadcasting

```typescript
// Add to ChatAgent.onMessage()
console.log("Broadcasting to clients:", this.broadcast(message));
```

---

## Common Issues

| Issue                        | Solution                                   |
| ---------------------------- | ------------------------------------------ |
| WebSocket failed to connect  | Check CHAT_AGENT binding in wrangler.jsonc |
| Messages not persisting      | Verify Durable Object storage enabled      |
| Tokens not streaming         | Check AI binding configuration             |
| Session lost on restart      | Confirm SQL persistence enabled            |
| Multiple clients not syncing | Verify broadcast() called on state change  |

---

## API Reference

### Agent Class Methods (Server)

```typescript
export class ChatAgent extends Agent<any, ChatState> {
  // Lifecycle
  async onConnect(conn: WebSocket, ctx: any)
  async onMessage(conn: WebSocket, message: string)
  async onClose(ctx: any)
  async onError(error: Error)

  // Helpers
  broadcast(data: any)           // Send to all clients
  getState(): ChatState
  setState(state: ChatState)

  // RPC Methods (expose as @callable)
  @callable async sendMessage(message: string)
  @callable async getHistory()
  @callable async clearHistory()
  @callable async getState()
  @callable async updateContext(data: object)
}
```

### Client Methods (Browser)

```typescript
// WebSocket API
ws.send(message: string)
ws.close()
ws.addEventListener("message", handler)
ws.addEventListener("open", handler)
ws.addEventListener("close", handler)
ws.addEventListener("error", handler)
```

---

## Key Concepts

**WebSocket**: Persistent bidirectional connection for real-time updates

**Durable Objects**: Stateful components tied to unique IDs (sessionId)

**RPC**: Remote Procedure Call for server method invocation

**Broadcasting**: Sending updates to all connected clients at once

**State Persistence**: Messages/context saved in SQL automatically

**Agent Framework**: Cloudflare's framework for building stateful apps

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Agents Framework](https://developers.cloudflare.com/workers/wasm/modules/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## Support

For issues or questions:

1. Check browser DevTools Network tab for WebSocket errors
2. Review CloudFlare logs in dashboard
3. Check Durable Object storage in Cloudflare UI
4. Verify configuration matches wrangler.jsonc

---

Generated: Option 2 Implementation Complete
