# Quick Start Guide - Cloudflare Workers AI

## Step 1: Get Your Credentials

### From Cloudflare Dashboard:

1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to **Settings → API tokens**
4. Click **Create Token**
5. Choose **Custom token** template
6. Set permissions:
   - **Account Resources**: Account AI → Read
   - **TTL**: 1 year or your preferred duration
7. Create and copy the token
8. Also copy your Account ID from the dashboard URL or sidebar

## Step 2: Set Environment Variables

Create a `.env.local` file in the project root:

```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
```

⚠️ **IMPORTANT**: Never commit this file to git. Add to `.gitignore`:

```
.env.local
.env
```

## Step 3: Verify Setup

Run the development server:

```bash
npm run dev
```

Test the chat:

1. Open http://localhost:3000/chat
2. Type a message
3. You should see:
   - Message appears in chat
   - Typing indicator shows
   - Response streams in real-time
   - No errors in console

## Step 4: Common Issues

### Issue: "Missing Cloudflare credentials"

**Solution**:

- Check `.env.local` file exists
- Verify variable names are exact: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
- Restart dev server after adding env vars

### Issue: "Unauthorized" error

**Solution**:

- Verify token has `Account.AI` permission
- Check token hasn't expired
- Generate a new token if needed

### Issue: Slow responses

**Solution**:

- Check network speed
- Verify Cloudflare status page for outages
- Try with shorter prompts first

## Step 5: Files Modified/Created

### New Files:

- `src/server/ai.ts` - Cloudflare AI server functions
- `src/hooks/useAI.ts` - React hooks for AI integration
- `CLOUDFLARE_AI_INTEGRATION.md` - Full documentation

### Modified Files:

- `src/components/Chat.tsx` - Integrated AI streaming

## Step 6: How It Works

```
Your Message
    ↓
ChatInput → Chat Component
    ↓
useAIStream Hook (from useAI.ts)
    ↓
streamAIResponse Server Function (from server/ai.ts)
    ↓
Cloudflare Workers AI API
    ↓
Streaming Response (Real-time)
    ↓
Display in Chat
```

## Step 7: Next Steps

Once working, you can:

1. **Customize the model** - Try different AI models:

   ```typescript
   // In src/server/ai.ts, change the model URL:
   `@cf/mistral/mistral-7b-instruct-v0.1`; // Alternative model
   ```

2. **Add system prompt** - Send context about the user:

   ```typescript
   const systemPrompt = "You are a helpful productivity assistant...";
   const fullPrompt = systemPrompt + "\n\n" + userPrompt;
   ```

3. **Cache responses** - Store common responses locally

4. **Add prompt templates** - Use predefined prompts from EXPLORE suggestions

5. **Monitor usage** - Track API calls in Cloudflare dashboard

## Available AI Models

- `@cf/meta/llama-2-7b-chat-int8` ✅ (Currently used - General purpose)
- `@cf/mistral/mistral-7b-instruct-v0.1` (Instruction-following)
- `@cf/stabilityai/stable-diffusion-xl-base-1.0` (Image generation)
- `@cf/huggingface/summarization` (Text summarization)
- And more in Cloudflare documentation

## Support & Documentation

- **Full Documentation**: See `CLOUDFLARE_AI_INTEGRATION.md`
- **Cloudflare Docs**: https://developers.cloudflare.com/workers-ai/
- **API Reference**: https://developers.cloudflare.com/api/

## Testing with curl

Test the API directly:

```bash
curl -X POST \
  https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/run/@cf/meta/llama-2-7b-chat-int8 \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello, how are you?"}'
```

## Performance Tips

1. Keep prompts concise for faster responses
2. Use specific, clear language
3. Batch similar requests when possible
4. Monitor usage in Cloudflare dashboard
5. Implement caching for repeated queries

## Security Reminders

✅ **DO:**

- Use environment variables for secrets
- Keep tokens secure and rotated
- Validate user input before sending
- Monitor API usage for abuse

❌ **DON'T:**

- Commit API tokens to git
- Expose tokens in client-side code
- Share tokens with untrusted parties
- Use unlimited rate limits

Enjoy using Cloudflare Workers AI! 🚀
