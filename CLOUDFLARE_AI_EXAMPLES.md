# Cloudflare Workers AI - Examples & Troubleshooting

## API Response Examples

### Successful Streaming Response

**Request:**

```bash
curl -X POST https://api.cloudflare.com/client/v4/accounts/ABC123/ai/run/@cf/meta/llama-2-7b-chat-int8 \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is machine learning?", "stream": true}'
```

**Response (Streaming):**

```
[STREAM] Machine learning is...
[STREAM] a subset of artificial intelligence...
[STREAM] that enables computers to learn...
[STREAM] from data without being explicitly...
[STREAM] programmed. It uses algorithms...
[STREAM] to identify patterns in datasets...
[END]
```

### Non-Streaming Response

**Response:**

```json
{
  "success": true,
  "errors": [],
  "messages": [],
  "result": {
    "response": "Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed..."
  }
}
```

## Error Responses

### Error 1: Invalid API Token

**Response:**

```json
{
  "success": false,
  "errors": [
    {
      "code": 10000,
      "message": "Authentication error"
    }
  ]
}
```

**Fix:**

- Verify token in `.env.local`
- Check token hasn't expired
- Regenerate token if needed

### Error 2: Account Not Found

**Response:**

```json
{
  "success": false,
  "errors": [
    {
      "code": 7003,
      "message": "Could not route to/load Durable Object"
    }
  ]
}
```

**Fix:**

- Verify correct Account ID
- Check Workers AI is enabled on account
- Ensure account has AI credits

### Error 3: Rate Limit Exceeded

**Response:**

```
HTTP 429 Too Many Requests

{
  "success": false,
  "errors": [
    {
      "code": 10043,
      "message": "Rate limit exceeded"
    }
  ]
}
```

**Fix:**

- Wait before making next request
- Implement exponential backoff
- Check usage on dashboard

## Console Debugging

### Enable Debug Logging

Add this to your Chat component temporarily:

```typescript
const { stream } = useAIStream();

// Add this before calling stream
const debugStream = async (prompt: string) => {
  console.log("[DEBUG] Starting stream with prompt:", prompt);

  try {
    await stream(prompt, (chunk: string) => {
      console.log("[DEBUG] Chunk received:", {
        length: chunk.length,
        preview: chunk.substring(0, 50) + "...",
        timestamp: new Date().toISOString(),
      });
    });
    console.log("[DEBUG] Stream completed");
  } catch (error) {
    console.error("[DEBUG] Stream error:", error);
  }
};
```

### Network Tab Analysis

1. Open DevTools → Network tab
2. Send a message
3. Look for request to:
   ```
   api.cloudflare.com/client/v4/accounts/...
   ```
4. Check:
   - **Status**: Should be 200 for success
   - **Headers**: Authorization header present?
   - **Response**: Valid JSON or streaming chunks?
   - **Timing**: How long did it take?

## Testing Checklist

- [ ] `.env.local` file created with credentials
- [ ] Environment variables set: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- [ ] Dev server restarted after adding env vars
- [ ] Chat component loads without errors
- [ ] Can type message in input
- [ ] Send button enabled and clickable
- [ ] Message appears in chat immediately
- [ ] Typing indicator shows briefly
- [ ] Response streams in real-time
- [ ] No errors in browser console
- [ ] No errors in server logs

## Monitoring Tools

### Browser DevTools

```javascript
// In console, run:
localStorage.getItem("ai_debug_mode");
localStorage.setItem("ai_debug_mode", "true");
```

### API Response Inspector

Check what the server is receiving:

```typescript
// In src/server/ai.ts, add logging:
console.log("[AI] Request payload:", { prompt, stream: true });
console.log("[AI] Response status:", response.status);
console.log("[AI] Response ok:", response.ok);
```

### Performance Monitoring

Track response times:

```typescript
const startTime = performance.now();

await stream(prompt, (chunk) => {
  const elapsed = performance.now() - startTime;
  console.log(`[PERF] Chunk received at ${elapsed.toFixed(0)}ms`);
});
```

## Common Prompt Examples

### 1. Business Analysis

```
"Analyze my Q4 sales data: Total: $150K, Growth: +25%, Top product: Widget Pro"
```

Expected: Professional business analysis

### 2. Task Breakdown

```
"Help me break down: Building a customer portal"
```

Expected: Step-by-step planning

### 3. Quick Questions

```
"What are the best practices for API design?"
```

Expected: Concise, practical advice

### 4. Writing Assistant

```
"Improve this email subject: New product release happening soon"
```

Expected: Better, more engaging subject

### 5. Code Help

```
"Show me how to implement caching in TypeScript"
```

Expected: Code examples with explanation

## Performance Metrics

### Typical Response Times

| Scenario                 | Time               |
| ------------------------ | ------------------ |
| First token (cold start) | 1-2s               |
| Mid-response             | 0.1-0.5s per chunk |
| Full short response      | 2-5s               |
| Full long response       | 5-15s              |
| Rate limited             | 429 error          |

### Optimization Strategies

1. **Pre-warm** with simple requests on app start
2. **Queue requests** if user sends multiple quickly
3. **Debounce** rapid send button clicks
4. **Cache** common queries
5. **Batch** requests when possible

## Debugging Flowchart

```
No response appearing?
    ↓
Check console for errors
    ├─ "Missing credentials" → Check .env.local
    ├─ "Unauthorized" → Check token
    ├─ "Network error" → Check internet
    └─ Other error → See error table
    ↓
Check DevTools Network tab
    ├─ No request → Check handleSubmit called
    ├─ 400 error → Check request format
    ├─ 401 error → Check auth header
    ├─ 429 error → Rate limited, wait
    └─ 200 OK → Check response streaming
    ↓
Check Chat component state
    ├─ isStreaming true? → Waiting for response
    ├─ streamingContent empty? → Check onChunk callback
    └─ messages array? → Check setMessages called
    ↓
Check Cloudflare Dashboard
    ├─ Account enabled? → Check Settings
    ├─ API token valid? → Check expiry
    ├─ Usage quota? → Check billing
    └─ Status page? → Check outages
```

## Live Debugging

### Monitor All API Calls

```typescript
// Add to Chat.tsx temporarily
useEffect(() => {
  window.addEventListener("fetch", (e: any) => {
    if (e.request?.url.includes("cloudflare")) {
      console.log("[API CALL]", e.request);
    }
  });
}, []);
```

### Stream State Inspector

```typescript
// In Chat component
const { stream, isLoading, response, error } = useAIStream();

useEffect(() => {
  console.log({
    isLoading,
    responseLength: response.length,
    error,
    streamingContentLength: streamingContent.length,
  });
}, [isLoading, response, error, streamingContent]);
```

## Success Indicators

✅ **All working when you see:**

1. Message sent displays immediately
2. "Analyzing..." briefly shows (if typing indicator exists)
3. Response starts appearing character by character
4. Full response appears in chat bubble
5. No errors in console
6. Send button re-enables after response

## Support Channels

If issues persist:

1. **Check Status**: https://www.cloudflarestatus.com/
2. **API Docs**: https://developers.cloudflare.com/api/
3. **Community**: https://community.cloudflare.com/
4. **Support**: Contact Cloudflare support with request ID from headers

## Recording Session for Support

To help debug, capture:

1. Full error message from console
2. Screenshot of Network tab response
3. Your request parameters (sanitize token)
4. Browser and OS version
5. Cloudflare account region
6. Steps to reproduce

Example:

```
Error: "Unauthorized"
Browser: Chrome 120.0
OS: macOS 14
Account Region: US
Request: POST /ai/run/@cf/meta/llama-2-7b-chat-int8
Status: 401
Response: {"success":false,"errors":[{"code":10000}]}
```

This helps Cloudflare support resolve issues quickly!
