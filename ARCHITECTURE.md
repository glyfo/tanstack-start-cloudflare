# CRM Agent Architecture

## Overview

Simple, focused CRM assistant powered by a single AI agent.

## Architecture

### Single Agent Design

**ChatAgent** (`src/server/agents/chat-agent.ts`)

- **Responsibility**: Complete CRM assistant handling all user interactions
- **Model**: Llama 3.3 70B (better at conversational reasoning)
- **Capabilities**:
  - Create contacts (with validation)
  - List contacts
  - Search contacts
  - Conversational parameter gathering

### Key Features

#### 1. Conversational Parameter Gathering

The agent asks for missing information before acting:

```
User: "create a contact"
Agent: "I'd be happy to help! Please provide: First Name, Last Name, and Email"
User: "John Doe john@example.com"
Agent: ✅ Contact created successfully!
```

#### 2. Smart Tool Execution

- **listContacts**: Executes immediately (no parameters needed)
- **createContact**: Only executes when firstName, lastName, AND email are provided
- **searchContacts**: Executes with user's search query

#### 3. Data Storage

- Uses Durable Object storage for contacts
- Maintains activity log (last 100 actions)
- All data persists across sessions

## File Structure

```
src/server/agents/
├── chat-agent.ts       # Main CRM agent (ACTIVE - in use)
├── index.ts            # Exports ChatAgent only
└── [deprecated files]  # Can be removed:
    ├── orchestrator-agent.ts
    ├── execution-agent.ts
    ├── planning-agent.ts
    ├── knowledge-agent.ts
    └── verification-agent.ts
```

## Why Single Agent?

**Previous**: Complex multi-agent system with orchestrator + 4 specialized agents

- Orchestrator wasn't actually delegating to other agents
- All tools were defined in orchestrator
- Unused agents added complexity

**Current**: One focused agent

- ✅ Simpler to maintain
- ✅ Faster responses (no agent routing)
- ✅ Clear responsibility
- ✅ Easier to debug
- ✅ Lower resource usage

## Development

### Testing the Agent

```bash
# Start dev server
npm run dev

# Test conversations:
1. "create a contact" → Should ask for parameters
2. "John Doe, john@example.com, Acme Corp" → Should create contact
3. "list contacts" → Should show all contacts
4. "search john" → Should find John
```

### Adding New Features

All CRM operations are in `chat-agent.ts`:

1. Add new tool to `getTools()`
2. Update system prompt in `getSystemPrompt()`
3. Test conversational flow

## Deployment

```bash
npm run deploy
```

Durable Objects configuration in `wrangler.jsonc` registers only ChatAgent.

## Technical Stack

- **Runtime**: Cloudflare Workers + Durable Objects
- **AI Model**: Llama 3.3 70B (via Workers AI)
- **AI SDK**: AI SDK v6 + workers-ai-provider
- **Frontend**: TanStack Start + React 19
- **Transport**: WebSocket for streaming
