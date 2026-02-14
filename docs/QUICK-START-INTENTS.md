# Quick Start: Testing Intents

## 🚀 Run Tests

```bash
# Run CLI test suite (fast, visual)
npm run test:intents

# Run Vitest test suite (detailed)
npm test -- src/server/agents/__tests__/intent-detection.test.ts
```

## 📋 MVP Intent Quick Reference

### Contacts
```
✓ "create a contact named John Doe with email john@example.com"
✓ "add a new contact"
✓ "list all contacts"
✓ "search for contacts named Jane"
```

### Opportunities
```
✓ "create an opportunity for $50,000"
✓ "create a new deal titled Enterprise Sale"
✓ "show me the pipeline"
✓ "list all opportunities"
✓ "view opportunities in qualified stage"
✓ "move opportunity to proposal stage"
```

### Conversations - WhatsApp
```
✓ "show me whatsapp conversations"
✓ "whatsapp messages"
✓ "view whatsapp"
```

### Conversations - Facebook
```
✓ "show me facebook conversations"
✓ "facebook messages"
✓ "messenger conversations"
```

### Conversations - TikTok
```
✓ "show me tiktok leads"
✓ "tiktok messages"
✓ "view tiktok"
```

### Conversations - All Channels
```
✓ "show me all conversations"
✓ "view all messages"
✓ "show all channels"
```

### Temporal
```
✓ "what time is it"
✓ "what's the time"
✓ "current time"
```

## ✅ Current Status

- **Total Intents**: 27 test cases
- **Pass Rate**: 100%
- **Coverage**: All MVP features
- **Tools Implemented**: 12

## 🔍 Debugging

Check console logs for intent detection:

```
[ChatAgent] 🔍 Analyzing intent...
[ChatAgent] 📊 Complexity: { complexity: "simple", confidence: 0.95 }
[ChatAgent] 🛠️ Tools detected: [{ tool: "server.createContact", params: {...} }]
[ChatAgent] ⚙️ Executing 1 tool(s)...
[ToolExecutor] ✅ Tool executed: server.createContact
```

## 📖 Full Documentation

See [INTENT-DETECTION.md](./INTENT-DETECTION.md) for complete documentation.
