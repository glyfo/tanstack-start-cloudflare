# Workers AI Streaming - Quick Reference

> One-page reference for implementing streaming with Workers AI

---

## 🚀 Basic Setup

```typescript
export interface Env {
  AI: Ai;
}

const response = await env.AI.run(
  "@cf/meta/llama-3-8b-instruct",
  {
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", content: "User message" }
    ],
    stream: true  // ← Must be true for streaming
  }
);
```

---

## 📡 SSE Format

Workers AI returns Server-Sent Events:

```
data: {"response": "Hello"}

data: {"response": " world"}

data: [DONE]

```

**Rules:**
- Prefix: `data: `
- Format: JSON with `response` field
- Separator: `\n\n`
- End marker: `[DONE]`

---

## ✅ Correct Stream Parser

```typescript
const reader = response.getReader();
const decoder = new TextDecoder();
let buffer = "";  // ← Buffer for incomplete lines
let fullResponse = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Add to buffer
  buffer += decoder.decode(value, { stream: true });

  // Split into lines
  const lines = buffer.split('\n');

  // Keep incomplete line in buffer
  buffer = lines.pop() || "";

  // Process complete lines
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.substring(6).trim();

      // Check for end marker
      if (jsonStr === '[DONE]') continue;

      // Skip empty
      if (!jsonStr) continue;

      // Parse and use
      try {
        const data = JSON.parse(jsonStr);
        if (data.response) {
          fullResponse += data.response;
          // Send to client, broadcast, etc.
        }
      } catch (err) {
        console.warn('Parse error:', err);
      }
    }
  }
}
```

---

## 🔥 Common Mistakes

### ❌ WRONG: No buffering
```typescript
// Will fail on split JSON!
const text = decoder.decode(value);
const data = JSON.parse(text); // ❌
```

### ✅ RIGHT: Buffer incomplete lines
```typescript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n');
buffer = lines.pop() || ""; // ✅
```

---

### ❌ WRONG: Ignore [DONE]
```typescript
const data = JSON.parse(jsonStr); // ❌ Crashes on [DONE]
```

### ✅ RIGHT: Check for [DONE]
```typescript
if (jsonStr === '[DONE]') continue; // ✅
const data = JSON.parse(jsonStr);
```

---

### ❌ WRONG: Process raw chunks
```typescript
// Bad: Chunks are Uint8Array, may split mid-UTF8 character
processChunk(value); // ❌
```

### ✅ RIGHT: Use TextDecoder with stream flag
```typescript
const decoder = new TextDecoder();
buffer += decoder.decode(value, { stream: true }); // ✅
```

---

## 🎯 WebSocket Broadcast Pattern

```typescript
class ChatAgent extends Agent {
  connections: Set<Connection> = new Set();

  async handleChat(userMessage: string) {
    const msgId = crypto.randomUUID();

    // 1. Notify start
    this.broadcast({ type: "message-start", messageId: msgId });

    // 2. Stream and broadcast chunks
    const response = await this.env.AI.run(MODEL, { messages, stream: true });
    const reader = response.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]' || !jsonStr) continue;

          const data = JSON.parse(jsonStr);
          if (data.response) {
            fullResponse += data.response;

            // Broadcast each chunk
            this.broadcast({
              type: "message-chunk",
              messageId: msgId,
              chunk: data.response
            });
          }
        }
      }
    }

    // 3. Save and finalize
    await this.saveMessage({ id: msgId, content: fullResponse });
    this.broadcast({ type: "message-done", messageId: msgId });
  }

  broadcast(msg: any) {
    const json = JSON.stringify(msg);
    for (const conn of this.connections) {
      conn.send(json);
    }
  }
}
```

---

## 🛡️ Error Handling Template

```typescript
try {
  const response = await env.AI.run(MODEL, { messages, stream: true });

  if (!response) {
    throw new Error("AI returned null response");
  }

  // ... stream processing

} catch (error) {
  console.error('Stream error:', error);

  // User-friendly messages
  let userMsg = "Something went wrong. Please try again.";

  if (error.message.includes("null response")) {
    userMsg = "AI service temporarily unavailable.";
  } else if (error.message.includes("timeout")) {
    userMsg = "Request took too long. Try a simpler question.";
  } else if (error.message.includes("rate limit")) {
    userMsg = "Too many requests. Please wait.";
  }

  // Send error to client
  connection.send(JSON.stringify({
    type: "error",
    message: userMsg
  }));
}
```

---

## 📊 Response Headers (HTTP)

```typescript
return new Response(stream, {
  headers: {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "x-accel-buffering": "no" // Disable proxy buffering
  }
});
```

---

## 🎨 Message Format Conversion

```typescript
interface AppMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
  metadata?: any;
}

// Convert app format → AI format
function toAIFormat(messages: AppMessage[]) {
  return messages.map(m => ({
    role: m.role,      // ← Only these two
    content: m.content // ← fields needed
  }));
}

const response = await env.AI.run(MODEL, {
  messages: [
    { role: "system", content: systemPrompt },
    ...toAIFormat(messageHistory)
  ],
  stream: true
});
```

---

## ⚡ Performance Tips

### Batch Small Chunks
```typescript
let chunkBuffer = "";
let lastSend = Date.now();

// Inside stream loop:
if (data.response) {
  chunkBuffer += data.response;

  // Send every 50ms or 20 chars
  if (Date.now() - lastSend > 50 || chunkBuffer.length > 20) {
    broadcast({ type: "chunk", text: chunkBuffer });
    chunkBuffer = "";
    lastSend = Date.now();
  }
}

// Don't forget remaining buffer
if (chunkBuffer) {
  broadcast({ type: "chunk", text: chunkBuffer });
}
```

### Limit Context Window
```typescript
// Only send recent messages
const recentMessages = messageHistory.slice(-20);
```

### Choose Right Model
```typescript
const MODEL = userQuery.length > 500
  ? "@cf/qwen/qwen2.5-72b-instruct"      // Complex
  : "@cf/meta/llama-3-8b-instruct";       // Fast
```

---

## 🧪 Testing Snippet

```typescript
describe("AI Streaming", () => {
  it("streams tokens", async () => {
    const response = await env.AI.run(MODEL, {
      messages: [{ role: "user", content: "Hi" }],
      stream: true
    });

    const reader = response.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith('data: ') && line.includes('response')) {
          chunks++;
        }
      }
    }

    expect(chunks).toBeGreaterThan(0);
  });
});
```

---

## 📋 Recommended Models (Jan 2026)

| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `@cf/meta/llama-3-8b-instruct` | ⚡⚡⚡ Fast | ⭐⭐ Good | Quick queries |
| `@cf/meta/llama-3.1-70b-instruct` | ⚡⚡ Medium | ⭐⭐⭐ Great | Balanced |
| `@cf/qwen/qwen2.5-72b-instruct` | ⚡ Slow | ⭐⭐⭐⭐ Best | Complex reasoning |

---

## 🔗 Key Resources

- [Workers AI Streaming Blog](https://blog.cloudflare.com/workers-ai-streaming/)
- [Agents API Reference](https://developers.cloudflare.com/agents/api-reference/using-ai-models/)
- [Full Guide](./WORKERS-AI-STREAMING-GUIDE.md)

---

**Pro Tip:** Always buffer incomplete lines when parsing SSE streams!
