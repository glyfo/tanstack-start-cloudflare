# Tool Registry Pattern - Implementation Reference

## Problem Statement

When building an AI agent with many operations (e.g., 300 CRM operations), putting all tool definitions directly in the ChatAgent class creates:

- ❌ 6000+ line ChatAgent file
- ❌ Mixing concerns (chat logic + business logic)
- ❌ Impossible to find specific tools
- ❌ Cannot reuse tools in other agents
- ❌ Hard to test individual tools
- ❌ Merge conflicts when multiple developers work on tools
- ❌ ChatAgent knows too much about business domains

## Solution: Registry Pattern

Separate tool definitions into domain-specific files and use a registry to aggregate them.

---

## File Structure

```
src/server/
  agents/
    chat-agent.ts          ← Imports registry only (stays 80 lines)
  tools/
    registry.ts            ← Aggregates all tool collections
    contacts.ts            ← Contact operations (create, update, delete, etc.)
    deals.ts               ← Deal operations
    campaigns.ts           ← Campaign operations
    reports.ts             ← Reporting operations
```

---

## Implementation

### 1. Registry File (`tools/registry.ts`)

```typescript
import { contactTools } from "./contacts";
import { dealTools } from "./deals";
import { campaignTools } from "./campaigns";

/**
 * Central registry for all CRM tools
 * Add new tool collections here as they're created
 */
export function getTools(state: any) {
  return {
    ...contactTools(state),
    ...dealTools(state),
    ...campaignTools(state),
    // Add 300 more tools? Just import and spread
  };
}
```

### 2. Domain Tool File (`tools/contacts.ts`)

```typescript
import { tool } from "ai";
import { z } from "zod";

/**
 * Contact management tools
 * All contact-related operations are defined here
 */
export function contactTools(state: any) {
  return {
    createContact: tool({
      description: "Create a new contact in the CRM system",
      parameters: z.object({
        name: z.string().describe("Full name of the contact"),
        email: z.string().email().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        company: z.string().optional().describe("Company name"),
      }),
      execute: async ({ name, email, phone, company }) => {
        const contacts = (await state.storage.get("contacts")) || [];
        const newContact = {
          id: crypto.randomUUID(),
          name,
          email,
          phone,
          company,
          createdAt: new Date().toISOString(),
        };
        contacts.push(newContact);
        await state.storage.put("contacts", contacts);
        return `✅ Created contact: ${name} (${email})`;
      },
    }),

    listContacts: tool({
      description: "List all contacts in the CRM",
      parameters: z.object({
        limit: z.number().optional().describe("Maximum number to return"),
      }),
      execute: async ({ limit }) => {
        const contacts = (await state.storage.get("contacts")) || [];
        const displayList = limit ? contacts.slice(0, limit) : contacts;
        return `📋 Found ${contacts.length} total contacts:\n${displayList
          .map((c: any) => `- ${c.name} (${c.email})`)
          .join("\n")}`;
      },
    }),

    searchContacts: tool({
      description: "Search for contacts by name, email, or company",
      parameters: z.object({
        query: z.string().describe("Search query"),
      }),
      execute: async ({ query }) => {
        const contacts = (await state.storage.get("contacts")) || [];
        const results = contacts.filter(
          (c: any) =>
            c.name?.toLowerCase().includes(query.toLowerCase()) ||
            c.email?.toLowerCase().includes(query.toLowerCase()) ||
            c.company?.toLowerCase().includes(query.toLowerCase())
        );
        return `🔍 Found ${results.length} matching contacts`;
      },
    }),

    updateContact: tool({
      description: "Update contact information",
      parameters: z.object({
        contactId: z.string().describe("ID of contact to update"),
        name: z.string().optional().describe("New name"),
        email: z.string().email().optional().describe("New email"),
        phone: z.string().optional().describe("New phone"),
        company: z.string().optional().describe("New company"),
      }),
      execute: async ({ contactId, name, email, phone, company }) => {
        const contacts = (await state.storage.get("contacts")) || [];
        const index = contacts.findIndex((c: any) => c.id === contactId);
        if (index === -1) return `❌ Contact not found`;

        const updated = {
          ...contacts[index],
          ...(name && { name }),
          ...(email && { email }),
          ...(phone && { phone }),
          ...(company && { company }),
          updatedAt: new Date().toISOString(),
        };
        contacts[index] = updated;
        await state.storage.put("contacts", contacts);
        return `✅ Updated contact: ${updated.name}`;
      },
    }),

    deleteContact: tool({
      description: "Delete a contact from the CRM",
      parameters: z.object({
        contactId: z.string().describe("ID of contact to delete"),
      }),
      execute: async ({ contactId }) => {
        const contacts = (await state.storage.get("contacts")) || [];
        const index = contacts.findIndex((c: any) => c.id === contactId);
        if (index === -1) return `❌ Contact not found`;

        const deleted = contacts[index];
        contacts.splice(index, 1);
        await state.storage.put("contacts", contacts);
        return `🗑️ Deleted contact: ${deleted.name}`;
      },
    }),
  };
}
```

### 3. ChatAgent Integration (`agents/chat-agent.ts`)

```typescript
import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { getTools } from "../tools/registry"; // ← Import registry

const CONFIG = {
  MODEL: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any,
} as const;

const SYSTEM_PROMPT = `You are an expert business operations assistant...`;

export class ChatAgent extends AIChatAgent<any> {
  async onChatMessage(onFinish?: any): Promise<Response> {
    try {
      console.log("[ChatAgent] Processing message");

      const modelMessages = this.messages.map((msg: any) => {
        const textPart = msg.parts?.find((p: any) => p.type === "text");
        return {
          role: msg.role,
          content: textPart?.text || "",
        };
      });

      const result = await streamText({
        model: createWorkersAI({ binding: (this as any).env.AI })(CONFIG.MODEL),
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        temperature: 0.7,
        tools: getTools((this as any).state), // ← One line to get all tools
        maxSteps: 5,
        onFinish,
      });

      return result.toTextStreamResponse();
    } catch (error) {
      console.error("[ChatAgent Error]", error);

      const result = await streamText({
        model: createWorkersAI({ binding: (this as any).env.AI })(CONFIG.MODEL),
        prompt: "I'm having trouble right now. Please try again.",
        temperature: 0,
        onFinish,
      });

      return result.toTextStreamResponse();
    }
  }
}
```

---

## How AI Uses Tool Parameters

The AI model reads the `z.object()` schema to understand what data it needs:

```typescript
parameters: z.object({
  name: z.string().describe("Full name"), // ← REQUIRED (no .optional())
  email: z.string().email().describe("Email"), // ← REQUIRED
  phone: z.string().optional().describe("Phone"), // ← OPTIONAL
});
```

**Conversation flow:**

1. User: "create a contact"
2. AI sees tool requires: `name` (required), `email` (required)
3. AI asks: "What's their name?"
4. User: "John Smith"
5. AI asks: "What's John's email address?"
6. User: "john@example.com"
7. AI has all required fields → calls tool: `createContact({ name: "John Smith", email: "john@example.com" })`
8. Tool executes and saves to storage
9. AI responds: "✅ Created contact: John Smith (john@example.com)"

**The AI SDK handles the conversation to collect missing parameters automatically.**

---

## Benefits

| Aspect                 | Tools in Class    | Registry Pattern                  |
| ---------------------- | ----------------- | --------------------------------- |
| ChatAgent file size    | 6000+ lines       | 80 lines                          |
| Finding a tool         | Search 6000 lines | Go to specific file (contacts.ts) |
| Adding 100 tools       | Edit 1 giant file | Add 1 import line in registry     |
| Team collaboration     | Merge conflicts   | Parallel work on different files  |
| Reusability            | Copy/paste        | Import function                   |
| Testing                | Test entire agent | Test individual domains           |
| Separation of concerns | ❌ Mixed          | ✅ Clean                          |
| Maintainability        | ❌ Difficult      | ✅ Easy                           |

---

## Adding New Tool Collections

To add 50 new deal operations:

1. Create `tools/deals.ts`:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export function dealTools(state: any) {
  return {
    createDeal: tool({ ... }),
    updateDeal: tool({ ... }),
    // ... 48 more
  };
}
```

2. Update `tools/registry.ts` (add one line):

```typescript
import { dealTools } from "./deals"; // ← Add import

export function getTools(state: any) {
  return {
    ...contactTools(state),
    ...dealTools(state), // ← Add spread
  };
}
```

3. ChatAgent remains unchanged (still 80 lines)

---

## Key Principles

1. **Separation of Concerns**: ChatAgent handles conversation, tools handle business logic
2. **Single Responsibility**: Each tool file focused on one domain
3. **Scalability**: Adding 300 tools = adding imports, not bloating ChatAgent
4. **Maintainability**: Easy to find, test, and modify specific tools
5. **Team-Friendly**: Multiple developers work on different tool files without conflicts
6. **Reusability**: Tools can be imported and used in other agents

---

## ChatAgent Responsibilities

ChatAgent should ONLY:

- ✅ Orchestrate message flow (WebSocket → AI → Response)
- ✅ Convert message formats (UIMessage → ModelMessage)
- ✅ Handle errors and recovery
- ✅ Stream AI responses

ChatAgent should NOT:

- ❌ Define tool implementations
- ❌ Contain business logic
- ❌ Know about CRM, deals, campaigns, etc.
- ❌ Handle storage operations directly

---

## Conclusion

The registry pattern is **standard software engineering**: separate concerns, single responsibility, easy maintenance. It scales from 5 tools to 500 tools without making ChatAgent unmanageable.
