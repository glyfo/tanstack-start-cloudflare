# OpenClaw Channel Architecture Review

**Date:** February 14, 2026
**Source:** [openclaw/openclaw](https://github.com/openclaw/openclaw)
**Purpose:** Evaluate channel independence patterns for potential application to SuperHuman CRM Chat UI

---

## Executive Summary

OpenClaw implements a **hub-and-spoke gateway architecture** that achieves true channel independence through:
- Centralized WebSocket Gateway as single control plane
- Channels as pluggable services (not compiled into core)
- Deterministic routing (replies return to origin channel)
- Hierarchical session scoping for isolation
- Per-channel configuration with granular overrides

**Key Insight:** Channels communicate exclusively through the Gateway—never directly with each other or the agent runtime. This creates a clean separation of concerns where adding/removing channels requires zero changes to core agent logic.

---

## 1. Architecture Pattern: Hub-and-Spoke Gateway

### Central Gateway WebSocket
```
Channel (WhatsApp) ──┐
Channel (Telegram) ──┼──> Gateway WS (ws://127.0.0.1:18789) ──> Agent Runtime
Channel (Discord)  ──┘
```

**Key Characteristics:**
- **Single control plane** for sessions, channels, tools, and events
- Channels connect as **clients** to the Gateway (not embedded services)
- Gateway owns channel sockets and reconnect loops
- Stateless routing through standardized Gateway methods

### vs. SuperHuman CRM Current State
```
TanStack Start App ──> ChatAgent (Durable Object) ──> Agent Logic + Tools
                           ↓
                     WebSocket (single channel)
```

**Gap:** We have a single channel (WebSocket) baked into the ChatAgent. Adding SMS, WhatsApp, Slack, etc. would require modifying the ChatAgent core.

---

## 2. Channel Independence Mechanisms

### A. Session Key Scoping

OpenClaw uses **hierarchical session namespacing**:

```typescript
// Direct messages
agent:<agentId>:<mainKey>

// Groups
agent:<agentId>:<channel>:group:<id>

// Channels/rooms
agent:<agentId>:<channel>:channel:<id>

// Threads
agent:<agentId>:<channel>:channel:<id>:thread:<threadId>
```

**Benefits:**
- No cross-channel state leakage
- Easy per-channel session lookup
- Thread inheritance without complexity
- Natural multi-tenancy support

### B. Configuration Isolation

Per-channel configuration with account-level overrides:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing",
      allowFrom: ["+15551234567"],
      groupPolicy: "open",
      textChunkLimit: 4000,
      accounts: {
        work: {
          dmPolicy: "allowlist",  // Override
          authDir: "custom-path"
        }
      }
    },
    slack: {
      dmPolicy: "open",
      allowFrom: ["U123"],
      teamId: "T456"
    }
  }
}
```

**Pattern:** Channel defaults → Account overrides → Runtime resolution

### C. Credential Isolation

Separate auth storage per channel/account:
```
~/.openclaw/credentials/
  whatsapp/
    personal/creds.json
    work/creds.json
  slack/
    team1/creds.json
  discord/
    bot/creds.json
```

### D. Independent Lifecycle

Channels can:
- Restart without affecting Gateway or other channels
- Fail without cascading errors
- Reconfigure at runtime
- Add/remove accounts dynamically

---

## 3. Message Routing Pattern

### Deterministic Routing (Not AI-Selected)

> "The model does not choose a channel; routing is deterministic and controlled by host configuration."

**Routing Resolution Hierarchy:**
1. Exact peer match (`peer.kind` + `peer.id`)
2. Parent peer match (thread inheritance)
3. Guild + roles (Discord)
4. Guild (Discord)
5. Team (Slack)
6. Account ID
7. Channel-wide (`accountId: "*"`)
8. Default agent fallback

**Configuration Example:**
```json5
{
  bindings: [
    {
      match: {
        channel: "whatsapp",
        peer: { kind: "direct", id: "+15551234567" }
      },
      agentId: "sales"
    },
    {
      match: {
        channel: "slack",
        teamId: "T123"
      },
      agentId: "support"
    }
  ]
}
```

### Message Envelope Normalization

All channels wrap messages in a **standardized envelope**:
- Quoted replies: `[Replying to <sender> id:<stanzaId>]`
- Media placeholders: `<media:image>`, `<media:video>`, etc.
- Reply metadata: `ReplyToId`, `ReplyToBody`, `ReplyToSender`

**Benefits:**
- Agent runtime is channel-agnostic
- Tools work uniformly across channels
- Reply context preserved without channel-specific logic

---

## 4. WhatsApp Channel Implementation

### Connection Pattern

```typescript
// WhatsApp channel connects to Gateway
Gateway.registerChannel({
  type: 'whatsapp',
  accountId: 'personal',
  socket: baileysSocket,
  credentials: loadCreds('~/.openclaw/credentials/whatsapp/personal')
})

// Gateway owns reconnect loop
baileysSocket.on('close', () => {
  Gateway.reconnectChannel('whatsapp', 'personal')
})
```

### Message Handling

**Inbound:**
1. Baileys receives WhatsApp message
2. Channel adapter normalizes to envelope format
3. Gateway routes to bound agent
4. Agent processes (channel-agnostic)
5. Response returns via same route

**Outbound:**
1. Agent emits response
2. Gateway looks up origin channel (`whatsapp`)
3. WhatsApp adapter formats for Baileys
4. Baileys sends via WhatsApp Web protocol

### Configuration Deep-Dive

```json5
{
  channels: {
    whatsapp: {
      // Access control
      dmPolicy: "pairing" | "allowlist" | "open" | "disabled",
      groupPolicy: "open" | "allowlist" | "disabled",
      allowFrom: ["+15551234567"],
      groupAllowFrom: ["+15551234567"],
      groups: ["group-jid"],

      // Message handling
      textChunkLimit: 4000,
      chunkMode: "length" | "newline",
      sendReadReceipts: true,

      // Acknowledgment
      ackReaction: {
        emoji: "👀",
        direct: true,
        group: "mentions" // always | mentions | never
      },

      // Multi-account
      accounts: {
        work: {
          dmPolicy: "allowlist",
          authDir: "~/.openclaw/credentials/whatsapp/work"
        }
      }
    }
  }
}
```

### Pairing Flow (Security)

```bash
# Unknown sender messages agent
# Agent generates short code
openclaw pairing list whatsapp
# whatsapp 7A3F from +15551234567

# Admin approves
openclaw pairing approve whatsapp 7A3F

# Sender added to allowlist, conversation continues
```

**Key Implementation Details:**
- **DM scoping:** `session.dmScope` default "main" collapses DMs without cross-channel leakage
- **Status filtering:** Ignores `@status` and `@broadcast` chats entirely
- **Media optimization:** Images auto-optimize to fit size constraints
- **Text chunking:** Splits by `textChunkLimit` (default 4000) with "length" or "newline" mode
- **Codec rewriting:** Audio auto-converts to opus for WhatsApp compatibility

---

## 5. Key Architectural Insights

### ✅ What Works Well

1. **True Decoupling**
   - Channels don't import agent code
   - Agent doesn't import channel adapters
   - Gateway mediates all communication

2. **Pluggable Architecture**
   - Add new channel = implement adapter + register with Gateway
   - No core changes required
   - Channels use standard protocol libs (Baileys, grammY, discord.js)

3. **Configuration-Driven Routing**
   - All routing logic in config files
   - No hardcoded channel references in agent
   - Runtime reconfiguration possible

4. **Session Isolation**
   - Hierarchical key structure prevents cross-channel leakage
   - Natural multi-tenancy (per-channel, per-account)
   - Thread/group context without coupling

5. **Security Model**
   - Per-channel allowlists
   - Pairing flow for unknown senders
   - Granular DM vs. group policies

### ⚠️ Potential Challenges

1. **Local-First Requirement**
   - Gateway runs locally (not cloud-native)
   - Requires persistent process
   - Not serverless-friendly

2. **Credential Management**
   - File-based credential storage
   - Manual account setup via CLI
   - Not suitable for multi-tenant SaaS

3. **Stateful Gateway**
   - Gateway owns channel sockets
   - Single point of failure
   - Requires restart to add channels

---

## 6. Application to SuperHuman CRM

### Current State Analysis

**Monolithic ChatAgent:**
```typescript
export class ChatAgent extends AIChatAgent {
  // Agent logic + tool registry + message handling
  // Single WebSocket channel (frontend → ChatAgent DO)
  // No channel abstraction
}
```

**Limitations:**
- Cannot add SMS/WhatsApp/Slack without modifying ChatAgent
- Session keys assume single channel (`agent:<agentId>:session:<id>`)
- Tools assume WebSocket context
- No channel-specific configuration

### Proposed Architecture (OpenClaw-Inspired)

```typescript
// Gateway Durable Object (NEW)
export class ChannelGateway extends DurableObject {
  channels: Map<ChannelType, ChannelAdapter>

  async registerChannel(adapter: ChannelAdapter) {
    this.channels.set(adapter.type, adapter)
  }

  async routeMessage(envelope: MessageEnvelope) {
    const session = this.resolveSession(envelope)
    const agent = this.resolveAgent(session)
    const response = await agent.process(envelope)
    const channel = this.channels.get(envelope.channelType)
    await channel.send(response)
  }
}

// Channel Adapters
export interface ChannelAdapter {
  type: ChannelType
  connect(): Promise<void>
  send(message: Message): Promise<void>
  normalize(raw: unknown): MessageEnvelope
}

export class WhatsAppAdapter implements ChannelAdapter {
  type = 'whatsapp'
  baileys: WASocket

  async connect() {
    this.baileys = makeWASocket({...})
    this.baileys.ev.on('messages.upsert', (msg) => {
      gateway.routeMessage(this.normalize(msg))
    })
  }

  normalize(msg: WAMessage): MessageEnvelope {
    return {
      channelType: 'whatsapp',
      accountId: this.accountId,
      peer: { kind: 'direct', id: msg.key.remoteJid },
      body: msg.message.conversation,
      // ... reply metadata, media, etc.
    }
  }

  async send(message: Message) {
    await this.baileys.sendMessage(message.peer.id, {
      text: message.body
    })
  }
}

export class WebSocketAdapter implements ChannelAdapter {
  type = 'websocket'
  // Wrap existing ChatAgent WebSocket
}
```

### Session Key Migration

**Current:**
```typescript
agent:<agentId>:session:<id>
```

**Proposed (OpenClaw-style):**
```typescript
// Direct messages (any channel)
agent:<agentId>:<channel>:dm:<peerId>

// Group messages
agent:<agentId>:<channel>:group:<groupId>

// Thread replies
agent:<agentId>:<channel>:group:<groupId>:thread:<threadId>
```

### Configuration Schema

```typescript
// wrangler.jsonc + Cloudflare KV
{
  channels: {
    websocket: {
      dmPolicy: "open",
      accounts: {
        default: { enabled: true }
      }
    },
    whatsapp: {
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      accounts: {
        support: {
          phoneNumber: "+15551234567",
          credentialsKV: "whatsapp:creds:support"
        }
      }
    },
    slack: {
      dmPolicy: "allowlist",
      teamId: "T123",
      botToken: "xoxb-..."
    }
  },
  bindings: [
    {
      match: { channel: "whatsapp", peer: { id: "+15551111111" } },
      agentId: "sales"
    },
    {
      match: { channel: "slack", teamId: "T123" },
      agentId: "support"
    }
  ]
}
```

---

## 7. Implementation Roadmap

### Phase 1: Channel Abstraction (No New Channels)

**Goal:** Refactor existing WebSocket to use channel adapter pattern

1. Create `ChannelAdapter` interface
2. Implement `WebSocketAdapter` wrapping current ChatAgent
3. Extract routing logic to separate service
4. Migrate session keys to hierarchical format
5. **No external dependencies, no new channels**

**Success Criteria:**
- ✅ Existing chat works identically
- ✅ Session keys use `agent:<id>:websocket:dm:<user>`
- ✅ Routing logic is channel-agnostic

### Phase 2: Gateway Durable Object

**Goal:** Create `ChannelGateway` DO to mediate channel communication

1. Implement `ChannelGateway` as new DO
2. Register `WebSocketAdapter` with Gateway
3. Route messages through Gateway
4. Bind in wrangler.jsonc
5. Update frontend to connect via Gateway

**Success Criteria:**
- ✅ WebSocket messages flow: Frontend → Gateway → ChatAgent
- ✅ Gateway can register/unregister adapters
- ✅ Configuration-driven routing works

### Phase 3: Message Envelope Normalization

**Goal:** Standardize message format across channels

1. Define `MessageEnvelope` type
2. Update `WebSocketAdapter.normalize()`
3. Update ChatAgent to process envelopes
4. Extract reply metadata, media placeholders
5. Test with existing chat UI

**Success Criteria:**
- ✅ All messages use envelope format
- ✅ Reply context preserved
- ✅ Media handling standardized

### Phase 4: Second Channel (SMS via Twilio)

**Goal:** Validate architecture with real second channel

1. Implement `TwilioAdapter`
2. Register with Gateway
3. Add routing config for SMS numbers
4. Test two-way SMS conversations
5. Verify session isolation

**Success Criteria:**
- ✅ SMS messages route to ChatAgent
- ✅ Responses return via SMS
- ✅ WebSocket and SMS sessions isolated
- ✅ Adding SMS required zero ChatAgent changes

### Phase 5: WhatsApp Channel

**Goal:** Full multi-channel support

1. Implement `WhatsAppAdapter` (Baileys)
2. Add credential management (Cloudflare KV)
3. Implement pairing flow
4. Add WhatsApp-specific config (chunking, read receipts)
5. Test multi-account support

**Success Criteria:**
- ✅ WhatsApp messages route correctly
- ✅ Multi-account isolation works
- ✅ Pairing flow functional
- ✅ All channels work simultaneously

---

## 8. Constraints & Adaptations

### Cloudflare Workers vs. Local Gateway

| OpenClaw | SuperHuman CRM |
|----------|----------------|
| Local Gateway process | ChannelGateway Durable Object |
| File-based credentials | Cloudflare KV/R2 |
| CLI for pairing | Web UI for pairing |
| Single-tenant | Multi-tenant (per org) |
| Persistent sockets | Serverless adapters |

### Durable Objects Fit

**Pros:**
- ✅ Natural fit for stateful Gateway
- ✅ SQLite for session storage
- ✅ WebSocket built-in
- ✅ Per-org isolation (org-specific DO instances)

**Cons:**
- ⚠️ Baileys requires persistent connection (WebSocket to WhatsApp)
- ⚠️ DO hibernation may disconnect long-running sockets
- ⚠️ Need reconnect strategy for channel adapters

**Solution:** Hybrid approach
- `ChannelGateway` DO: routing, session management, config
- `WhatsAppConnection` DO: owns Baileys socket, registers with Gateway
- Gateway coordinates, connections persist

---

## 9. Key Takeaways

### What to Adopt

1. **Hub-and-spoke Gateway pattern** → `ChannelGateway` DO
2. **Hierarchical session keys** → `agent:<id>:<channel>:<scope>:<id>`
3. **Channel adapter interface** → Pluggable `ChannelAdapter`s
4. **Configuration-driven routing** → Bindings in KV/config
5. **Message envelope normalization** → Standardized format
6. **Per-channel configuration** → Isolated settings with overrides

### What to Adapt

1. **Local Gateway** → Durable Object Gateway
2. **File credentials** → KV/R2 storage
3. **CLI pairing** → Web UI pairing flow
4. **Single-tenant** → Multi-tenant (org-scoped)
5. **Persistent sockets** → Serverless-friendly adapters

### What NOT to Adopt

1. ❌ **Complete channel independence** (we need tighter integration for CRM features)
2. ❌ **Model-agnostic routing** (our agent CAN choose channel for proactive outreach)
3. ❌ **Broadcast groups** (not needed yet)
4. ❌ **Thread buffering** (handle directly)

---

## 10. Next Steps

1. **Review with team** - Validate approach fits SuperHuman CRM vision
2. **Prototype Phase 1** - Refactor WebSocket to adapter pattern
3. **Test session key migration** - Ensure backward compatibility
4. **Document adapter interface** - Clear contract for future channels
5. **Plan credential strategy** - KV vs. R2 for WhatsApp creds

---

## Appendix: OpenClaw References

- **Repository:** https://github.com/openclaw/openclaw
- **Channels Docs:** https://github.com/openclaw/openclaw/tree/main/docs/channels
- **WhatsApp Config:** https://github.com/openclaw/openclaw/blob/main/docs/channels/whatsapp.md
- **Channel Routing:** https://github.com/openclaw/openclaw/blob/main/docs/channels/channel-routing.md

---

**Document Status:** ✅ Complete
**Next Review:** After Phase 1 implementation
**Owner:** Alex (refactor/monolith-decomposition branch)
