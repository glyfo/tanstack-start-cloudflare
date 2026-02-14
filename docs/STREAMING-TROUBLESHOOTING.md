# Workers AI Streaming - Troubleshooting Guide

> Common issues and their solutions

---

## 🔍 Symptom Index

- [No Response Received](#no-response-received)
- [Partial/Garbled Text](#partialgarbled-text)
- [Stream Hangs/Freezes](#stream-hangsfreezes)
- [Parse Errors](#parse-errors)
- [Connection Drops](#connection-drops)
- [Slow Performance](#slow-performance)
- [Memory Issues](#memory-issues)

---

## No Response Received

### Symptom
- User sends message
- "Thinking" indicator shows
- No AI response ever appears
- No errors in console

### Diagnosis

**Check 1:** Is streaming enabled?
```typescript
// ❌ WRONG
const response = await env.AI.run(MODEL, { messages });

// ✅ CORRECT
const response = await env.AI.run(MODEL, { messages, stream: true });
```

**Check 2:** Is response null?
```typescript
const response = await env.AI.run(MODEL, { messages, stream: true });

if (!response) {
  console.error("AI returned null response");
  // This is the issue!
}
```

**Check 3:** Are you reading the stream?
```typescript
// ❌ WRONG - Returns stream but never reads it
const response = await env.AI.run(MODEL, { messages, stream: true });
// ... no reader.read() calls

// ✅ CORRECT - Actually read the stream
const reader = response.getReader();
while (true) {
  const { done, value } = await reader.read();
  // ...
}
```

**Check 4:** Message format conversion
```typescript
interface AppMessage {
  id: string;
  role: string;
  content: string;
  parts: any[];
  metadata: any;
}

// ❌ WRONG - Passing full app messages
const response = await env.AI.run(MODEL, {
  messages: appMessages, // Has extra fields!
  stream: true
});

// ✅ CORRECT - Convert to AI format
const aiMessages = appMessages.map(m => ({
  role: m.role,
  content: m.content
}));

const response = await env.AI.run(MODEL, {
  messages: aiMessages,
  stream: true
});
```

### Solution
```typescript
async handleChat(userMessage: string) {
  // 1. Convert messages properly
  const history = await this.getMessages();
  const aiMessages = history.map(m => ({
    role: m.role,
    content: m.content
  }));

  // 2. Enable streaming
  const response = await this.env.AI.run(
    "@cf/meta/llama-3-8b-instruct",
    {
      messages: [
        { role: "system", content: "You are helpful." },
        ...aiMessages
      ],
      stream: true  // ← Essential!
    }
  );

  // 3. Check response
  if (!response) {
    throw new Error("AI returned null");
  }

  // 4. Read the stream
  const reader = response.getReader();
  // ... rest of implementation
}
```

---

## Partial/Garbled Text

### Symptom
- Response contains random characters: `�`
- Words are cut off mid-character
- JSON parse errors: "Unexpected token"

### Cause
Not using `TextDecoder` correctly with multi-byte UTF-8 characters.

### Diagnosis

**Check 1:** Using decoder with stream flag?
```typescript
// ❌ WRONG - Decodes each chunk independently
const decoder = new TextDecoder();
while (true) {
  const { value } = await reader.read();
  const text = decoder.decode(value); // ❌ No stream flag
  // Multi-byte chars may be split!
}

// ✅ CORRECT - Handles split characters
const decoder = new TextDecoder();
while (true) {
  const { value } = await reader.read();
  const text = decoder.decode(value, { stream: true }); // ✅
}
```

**Check 2:** Buffering incomplete SSE lines?
```typescript
// ❌ WRONG - Processes incomplete JSON
const text = decoder.decode(value, { stream: true });
const lines = text.split('\n');
for (const line of lines) {
  JSON.parse(line); // ❌ Last line may be incomplete!
}

// ✅ CORRECT - Buffer incomplete lines
let buffer = "";
// ...
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n');
buffer = lines.pop() || ""; // ✅ Keep incomplete line
```

### Solution
```typescript
const reader = response.getReader();
const decoder = new TextDecoder();
let buffer = "";  // ← Buffer for incomplete lines

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Decode with stream flag (handles split UTF-8)
  buffer += decoder.decode(value, { stream: true });

  // Split into lines
  const lines = buffer.split('\n');

  // Keep last incomplete line
  buffer = lines.pop() || "";

  // Process only complete lines
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.substring(6).trim();
      if (jsonStr && jsonStr !== '[DONE]') {
        const data = JSON.parse(jsonStr); // Now safe!
        // ...
      }
    }
  }
}
```

---

## Stream Hangs/Freezes

### Symptom
- Stream starts normally
- Stops mid-response
- No completion message
- No errors thrown

### Diagnosis

**Check 1:** Not handling [DONE] marker?
```typescript
// ❌ WRONG - May hang waiting for more data
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // No check for [DONE] marker
  const data = JSON.parse(jsonStr);
  console.log(data.response);
}

// ✅ CORRECT - Handle [DONE] marker
if (jsonStr === '[DONE]') {
  console.log('Stream complete');
  break; // or continue, depending on logic
}
```

**Check 2:** Infinite loop without exit condition?
```typescript
// ❌ WRONG - No way to exit
while (true) {
  const { value } = await reader.read(); // Missing done check!
  // ...
}

// ✅ CORRECT - Check done flag
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // ...
}
```

**Check 3:** Timeout not set?
```typescript
// ❌ WRONG - Could hang forever
const response = await env.AI.run(MODEL, { messages, stream: true });

// ✅ CORRECT - Add timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s

try {
  const response = await env.AI.run(MODEL, {
    messages,
    stream: true,
    signal: controller.signal
  });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

### Solution
```typescript
const response = await this.env.AI.run(MODEL, {
  messages,
  stream: true
});

const reader = response.getReader();
const decoder = new TextDecoder();
let buffer = "";
const timeout = setTimeout(() => {
  reader.cancel();
  throw new Error("Stream timeout");
}, 30000);

try {
  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      console.log("Stream ended naturally");
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6).trim();

        // Check for completion marker
        if (jsonStr === '[DONE]') {
          console.log("Received [DONE] marker");
          return; // Exit function
        }

        if (!jsonStr) continue;

        const data = JSON.parse(jsonStr);
        if (data.response) {
          // Process token
        }
      }
    }
  }
} finally {
  clearTimeout(timeout);
}
```

---

## Parse Errors

### Symptom
- `SyntaxError: Unexpected token`
- `SyntaxError: Unexpected end of JSON input`
- Stream works but logs JSON parse errors

### Diagnosis

**Check 1:** Parsing incomplete JSON?
```typescript
// ❌ WRONG - May try to parse incomplete JSON
const lines = text.split('\n');
for (const line of lines) {
  if (line.startsWith('data: ')) {
    JSON.parse(line.substring(6)); // ❌ Last line incomplete!
  }
}

// ✅ CORRECT - Buffer incomplete lines
let buffer = "";
buffer += text;
const lines = buffer.split('\n');
buffer = lines.pop() || ""; // ✅
```

**Check 2:** Not checking for [DONE] before parsing?
```typescript
// ❌ WRONG - [DONE] is not valid JSON
const data = JSON.parse(jsonStr); // ❌ Fails on "[DONE]"

// ✅ CORRECT - Check first
if (jsonStr === '[DONE]') continue;
const data = JSON.parse(jsonStr);
```

**Check 3:** Not checking for empty strings?
```typescript
// ❌ WRONG - Empty string is not valid JSON
const data = JSON.parse(jsonStr); // ❌ Fails on ""

// ✅ CORRECT - Validate first
if (!jsonStr || jsonStr.trim() === '') continue;
const data = JSON.parse(jsonStr);
```

**Check 4:** Not using try-catch?
```typescript
// ❌ WRONG - Unhandled parse error breaks stream
const data = JSON.parse(jsonStr);

// ✅ CORRECT - Handle gracefully
try {
  const data = JSON.parse(jsonStr);
  // Process data
} catch (err) {
  console.warn('Parse error, skipping:', err);
  // Continue processing other chunks
}
```

### Solution
```typescript
for (const line of lines) {
  if (line.startsWith('data: ')) {
    const jsonStr = line.substring(6).trim();

    // Skip [DONE] marker
    if (jsonStr === '[DONE]') {
      console.log('Stream complete');
      continue;
    }

    // Skip empty strings
    if (!jsonStr) continue;

    // Safe parse with error handling
    try {
      const data = JSON.parse(jsonStr);

      if (data.response) {
        // Process token
        responseText += data.response;
      } else if (data.error) {
        console.error('AI error:', data.error);
        throw new Error(data.error);
      }
    } catch (parseErr) {
      console.warn('Failed to parse SSE line:', line, parseErr);
      // Don't break - continue processing other chunks
    }
  }
}
```

---

## Connection Drops

### Symptom
- Stream starts successfully
- Suddenly disconnects mid-response
- WebSocket closes unexpectedly

### Diagnosis

**Check 1:** Worker timeout?
```typescript
// Workers have execution time limits
// Use ExecutionContext to extend

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    // ❌ WRONG - May timeout
    return handleStream(req, env);

    // ✅ CORRECT - Keep worker alive
    const response = handleStream(req, env);
    ctx.waitUntil(response);
    return response;
  }
};
```

**Check 2:** Durable Object hibernation?
```typescript
// Agents may hibernate during long operations

class ChatAgent extends Agent {
  async handleChat(message: string) {
    // ❌ WRONG - May hibernate during streaming
    const response = await this.env.AI.run(...);

    // ✅ CORRECT - Keep DO alive
    this.state.blockConcurrencyWhile(async () => {
      const response = await this.env.AI.run(...);
      // Process stream
    });
  }
}
```

**Check 3:** Client timeout?
```typescript
// Client-side EventSource has timeout

// ❌ WRONG - Default timeout may be too short
const source = new EventSource('/chat');

// ✅ CORRECT - Handle reconnection
const source = new EventSource('/chat');
source.onerror = (err) => {
  console.error('Connection lost, retrying...');
  // Implement exponential backoff
};
```

### Solution

**Server-side:**
```typescript
class ChatAgent extends Agent {
  async handleChat(connection: Connection, message: string) {
    // Prevent hibernation during streaming
    await this.state.blockConcurrencyWhile(async () => {
      try {
        const response = await this.env.AI.run(MODEL, {
          messages,
          stream: true
        });

        const reader = response.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Send heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
          connection.send(JSON.stringify({ type: "heartbeat" }));
        }, 15000);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Process stream...
            buffer += decoder.decode(value, { stream: true });
            // ... rest of logic
          }
        } finally {
          clearInterval(heartbeat);
        }

      } catch (error) {
        console.error('Stream error:', error);
        connection.send(JSON.stringify({
          type: "error",
          message: "Connection lost"
        }));
      }
    });
  }
}
```

**Client-side:**
```typescript
class WebSocketClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const ws = new WebSocket(this.url);

    ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms...`);

        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "heartbeat") {
        // Connection still alive
        return;
      }

      // Handle normal messages
      this.handleMessage(data);
    };
  }
}
```

---

## Slow Performance

### Symptom
- Response takes very long to complete
- Visible lag between tokens
- High CPU usage

### Diagnosis

**Check 1:** Sending too much context?
```typescript
// ❌ WRONG - Sending entire history (100+ messages)
const response = await env.AI.run(MODEL, {
  messages: allMessages, // Too much!
  stream: true
});

// ✅ CORRECT - Limit context
const recentMessages = allMessages.slice(-20);
const response = await env.AI.run(MODEL, {
  messages: recentMessages,
  stream: true
});
```

**Check 2:** Wrong model for task?
```typescript
// ❌ WRONG - Using slow model for simple query
const response = await env.AI.run(
  "@cf/qwen/qwen2.5-72b-instruct", // Powerful but slow
  { messages, stream: true }
);

// ✅ CORRECT - Match model to complexity
const model = query.length > 500
  ? "@cf/qwen/qwen2.5-72b-instruct"
  : "@cf/meta/llama-3-8b-instruct";
```

**Check 3:** Broadcasting every single token?
```typescript
// ❌ WRONG - Too many WebSocket sends
if (data.response) {
  connection.send(JSON.stringify({
    type: "chunk",
    text: data.response // Single token
  }));
}

// ✅ CORRECT - Batch tokens
let buffer = "";
let lastSend = Date.now();

if (data.response) {
  buffer += data.response;

  if (Date.now() - lastSend > 50 || buffer.length > 20) {
    connection.send(JSON.stringify({
      type: "chunk",
      text: buffer
    }));
    buffer = "";
    lastSend = Date.now();
  }
}
```

### Solution
```typescript
async handleChat(message: string) {
  // 1. Limit context
  const allMessages = await this.getMessages();
  const recentMessages = allMessages.slice(-20);

  // 2. Choose appropriate model
  const model = message.length > 500
    ? "@cf/qwen/qwen2.5-72b-instruct"
    : "@cf/meta/llama-3-8b-instruct";

  // 3. Batch broadcasting
  let chunkBuffer = "";
  let lastBroadcast = Date.now();
  const BATCH_INTERVAL = 50; // ms
  const BATCH_SIZE = 20; // chars

  const response = await this.env.AI.run(model, {
    messages: recentMessages,
    stream: true
  });

  // ... stream reading loop

  if (data.response) {
    chunkBuffer += data.response;

    if (Date.now() - lastBroadcast > BATCH_INTERVAL ||
        chunkBuffer.length >= BATCH_SIZE) {
      this.broadcast({
        type: "chunk",
        text: chunkBuffer
      });
      chunkBuffer = "";
      lastBroadcast = Date.now();
    }
  }

  // Send remaining buffer
  if (chunkBuffer) {
    this.broadcast({ type: "chunk", text: chunkBuffer });
  }
}
```

---

## Memory Issues

### Symptom
- Worker crashes with "out of memory"
- Increasing memory usage over time
- Browser becomes unresponsive

### Diagnosis

**Check 1:** Not releasing reader lock?
```typescript
// ❌ WRONG - Reader not released
const reader = response.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // ... process
}
// Reader still locked!

// ✅ CORRECT - Release lock
try {
  const reader = response.getReader();
  // ... process stream
} finally {
  reader.releaseLock();
}
```

**Check 2:** Storing all chunks in memory?
```typescript
// ❌ WRONG - Grows indefinitely
const allChunks: string[] = [];
if (data.response) {
  allChunks.push(data.response); // Memory leak!
}

// ✅ CORRECT - Stream to storage/client immediately
if (data.response) {
  await this.saveChunk(data.response); // Persist
  this.broadcast({ chunk: data.response }); // Send
  // Don't keep in memory
}
```

**Check 3:** Not cleaning up connections?
```typescript
// ❌ WRONG - Dead connections accumulate
class ChatAgent extends Agent {
  connections: Set<Connection> = new Set();

  broadcast(msg: any) {
    for (const conn of this.connections) {
      conn.send(msg); // May fail on closed connection
    }
  }
}

// ✅ CORRECT - Remove dead connections
broadcast(msg: any) {
  for (const conn of this.connections) {
    try {
      conn.send(msg);
    } catch (err) {
      this.connections.delete(conn); // Clean up
    }
  }
}
```

### Solution
```typescript
async handleChat(message: string) {
  let reader: ReadableStreamDefaultReader | null = null;

  try {
    const response = await this.env.AI.run(MODEL, {
      messages,
      stream: true
    });

    reader = response.getReader();
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
            // Don't accumulate - broadcast immediately
            this.broadcastSafe({
              type: "chunk",
              text: data.response
            });

            // Optional: Persist to storage (not memory)
            await this.appendToMessage(data.response);
          }
        }
      }
    }

  } catch (error) {
    console.error('Stream error:', error);
  } finally {
    // Always release resources
    if (reader) {
      try {
        reader.releaseLock();
      } catch (e) {
        // Already released
      }
    }
  }
}

// Safe broadcast that removes dead connections
broadcastSafe(msg: any) {
  const json = JSON.stringify(msg);
  const deadConnections: Connection[] = [];

  for (const conn of this.connections) {
    try {
      conn.send(json);
    } catch (err) {
      deadConnections.push(conn);
    }
  }

  // Clean up
  for (const conn of deadConnections) {
    this.connections.delete(conn);
  }
}
```

---

## Quick Diagnostic Checklist

Run through this checklist when debugging:

- [ ] `stream: true` is set in `env.AI.run()`
- [ ] Response is not null/undefined
- [ ] Using `TextDecoder` with `{ stream: true }` flag
- [ ] Buffering incomplete SSE lines (`.pop()` pattern)
- [ ] Checking for `[DONE]` before parsing JSON
- [ ] Checking for empty strings before parsing
- [ ] Using try-catch around JSON.parse
- [ ] Checking `done` flag in read loop
- [ ] Releasing reader lock in finally block
- [ ] Broadcasting/processing chunks immediately (not accumulating)
- [ ] Removing dead WebSocket connections
- [ ] Limiting message history context
- [ ] Using appropriate model for task
- [ ] Setting timeouts for long operations

---

## Getting Help

If issues persist:

1. **Enable verbose logging:**
   ```typescript
   console.log('[DEBUG] Messages:', messages.length);
   console.log('[DEBUG] Stream response:', response);
   console.log('[DEBUG] Chunk received:', chunk);
   ```

2. **Check Cloudflare dashboard:**
   - Workers Analytics
   - Error logs
   - Performance metrics

3. **Isolate the problem:**
   - Test with minimal message history
   - Try different models
   - Test in local dev vs production

4. **Review documentation:**
   - [Workers AI Streaming Blog](https://blog.cloudflare.com/workers-ai-streaming/)
   - [Full Implementation Guide](./WORKERS-AI-STREAMING-GUIDE.md)
   - [Quick Reference](./STREAMING-QUICK-REFERENCE.md)

---

**Last Updated:** January 2026
