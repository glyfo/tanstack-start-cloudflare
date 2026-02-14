# Intent Detection & Tool Coverage

This document provides a comprehensive overview of all supported intents in the MVP and how they are detected and executed.

## 🎯 Overview

The system uses LLM-based intent detection to identify user requests and map them to appropriate tools. All queries are analyzed in real-time to determine:

1. **Complexity** - Simple vs complex multi-step workflows
2. **Tool Requirements** - Which tools are needed to fulfill the request
3. **Parameter Extraction** - Extracting values from natural language

## 🛠️ Tool Categories

### 1. Contact Management

Manage customer and lead contacts in the CRM.

| Intent | Example Queries | Tool | Parameters |
|--------|----------------|------|------------|
| **Create Contact** | "create a contact named John Doe with email john@example.com"<br>"add a new contact"<br>"new contact John" | `server.createContact` | `name`, `email`, `company` (optional) |
| **List Contacts** | "list all contacts"<br>"show me my contacts"<br>"get contacts" | `server.listContacts` | `limit` (default: 10) |
| **Search Contacts** | "search for contacts named Jane"<br>"find contact john@example.com"<br>"search contacts" | `server.searchContacts` | `query` |

### 2. Opportunity & Pipeline Management

Track sales opportunities through your pipeline.

| Intent | Example Queries | Tool | Parameters |
|--------|----------------|------|------------|
| **Create Opportunity** | "create an opportunity for $50,000"<br>"new deal titled Enterprise Sale"<br>"add an opportunity" | `server.createOpportunity` | `title`, `dealValue`, `contactId` (optional), `stage` (default: "lead") |
| **List Opportunities** | "show me the pipeline"<br>"list all opportunities"<br>"view opportunities in qualified stage" | `server.listOpportunities` | `stage` (optional: "lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost", "all"), `limit` (default: 10) |
| **Update Stage** | "move opportunity to proposal stage"<br>"advance deal to negotiation"<br>"update opportunity stage" | `server.updateOpportunityStage` | `opportunityId`, `stage` |

### 3. Multi-Channel Conversations

View conversations across WhatsApp, Facebook, and TikTok.

| Intent | Example Queries | Tool | Parameters |
|--------|----------------|------|------------|
| **WhatsApp** | "show me whatsapp conversations"<br>"whatsapp messages"<br>"view whatsapp" | `server.getWhatsAppConversations` | `limit` (default: 10) |
| **Facebook** | "show me facebook conversations"<br>"facebook messages"<br>"messenger conversations" | `server.getFacebookConversations` | `limit` (default: 10) |
| **TikTok** | "show me tiktok leads"<br>"tiktok messages"<br>"view tiktok" | `server.getTikTokLeads` | `limit` (default: 10) |
| **All Channels** | "show me all conversations"<br>"view all messages"<br>"show all channels" | `server.getAllConversations` | `limit` (default: 10) |

### 4. Temporal Queries

Get current time and date information.

| Intent | Example Queries | Tool | Parameters |
|--------|----------------|------|------------|
| **Get Time** | "what time is it"<br>"what's the time"<br>"current time" | `client.getTime` | `format` ("12h" or "24h") |
| **Get Location** | "what's my timezone"<br>"where am i" | `client.getLocation` | none |

## 🔍 How Intent Detection Works

### Flow Diagram

```
User Query → Complexity Analysis → Intent Detection → Tool Execution → LLM Response
                    ↓                      ↓                  ↓
              Simple/Complex       Extract Tool Calls   Server/Client
```

### 1. Complexity Analysis

The `IntelligenceRouter` analyzes query complexity:

- **Simple**: Single tool call, direct request (e.g., "list contacts")
- **Complex**: Multi-step workflow (e.g., "create contact then add opportunity")

### 2. Intent Detection

The `detectToolIntent()` method uses an LLM to:

1. Analyze the user query
2. Match against available tools
3. Extract parameters from natural language
4. Return JSON array of tool calls

Example:
```typescript
Input:  "create a contact named John Doe with email john@example.com"
Output: [
  {
    "tool": "server.createContact",
    "params": {
      "name": "John Doe",
      "email": "john@example.com",
      "company": ""
    }
  }
]
```

### 3. Tool Execution

The `ToolExecutor` runs detected tools:

- **Server Tools**: Run on Cloudflare Workers (contacts, opportunities, conversations)
- **Client Tools**: Execute in browser (time, location, device info)

### 4. Response Generation

The LLM generates a natural response incorporating tool results:

```
Tool Result: { id: "contact_123", name: "John Doe", email: "john@example.com" }
LLM Response: "I've created a contact for John Doe with email john@example.com."
```

## 🧪 Testing Intent Detection

### Run All Tests

```bash
npm run test:intents
```

This will validate all MVP intents and show a pass/fail report:

```
═══════════════════════════════════════════════════════════════════════
  MVP Intent Detection Test Suite
═══════════════════════════════════════════════════════════════════════

▶ Contacts
────────────────────────────────────────────────────────────────────────
✓ PASS | create a contact named John Doe with email john@example.com
✓ PASS | add a new contact
✓ PASS | list all contacts
...

═══════════════════════════════════════════════════════════════════════
  Test Summary
═══════════════════════════════════════════════════════════════════════
  Total Tests:  45
  Passed:       45
  Failed:       0
  Pass Rate:    100.0%
═══════════════════════════════════════════════════════════════════════
```

### Run Vitest Tests

```bash
npm test
```

This runs the comprehensive test suite in `src/server/agents/__tests__/intent-detection.test.ts`.

## 📊 MVP Coverage Matrix

| Feature Category | Intents Covered | Tools Implemented | Status |
|-----------------|-----------------|-------------------|--------|
| **Contacts** | 3 | 3 | ✅ Complete |
| **Opportunities** | 3 | 3 | ✅ Complete |
| **WhatsApp** | 1 | 1 | ✅ Complete |
| **Facebook** | 1 | 1 | ✅ Complete |
| **TikTok** | 1 | 1 | ✅ Complete |
| **All Channels** | 1 | 1 | ✅ Complete |
| **Temporal** | 2 | 2 | ✅ Complete |
| **TOTAL** | **12** | **12** | **100%** |

## 🚀 Adding New Intents

To add a new intent:

### 1. Update Tool Registry

Add the tool definition to `src/server/tools/tool-registry.json`:

```json
{
  "id": "server.myNewTool",
  "name": "My New Tool",
  "description": "What this tool does",
  "execution": "server",
  "category": "crm",
  "parameters": {
    "param1": {
      "type": "string",
      "required": true,
      "description": "Parameter description"
    }
  },
  "returns": {
    "result": "string"
  }
}
```

### 2. Implement Tool Executor

Add the implementation in `src/server/tools/tool-executor.ts`:

```typescript
case "server.myNewTool": {
  logger.tool.info("[ToolExecutor] Executing myNewTool");
  const { param1 } = toolCall.params;

  try {
    // Implementation here
    return {
      success: true,
      data: { result: "success" },
      metadata: {
        executionTime: Date.now() - startTime,
        source: "server",
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      metadata: {
        executionTime: Date.now() - startTime,
        source: "server",
      },
    };
  }
}
```

### 3. Update Intent Detection Rules

Add pattern matching in `src/server/agents/chat-agent.ts`:

```typescript
const intentPrompt = `...
Rules:
...
14. For my new feature, use server.myNewTool
...`;
```

### 4. Add Tests

Add test cases in:
- `src/server/agents/__tests__/intent-detection.test.ts` (Vitest)
- `scripts/test-intents.ts` (CLI runner)

## 🐛 Debugging Intent Detection

### Enable Logging

The system logs all intent detection steps:

```
[ChatAgent] 🔍 Analyzing intent...
[ChatAgent] 📊 Complexity: { complexity: "simple", confidence: 0.95 }
[ChatAgent] 🛠️ Tools detected: [{ tool: "server.createContact", params: {...} }]
[ChatAgent] ⚙️ Executing 1 tool(s)...
[ToolExecutor] ✅ Tool executed: server.createContact
```

### Common Issues

1. **Intent Not Detected**
   - Check if pattern matches in `detectToolIntent()`
   - Verify tool exists in `tool-registry.json`
   - Add more specific rules to the LLM prompt

2. **Wrong Tool Selected**
   - Improve tool descriptions in registry
   - Add more specific pattern matching
   - Increase LLM prompt clarity

3. **Missing Parameters**
   - Enhance parameter extraction logic
   - Add default values in tool definitions
   - Consider multi-step workflows for complex inputs

## 📚 Related Documentation

- [Tool Registry](./TOOL-REGISTRY.md)
- [Agent Architecture](./AGENT-ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
