# Workers AI Streaming Implementation Guide

**Complete reference for implementing AI streaming in Cloudflare Workers and Agents**

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Concepts](#basic-concepts)
3. [Implementation Patterns](#implementation-patterns)
4. [Best Practices](#best-practices)
5. [Error Handling](#error-handling)
6. [Performance Optimization](#performance-optimization)
7. [Complete Examples](#complete-examples)
8. [Common Pitfalls](#common-pitfalls)

---

## Overview

Workers AI provides native streaming support for Large Language Models (LLMs), enabling token-by-token response delivery similar to ChatGPT. This guide covers the native Workers AI approach without external SDKs.

**Why Native Streaming?**
- ✅ Direct binding access (minimal overhead)
- ✅ Better error handling and visibility
- ✅ No external dependencies
- ✅ Optimized for Cloudflare's edge network
- ✅ Automatic SSE (Server-Sent Events) formatting

---

## Basic Concepts

### Server-Sent Events (SSE)

Workers AI returns streams in SSE format:

```
data: {"response": "Hello"}

data: {"response": " world"}

data: {"response": "!"}

data: [DONE]

```

**Format Rules:**
- Each event starts with `data: `
- JSON payload follows
- Double newline (`\n\n`) separates events
- `[DONE]` marker signals completion

### Workers AI Binding

Access AI models through the environment binding:

```typescript
export interface Env {
  AI: Ai; // Workers AI binding
}

// Usage in Worker/Agent
const response = await this.env.AI.run(
  "@cf/meta/llama-3-8b-instruct",
  {
    messages: [...],
    stream: true // Enable streaming
  }
);
```

---

## Implementation Patterns

### Pattern 1: Basic HTTP Streaming (Workers)

**Use Case:** Simple REST API endpoint that streams AI responses

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prompt } = await request.json();

    const stream = await env.AI.run(
      "@cf/meta/llama-3-8b-instruct",
      {
        messages: [{ role: "user", content: prompt }],
        stream: true
      }
    );

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive"
      }
    });
  }
};
```

**When to use:**
- One-off requests
- Stateless interactions
- Direct client consumption

---

### Pattern 2: WebSocket Streaming (Durable Objects/Agents)

**Use Case:** Real-time chat with message history and state management

```typescript
import { Agent, Connection } from "agents";

export class ChatAgent extends Agent<any, ChatAgentState> {

  async handleChat(connection: Connection, userMessage: string) {
    // 1. Prepare message history
    const messages = await this.getMessageHistory();

    // 2. Call Workers AI with streaming
    const response = await this.env.AI.run(
      "@cf/meta/llama-3-8b-instruct",
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: true
      }
    );

    // 3. Parse SSE stream and broadcast chunks
    const reader = response.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";

    // Notify clients that streaming started
    this.broadcast({
      type: "message-start",
      messageId: "msg-123"
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode and buffer
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // Keep incomplete line

      // Process complete lines
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();

          if (jsonStr === '[DONE]') {
            console.log('Stream complete');
            continue;
          }

          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.response) {
              fullResponse += data.response;

              // Broadcast chunk to all connected clients
              this.broadcast({
                type: "message-chunk",
                messageId: "msg-123",
                chunk: data.response
              });
            }
          } catch (err) {
            console.error('Failed to parse SSE:', err);
          }
        }
      }
    }

    // 4. Save and finalize
    await this.saveMessage({
      id: "msg-123",
      role: "assistant",
      content: fullResponse
    });

    this.broadcast({
      type: "message-done",
      messageId: "msg-123"
    });
  }

  private broadcast(message: any) {
    const json = JSON.stringify(message);
    for (const conn of this.connections) {
      conn.send(json);
    }
  }
}
```

**When to use:**
- Multi-turn conversations
- Stateful interactions
- Multiple simultaneous clients
- Real-time collaboration

---

### Pattern 3: Transform Stream (Advanced)

**Use Case:** Process/modify tokens before sending to client

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const aiStream = await env.AI.run(
      "@cf/meta/llama-3-8b-instruct",
      { messages: [...], stream: true }
    );

    // Transform stream to add custom processing
    const { readable, writable } = new TransformStream({
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            // Custom processing: convert to uppercase
            if (data.response) {
              data.response = data.response.toUpperCase();
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
              );
            }
          }
        }
      }
    });

    // Pipe AI stream through transform
    ctx.waitUntil(aiStream.pipeTo(writable));

    return new Response(readable, {
      headers: { "content-type": "text/event-stream" }
    });
  }
};
```

**When to use:**
- Token filtering/censorship
- Format conversion
- Analytics/logging
- Rate limiting

---

## Best Practices

### 1. Always Use Buffering for SSE Parsing

**❌ Wrong:** Process chunks directly

```typescript
// BAD: May split JSON across chunks
const { value } = await reader.read();
const text = decoder.decode(value);
const data = JSON.parse(text); // May fail!
```

**✅ Correct:** Buffer incomplete lines

```typescript
// GOOD: Handle partial messages
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || ""; // Keep last incomplete line

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      // Process complete line
    }
  }
}
```

### 2. Handle [DONE] Marker

```typescript
if (jsonStr === '[DONE]') {
  console.log('Stream completed normally');
  break; // or continue, depending on your flow
}
```

### 3. Validate JSON Before Parsing

```typescript
if (!jsonStr || jsonStr.trim() === '') {
  continue; // Skip empty lines
}

try {
  const data = JSON.parse(jsonStr);
  // Process data
} catch (err) {
  console.warn('Invalid JSON in stream:', jsonStr, err);
  // Don't break the entire stream
}
```

### 4. Set Proper Headers

```typescript
return new Response(stream, {
  headers: {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "x-accel-buffering": "no" // Disable nginx buffering
  }
});
```

### 5. Use ExecutionContext for Long Operations

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Keep worker alive for streaming
    ctx.waitUntil(
      handleStreamingResponse(request, env)
    );

    return new Response(...);
  }
};
```

### 6. Message Format Conversion

**Convert from your app format to AI format:**

```typescript
interface AppMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: any;
}

// Convert to Workers AI format
function toAIMessages(messages: AppMessage[]) {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
    // AI only needs role and content
  }));
}

const aiMessages = toAIMessages(messageHistory);
```

---

## Error Handling

### Comprehensive Error Strategy

```typescript
async function streamWithErrorHandling(
  env: Env,
  messages: any[]
): Promise<string> {
  let fullResponse = "";
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount < MAX_RETRIES) {
    try {
      const response = await env.AI.run(
        "@cf/meta/llama-3-8b-instruct",
        { messages, stream: true }
      );

      if (!response) {
        throw new Error("AI service returned null response");
      }

      const reader = response.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();

            if (jsonStr === '[DONE]') continue;
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.response) {
                fullResponse += data.response;
              } else if (data.error) {
                throw new Error(`AI Error: ${data.error}`);
              }
            } catch (parseErr) {
              console.warn('Parse error:', parseErr);
              // Continue processing other chunks
            }
          }
        }
      }

      return fullResponse; // Success!

    } catch (error) {
      retryCount++;

      console.error(`Stream attempt ${retryCount} failed:`, error);

      // Exponential backoff
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Final failure
        throw new Error(
          `Stream failed after ${MAX_RETRIES} attempts: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }
  }

  throw new Error('Unexpected: retry loop exited');
}
```

### User-Friendly Error Messages

```typescript
function getUserFriendlyError(error: Error): { message: string; code: string } {
  if (error.message.includes("null response")) {
    return {
      message: "The AI service is temporarily unavailable. Please try again.",
      code: "AI_SERVICE_ERROR"
    };
  }

  if (error.message.includes("timeout")) {
    return {
      message: "The request took too long. Try a simpler question.",
      code: "TIMEOUT_ERROR"
    };
  }

  if (error.message.includes("rate limit")) {
    return {
      message: "Too many requests. Please wait a moment.",
      code: "RATE_LIMIT"
    };
  }

  return {
    message: "Something went wrong. Please try again.",
    code: "UNKNOWN_ERROR"
  };
}
```

---

## Performance Optimization

### 1. Chunk Batching

Instead of broadcasting every single token, batch them:

```typescript
let chunkBuffer = "";
let lastBroadcast = Date.now();
const BROADCAST_INTERVAL = 50; // ms

for (const line of lines) {
  if (line.startsWith('data: ')) {
    const data = JSON.parse(line.substring(6));

    if (data.response) {
      chunkBuffer += data.response;

      // Broadcast every 50ms or when buffer is large
      if (Date.now() - lastBroadcast > BROADCAST_INTERVAL ||
          chunkBuffer.length > 20) {
        this.broadcast({
          type: "message-chunk",
          chunk: chunkBuffer
        });
        chunkBuffer = "";
        lastBroadcast = Date.now();
      }
    }
  }
}

// Send remaining buffer
if (chunkBuffer) {
  this.broadcast({ type: "message-chunk", chunk: chunkBuffer });
}
```

### 2. Connection Pooling

Reuse connections in Durable Objects:

```typescript
class ChatAgent extends Agent {
  private connections: Set<Connection> = new Set();

  async onConnect(connection: Connection) {
    this.connections.add(connection);

    // Send initial state
    connection.send(JSON.stringify({
      type: "connected",
      sessionId: this.id
    }));
  }

  async onClose(connection: Connection) {
    this.connections.delete(connection);
  }

  broadcast(message: any) {
    const json = JSON.stringify(message);

    // Efficient broadcast to all connections
    for (const conn of this.connections) {
      try {
        conn.send(json);
      } catch (err) {
        // Connection may be closed
        this.connections.delete(conn);
      }
    }
  }
}
```

### 3. Smart Context Management

Only send recent messages to AI:

```typescript
async function getRecentMessages(
  storage: DurableObjectStorage,
  limit: number = 20
): Promise<Message[]> {
  const messages = await storage.list<Message>({
    prefix: "msg:",
    reverse: true,
    limit
  });

  return Array.from(messages.values()).reverse();
}
```

### 4. Use Appropriate Models

Choose models based on your use case:

```typescript
const MODELS = {
  // Fast, good for simple queries
  fast: "@cf/meta/llama-3-8b-instruct",

  // Balanced performance
  balanced: "@cf/meta/llama-3.1-70b-instruct",

  // Best quality, slower
  quality: "@cf/qwen/qwen2.5-72b-instruct"
};

// Select based on query complexity
const model = userQuery.length > 500
  ? MODELS.quality
  : MODELS.fast;
```

---

## Complete Examples

### Example 1: Simple Chat Worker

```typescript
// worker.ts
export interface Env {
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "POST" && request.url.endsWith("/chat")) {
      const { message } = await request.json();

      const stream = await env.AI.run(
        "@cf/meta/llama-3-8b-instruct",
        {
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: message }
          ],
          stream: true
        }
      );

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "access-control-allow-origin": "*"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
```

**Client-side consumption:**

```typescript
const eventSource = new EventSource('/chat', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello!' })
});

eventSource.onmessage = (event) => {
  if (event.data === '[DONE]') {
    eventSource.close();
    return;
  }

  const data = JSON.parse(event.data);
  console.log('Token:', data.response);
};
```

---

### Example 2: Agent with Full State Management

```typescript
// chat-agent.ts
import { Agent, Connection } from "agents";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export class ChatAgent extends Agent<any, any> {
  private connections: Set<Connection> = new Set();

  async onConnect(connection: Connection) {
    this.connections.add(connection);

    // Send message history
    const messages = await this.getMessages();
    connection.send(JSON.stringify({
      type: "history",
      messages
    }));
  }

  async onMessage(connection: Connection, data: any) {
    const message = JSON.parse(data);

    if (message.type === "user-message") {
      await this.handleChat(connection, message.content);
    }
  }

  async handleChat(connection: Connection, userContent: string) {
    // 1. Save user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userContent,
      timestamp: Date.now()
    };

    await this.saveMessage(userMessage);
    this.broadcast({ type: "message", message: userMessage });

    // 2. Get history and prepare for AI
    const history = await this.getMessages();
    const aiMessages = history.map(m => ({
      role: m.role,
      content: m.content
    }));

    // 3. Stream AI response
    const assistantId = crypto.randomUUID();
    this.broadcast({ type: "message-start", messageId: assistantId });

    let fullResponse = "";

    try {
      const response = await this.env.AI.run(
        "@cf/meta/llama-3-8b-instruct",
        {
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            ...aiMessages
          ],
          stream: true
        }
      );

      const reader = response.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              this.broadcast({
                type: "message-chunk",
                messageId: assistantId,
                chunk: data.response
              });
            }
          }
        }
      }

      // 4. Save assistant message
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: fullResponse,
        timestamp: Date.now()
      };

      await this.saveMessage(assistantMessage);
      this.broadcast({
        type: "message-done",
        messageId: assistantId,
        message: assistantMessage
      });

    } catch (error) {
      console.error('Stream error:', error);
      this.broadcast({
        type: "error",
        message: "Failed to generate response"
      });
    }
  }

  async getMessages(): Promise<ChatMessage[]> {
    const list = await this.state.storage.list<ChatMessage>({
      prefix: "msg:",
      reverse: true,
      limit: 50
    });

    return Array.from(list.values()).reverse();
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.state.storage.put(`msg:${message.id}`, message);
  }

  private broadcast(data: any) {
    const json = JSON.stringify(data);
    for (const conn of this.connections) {
      try {
        conn.send(json);
      } catch (err) {
        this.connections.delete(conn);
      }
    }
  }
}
```

---

## Common Pitfalls

### ❌ Pitfall 1: Not Handling Incomplete SSE Lines

**Problem:** JSON split across chunks causes parse errors

**Solution:** Always buffer and check for complete lines

### ❌ Pitfall 2: Ignoring [DONE] Marker

**Problem:** Stream appears to hang or duplicate messages

**Solution:** Check for `[DONE]` and handle appropriately

### ❌ Pitfall 3: Sending Too Much Context

**Problem:** Slow responses or token limit errors

**Solution:** Limit message history to recent N messages

### ❌ Pitfall 4: Not Using `stream: true`

**Problem:** No streaming, buffered response only

**Solution:** Always set `stream: true` in run() options

### ❌ Pitfall 5: Poor Error Recovery

**Problem:** One error breaks entire chat

**Solution:** Implement retry logic and graceful degradation

### ❌ Pitfall 6: Memory Leaks from Unclosed Readers

**Problem:** Resources not freed properly

**Solution:** Always close readers and handle cleanup

```typescript
try {
  const reader = response.getReader();
  // ... process stream
} finally {
  reader.releaseLock(); // Important!
}
```

---

## Testing Streaming Implementations

### Unit Test Example

```typescript
import { env, createExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/worker";

describe("Streaming chat", () => {
  it("should stream tokens correctly", async () => {
    const request = new Request("http://localhost/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" })
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    expect(response.headers.get("content-type")).toBe("text/event-stream");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      if (text.includes('data:')) chunks++;
    }

    expect(chunks).toBeGreaterThan(0);
  });
});
```

---

## Additional Resources

### Official Documentation
- [Workers AI Streaming Blog Post](https://blog.cloudflare.com/workers-ai-streaming/)
- [Using AI Models in Agents](https://developers.cloudflare.com/agents/api-reference/using-ai-models/)
- [Workers AI Overview](https://developers.cloudflare.com/workers-ai/)

### Model Selection
- [Workers AI Models Catalog](https://developers.cloudflare.com/workers-ai/models/)

### Related Guides
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Agents SDK Documentation](https://developers.cloudflare.com/agents/)

---

## Quick Reference

### Minimal Streaming Example

```typescript
const stream = await env.AI.run(MODEL, { messages, stream: true });
const reader = stream.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6).trim());
      if (data.response) console.log(data.response);
    }
  }
}
```

### Recommended Models (2025)

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| `@cf/meta/llama-3-8b-instruct` | ⚡⚡⚡ | ⭐⭐ | Quick responses |
| `@cf/meta/llama-3.1-70b-instruct` | ⚡⚡ | ⭐⭐⭐ | Balanced |
| `@cf/qwen/qwen2.5-72b-instruct` | ⚡ | ⭐⭐⭐⭐ | Complex tasks |

---

**Last Updated:** January 2026
**Version:** 1.0
**Maintained By:** Your Team
