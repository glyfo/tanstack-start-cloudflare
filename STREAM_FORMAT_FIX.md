# Stream Format Fix - December 19, 2025

## Issue

The WebSocket streaming format was incorrect, containing unwanted metadata fields from the Cloudflare AI SSE response:

```
data: {"response":" v","p":"abcdefghijklmnopqrstuvwxyz0123456789abcdefghijkl"}
```

The `"p"` field (metadata) was being passed through to clients along with the actual response text.

## Solution

### 1. **Added SSE Parser** (`parseSSEStream` method)

- Properly parses Server-Sent Events (SSE) format from Cloudflare AI
- Handles the `data: ` prefix correctly
- Extracts **only** the `response` field from each chunk
- Ignores metadata fields like `"p"`
- Detects and stops at `[DONE]` signal

**Location**: [src/server/agent-chat.ts](src/server/agent-chat.ts#L65-L115)

### 2. **Updated Message Streaming**

Changed from handling raw chunks to using the SSE parser:

```typescript
// Before: Raw chunk handling with multiple format checks
for await (const chunk of response as AsyncIterable<any>) {
  // Complex format detection
}

// After: Clean SSE parsing
for await (const chunkText of this.parseSSEStream(response)) {
  if (chunkText && typeof chunkText === "string" && chunkText.length > 0) {
    // Send clean chunks to client
  }
}
```

**Location**: [src/server/agent-chat.ts](src/server/agent-chat.ts#L264-L286)

### 3. **Clean Client Format**

Server now sends to clients:

```json
{
  "type": "message_stream",
  "id": "msg-uuid",
  "chunk": "actual response text",
  "role": "assistant"
}
```

No extraneous metadata fields.

## Files Modified

- [src/server/agent-chat.ts](src/server/agent-chat.ts)

## Benefits

✅ Cleaner streaming format  
✅ Proper SSE parsing  
✅ No metadata leakage  
✅ Better UI rendering  
✅ Reduced network payload

## Testing

Test the streaming by sending a chat message through the UI and verifying:

1. Browser console shows clean chunk format
2. WebSocket messages don't include `"p"` field
3. Text displays correctly without metadata artifacts
