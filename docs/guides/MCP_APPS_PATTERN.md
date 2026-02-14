# MCP Apps Pattern Guide

This guide documents the **Model Context Protocol (MCP) Apps pattern** implementation in our CRM system. All interactive components should follow this pattern for consistent, maintainable, and efficient UI-to-backend communication.

---

## Overview

The MCP Apps pattern provides:
- **Direct tool invocation** - Forms call backend tools directly without LLM parsing
- **Model context awareness** - The AI model knows about form state and user interactions
- **Structured results** - Tools return typed results that UI components can handle
- **UI metadata in tool registry** - Tools declare their UI requirements

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                                                                  │
│  ┌──────────────────┐    ┌───────────────────────────────────┐ │
│  │  ChatEngine.tsx  │    │      Interactive Card Components   │ │
│  │  ───────────────│    │  ┌─────────────────────────────┐  │ │
│  │  • invokeTool() │────│  │ CreateContactCard           │  │ │
│  │  • updateContext│    │  │ CreateOpportunityCard       │  │ │
│  │  • pendingInvokes    │  │ TikTokLeadCard              │  │ │
│  └──────────────────┘    │  │ FacebookLeadCard            │  │ │
│                          │  │ InstagramLeadCard           │  │ │
│                          │  │ WhatsAppConversationCard    │  │ │
│                          │  │ ContactCard                 │  │ │
│                          │  │ OpportunityCard             │  │ │
│                          │  │ ActionCard                  │  │ │
│                          │  └─────────────────────────────┘  │ │
│                          └───────────────────────────────────┘ │
│                                       │                         │
└───────────────────────────────────────┼─────────────────────────┘
                                        │ WebSocket
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Cloudflare Workers)                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │                     ChatAgent                               ││
│  │  ─────────────────────────────────────────────────────────  ││
│  │  Message Types:                                             ││
│  │  • tool-invoke    → handleDirectToolInvoke()               ││
│  │  • context-update → handleContextUpdate()                  ││
│  │  • user-message   → handleChat() (LLM flow)               ││
│  └────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐│
│  │                  Tool Registry                              ││
│  │  ─────────────────────────────────────────────────────────  ││
│  │  • UI metadata (formComponent, triggerPhrases, fields)     ││
│  │  • Parameter schemas                                        ││
│  │  • Tool execution                                           ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Message Types

### 1. `tool-invoke` - Direct Tool Invocation

Used when UI forms submit data directly to a tool without LLM parsing.

**Client → Server:**
```typescript
{
  type: "tool-invoke",
  requestId: "uuid-123",
  tool: "server.createContact",
  params: {
    name: "John Smith",
    email: "john@example.com",
    company: "Acme Inc"
  }
}
```

**Server → Client:**
```typescript
{
  type: "tool-invoke-result",
  requestId: "uuid-123",
  tool: "server.createContact",
  result: {
    success: true,
    data: { id: "contact-456", name: "John Smith", ... }
  },
  metadata: {
    processingTime: 150,
    source: "server"
  }
}
```

### 2. `context-update` - Model Context Awareness

Used to inform the AI model about user interactions with forms.

**Client → Server:**
```typescript
{
  type: "context-update",
  context: {
    type: "form-state-change",
    formId: "create-contact",
    formState: {
      name: "John",
      email: ""
    },
    action: "field-change"
  }
}
```

**Server → Client:**
```typescript
{
  type: "context-update-ack",
  received: true,
  timestamp: 1706000000000
}
```

---

## Implementing a New Card Component

### Step 1: Define Props Interface

```typescript
// MCP Apps pattern - Tool invocation result
interface ToolInvokeResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface YourCardProps {
  data: YourDataType;

  // Legacy callbacks (for backwards compatibility)
  onAction?: (id: string) => void;
  onCancel?: () => void;

  // MCP Apps pattern - direct tool invocation
  onInvokeTool?: (
    toolId: string,
    params: Record<string, any>
  ) => Promise<ToolInvokeResult>;

  // MCP Apps pattern - context updates (for form cards)
  onContextUpdate?: (context: {
    type: string;
    formId: string;
    formState: Record<string, any>;
    action: string;
  }) => void;
}
```

### Step 2: Implement Action Handlers

```typescript
export function YourCard({
  data,
  onAction,
  onCancel,
  onInvokeTool,
  onContextUpdate,
}: YourCardProps) {

  // MCP Apps pattern - handle action with direct tool invocation
  const handleAction = async () => {
    if (onInvokeTool) {
      try {
        const result = await onInvokeTool('server.yourTool', {
          id: data.id,
          // ... other params
        });

        if (result.success) {
          // Handle success (UI updates via message broadcast)
        }
      } catch (error) {
        console.error('Failed to invoke tool:', error);
      }
    } else if (onAction) {
      // Fallback to legacy callback
      onAction(data.id);
    }
  };

  return (
    <div>
      {/* Your card UI */}
      <button onClick={handleAction}>
        Perform Action
      </button>
    </div>
  );
}
```

### Step 3: For Form Cards - Add Context Updates

```typescript
export function YourFormCard({
  initialData,
  onSubmit,
  onCancel,
  onInvokeTool,
  onContextUpdate,
}: YourFormCardProps) {
  const [formData, setFormData] = useState(initialData);

  // Notify context updates when form state changes
  const notifyContextUpdate = (action: string, state: Record<string, any>) => {
    if (onContextUpdate) {
      onContextUpdate({
        type: "form-state-change",
        formId: "your-form-id",
        formState: state,
        action,
      });
    }
  };

  const handleInputChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // MCP Apps pattern - notify model of changes
    notifyContextUpdate("field-change", newFormData);
  };

  const handleSubmit = async () => {
    if (onInvokeTool) {
      try {
        await onInvokeTool('server.createYourEntity', formData);
      } catch (error) {
        console.error('Failed to create:', error);
      }
    } else if (onSubmit) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields with handleInputChange */}
    </form>
  );
}
```

---

## Adding Tool to Registry

### Step 1: Add Tool Definition

Edit `src/server/tools/tool-registry.json`:

```json
{
  "id": "server.yourTool",
  "name": "Your Tool Name",
  "description": "Description for AI to understand when to use this tool",
  "execution": "server",
  "category": "your-category",
  "parameters": {
    "param1": {
      "type": "string",
      "required": true,
      "description": "What this parameter is for"
    },
    "param2": {
      "type": "number",
      "optional": true,
      "description": "Optional parameter"
    }
  },
  "returns": {
    "success": "boolean",
    "id": "string",
    "message": "string"
  },
  "ui": {
    "formComponent": "your-form-component",
    "cardType": "your-card",
    "triggerPhrases": ["create your thing", "add your thing", "new your thing"],
    "requiresForm": true,
    "fields": [
      { "name": "param1", "label": "Parameter 1", "type": "text", "required": true },
      { "name": "param2", "label": "Parameter 2", "type": "number", "required": false }
    ],
    "successMessage": "Created successfully",
    "icon": "your-icon"
  }
}
```

### Step 2: Implement Tool Executor

Edit `src/server/tools/tool-executor.ts`:

```typescript
case 'server.yourTool':
  return await this.executeYourTool(params, context);

// ...

private async executeYourTool(
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  try {
    // Your implementation
    const result = await doSomething(params);

    return {
      success: true,
      data: result,
      metadata: { source: 'server' }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { source: 'server' }
    };
  }
}
```

### Step 3: Add Action Description

Edit `src/server/agents/chat-agent.ts` - `getToolActionDescription`:

```typescript
case "server.yourTool":
  return `✅ **Your Action Completed**\n\nDetails:\n- **Field 1:** ${result?.field1 || params.param1}`;
```

---

## Integrating in ChatEngine

### Pass `invokeTool` to Cards

When rendering cards in `MessageContent`:

```typescript
} else if (part.cardType === 'your-card-type') {
  return (
    <YourCard
      key={idx}
      data={data}
      onInvokeTool={onInvokeTool}  // From ChatEngine
      onContextUpdate={onContextUpdate}  // For form cards
    />
  );
}
```

---

## Benefits of MCP Apps Pattern

| Aspect | Before (LLM Parsing) | After (MCP Apps) |
|--------|---------------------|------------------|
| **Reliability** | LLM may misparse | Exact params sent |
| **Latency** | LLM round-trip | Direct execution |
| **Token Cost** | Extra tokens for parsing | Zero extra tokens |
| **Error Handling** | Unclear errors | Structured errors |
| **Type Safety** | String parsing | TypeScript types |
| **Model Awareness** | None | Full context |

---

## Checklist for New Components

When creating a new interactive card:

- [ ] Define `ToolInvokeResult` interface in component
- [ ] Add `onInvokeTool` prop to component interface
- [ ] Add `onContextUpdate` prop (for form cards)
- [ ] Implement action handler with `onInvokeTool` check
- [ ] Add fallback to legacy callback for backwards compatibility
- [ ] Add tool definition to `tool-registry.json`
- [ ] Implement tool execution in `tool-executor.ts`
- [ ] Add action description in `chat-agent.ts`
- [ ] Add card rendering in `MessageContent`
- [ ] Test direct invocation flow
- [ ] Test context update flow (for forms)

---

## Related Documentation

- [Interactive Forms Guide](./INTERACTIVE_FORMS_GUIDE.md) - Form patterns and validation
- [UI Design Guidelines](../reference/UI_DESIGN_GUIDELINES.md) - Styling and components
- [Developer Quick Reference](../reference/DEVELOPER_QUICK_REFERENCE.md) - Code snippets
- [Social Media Setup](./SOCIAL_MEDIA_SETUP.md) - OAuth credentials setup

---

*Last Updated: 2026-01-27*
