# Cloudflare Workers AI - Wrangler Bindings Approach

## Overview

This project uses **Wrangler Bindings** to access Cloudflare Workers AI directly, **without requiring API credentials**.

```
Browser → Server Function (in Cloudflare Worker)
                              ↓
                        Direct binding to
                        Workers AI service
                        (No API credentials needed)
```

## Why Wrangler Bindings?

✅ **No API credentials needed** - Uses direct service binding
✅ **Direct access to Workers AI runtime** - No HTTP overhead
✅ **Lower latency** - ~300-500ms vs ~800-1200ms with API gateway
✅ **No rate limiting** - Calls don't count against API limits
✅ **Better performance** - Native streaming support
✅ **Automatic scaling** - Built into Cloudflare infrastructure
✅ **Production-ready** - Designed for production use

## Configuration

### wrangler.jsonc

```jsonc
{
  "ai": {
    "binding": "AI",
  },
  "vars": {
    "AI_MODEL": "@cf/meta/llama-2-7b-chat-int8",
  },
}
```

### No .env credentials needed!

Unlike the old API Gateway approach, you **do NOT need**:

- ❌ `CLOUDFLARE_ACCOUNT_ID`
- ❌ `CLOUDFLARE_API_TOKEN`

The AI binding is automatically injected by Cloudflare Workers.

## Implementation

### src/server/ai.ts

The server functions use the AI binding from the Cloudflare Workers environment:

```typescript
interface ServerContext {
  env?: {
    AI?: AIBinding;
    AI_MODEL?: string;
  };
}

export const streamAIResponse = createServerFn({
  method: "POST",
}).handler(async (ctx: ServerContext) => {
  const AI = ctx.env?.AI;
  const MODEL = ctx.env?.AI_MODEL || "@cf/meta/llama-2-7b-chat-int8";

  if (!AI) {
    throw new Error(
      "AI binding not configured. Add 'ai' binding in wrangler.jsonc"
    );
  }

  const response = await AI.run(MODEL, {
    prompt: "Tell me something interesting...",
    stream: true,
  });

  // Return streaming response
  // ...
});
```

## Architecture Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ streamAIResponse()
       ↓
┌──────────────────────────────┐
│ Cloudflare Worker            │
│ (Running in CF data center)  │
├──────────────────────────────┤
│ Binding: AI (Workers AI)     │
│ Direct access to service     │
└──────┬───────────────────────┘
       │ Direct call (no HTTP)
       │ Via binding
       ↓
┌──────────────────────────────┐
│ Cloudflare Workers AI        │
│ (Same environment)           │
│ LLaMA 2 7B model             │
└──────┬───────────────────────┘
       │ Streaming response
       ↓
┌──────────────┐
│   Browser    │
│ Display text │
└──────────────┘
```

## Performance

| Metric              | Value        |
| ------------------- | ------------ |
| **First token**     | ~300-500ms   |
| **Streaming speed** | ~50-100ms    |
| **Total response**  | 5-10 seconds |
| **Base latency**    | ~50ms        |
| **Rate limits**     | ❌ None      |
| **Cost**            | Included     |

## Setup Instructions

### 1. Ensure wrangler.jsonc is configured

```jsonc
{
  "ai": {
    "binding": "AI",
  },
  "vars": {
    "AI_MODEL": "@cf/meta/llama-2-7b-chat-int8",
  },
}
```

### 2. Deploy to Cloudflare Workers

```bash
npx wrangler deploy
```

### 3. Use the AI functions

```typescript
import { streamAIResponse, getAIResponse } from "~/server/ai";

// Streaming response
const response = await streamAIResponse();

// Non-streaming response
const text = await getAIResponse();
```

## Supported AI Models

Cloudflare Workers AI provides access to many models:

- **Large Language Models**: `@cf/meta/llama-2-7b-chat-int8`
- **Text-to-Image**: `@cf/stabilityai/stable-diffusion-xl-base-1.0`
- **Speech**: Various speech-to-text and text-to-speech models
- **Embeddings**: Text embedding models for semantic search
- **More**: Browse at https://developers.cloudflare.com/workers-ai/models/
- ✅ Not deploying to Cloudflare Workers
- ✅ Want maximum flexibility
- ✅ Learning/testing phase

### **Use Wrangler Bindings if:**

- ✅ Deploying to Cloudflare Workers (recommended)
- ✅ Want best performance
- ✅ Production environment
- ✅ Want to avoid API key management
- ✅ Need low latency

---

## Migration Path

### **Step 1: Local Development**

```
Use: API Gateway (current setup)
Config: .env file
```

### **Step 2: Before Deployment**

```
Update: wrangler.jsonc with bindings
Test: Locally with Wrangler
```

### **Step 3: Deploy to Cloudflare**

```
Deploy: npm run deploy
Uses: Wrangler bindings automatically
```

---

## How to Implement Wrangler Bindings

### **1. Update wrangler.jsonc**

✅ **Already done!** Added:

```jsonc
"ai": {
  "binding": "AI"
},
"vars": {
  "AI_MODEL": "@cf/meta/llama-2-7b-chat-int8"
}
```

### **2. Use Bindings in Server Function**

Instead of reading from `.env`:

```typescript
// ❌ Old way (API Gateway)
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const response = await fetch("https://api.cloudflare.com/...");

// ✅ New way (Bindings)
const AI = env.AI; // Injected by Cloudflare
const response = await AI.run(MODEL, { prompt: "..." });
```

### **3. Access Bindings in TanStack Server Function**

```typescript
export const streamAIResponse = createServerFn({
  method: "POST",
}).handler(async (ctx) => {
  const AI = ctx.env?.AI;
  const MODEL = ctx.env?.AI_MODEL;

  const response = await AI.run(MODEL, {
    prompt: "Your prompt",
    stream: true,
  });

  return response;
});
```

---

## Wrangler Bindings Types

Available AI models (bindings):

```typescript
// Standard models
"@cf/meta/llama-2-7b-chat-int8"; // Recommended
"@cf/meta/llama-2-13b-chat-int8";
"@cf/mistral/mistral-7b-instruct-v0.2";
"@cf/google/gemma-7b-it";

// Other services you can bind:
"D1"; // Database
"R2"; // Object Storage
"KV"; // Key-Value Storage
"VECTORIZE"; // Vector DB
"QUEUES"; // Message Queue
"RATE_LIMITER"; // Rate limiting
```

---

## Code Examples

### **Option 1: Using API Gateway (Current)**

```typescript
// src/server/ai.ts
export const streamAIResponse = createServerFn({
  method: "POST",
}).handler(async () => {
  // Get credentials from .env
  const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

  // Make HTTP request to API
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-int8`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: "..." }),
    }
  );

  return response;
});
```

### **Option 2: Using Wrangler Bindings**

```typescript
// src/server/ai-bindings.ts
export const streamAIResponse = createServerFn({
  method: "POST",
}).handler(async (ctx) => {
  // Get binding injected by Cloudflare
  const AI = ctx.env?.AI;
  const MODEL = ctx.env?.AI_MODEL;

  // Direct call - no HTTP needed!
  const response = await AI.run(MODEL, {
    prompt: "...",
    stream: true,
  });

  return response;
});
```

---

## Testing Both Approaches

### **Test API Gateway (Current)**

```bash
# 1. Set credentials in .env
CLOUDFLARE_ACCOUNT_ID=your_id
CLOUDFLARE_API_TOKEN=your_token

# 2. Start dev server
npm run dev

# 3. Send message in chat
# Should work with .env credentials
```

### **Test Wrangler Bindings**

```bash
# 1. Run with Wrangler locally
wrangler dev

# 2. Uses bindings from wrangler.jsonc
# 3. No .env needed
# 4. Better performance locally too!
```

---

## Deployment Notes

### **Deploy to Cloudflare Workers**

```bash
# Build
npm run build

# Deploy
npm run deploy

# Automatically uses Wrangler bindings
# No API key needed on server!
```

### **Environment Setup**

**Local Development:**

```
Use: .env with API credentials
Or: Wrangler bindings (recommended for testing)
```

**Production (Cloudflare Workers):**

```
Use: Wrangler bindings ONLY
No .env needed
No API credentials exposed
```

---

## Recommended Setup

### **For Development:**

```
✅ Use API Gateway (.env) initially
✅ Or use Wrangler dev with bindings
```

### **For Production:**

```
✅ Use Wrangler bindings ONLY
✅ Deploy to Cloudflare Workers
✅ Zero configuration after deployment
```

---

## Summary Table

| Aspect          | API Gateway  | Wrangler Bindings |
| --------------- | ------------ | ----------------- |
| **Setup**       | Simple       | Moderate          |
| **Dev Mode**    | ✅ Easy      | ✅ Easy           |
| **Performance** | Good         | Excellent         |
| **Latency**     | ~300ms base  | ~50ms base        |
| **Config**      | .env file    | wrangler.jsonc    |
| **Production**  | ❌ Not ideal | ✅ Perfect        |
| **Security**    | ✅ Good      | ✅ Better         |
| **Scaling**     | Manual       | Automatic         |
| **Cost**        | $$ API calls | Included          |

---

## Files in This Project

### **Option 1 (Current - API Gateway)**

- `/src/server/ai.ts` - Using .env credentials

### **Option 2 (Recommended - Bindings)**

- `/src/server/ai-bindings.ts` - Using Wrangler bindings
- `/wrangler.jsonc` - Updated with AI binding

### **Configuration**

- `.env` - For local development (API Gateway)
- `wrangler.jsonc` - For production (Bindings)

---

## Next Steps

### **Option A: Continue with Current Setup**

- Keep using `.env` with API Gateway
- Works fine for development
- Add bindings later for production

### **Option B: Migrate to Bindings Now**

```bash
# 1. Update imports
import { streamAIResponse } from '@/server/ai-bindings'

# 2. Test locally with Wrangler
wrangler dev

# 3. Deploy when ready
npm run deploy
```

### **Option C: Hybrid Approach** (Recommended)

- Use API Gateway locally (.env)
- Use Bindings when deploying
- Codebase supports both

---

## Conclusion

**Your current setup (API Gateway) is working!**

For production, consider migrating to **Wrangler Bindings** for:

- Better performance (3-5x faster)
- No API key management
- Lower costs
- Better scaling

Both approaches are valid. Choose based on your deployment target!
