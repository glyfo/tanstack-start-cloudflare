# Distributed Agent Coordination MVP
## Stigmergic Agents on Cloudflare Edge

**Vision**: Transform the SuperHuman CRM from a centralized chat system into a **distributed, autonomous agent network** that coordinates through environmental traces rather than direct messaging.

---

## Executive Summary

### Current State: Centralized Agent (Phase 1)

```
User → ChatAgent (DO) → LLM → Tools → Response
         └─ Synchronous, single-point coordination
```

### Target State: Distributed Stigmergic Network (Phase 2)

```
Support Agent (EU) → [Trace: sentiment=-0.8] → Context Graph (EU)
                                                      ↓ KV propagation
Health Agent (US)  ← Query traces ← Context Graph (US)
                     └─ Deposits: [Trace: health=45%]
                                      ↓
Churn Agent (US)   ← Pattern match ← Multiple traces
                     └─ Deposits: [Trace: churn_risk=0.92]
                                      ↓
Sales Agent        ← Discovers trace ← Acts autonomously
```

**Key Innovation**: Agents coordinate through **stigmergy** (environmental modification) rather than messaging, enabling:
- ✅ Autonomous operation without orchestration
- ✅ Graceful degradation across regions
- ✅ Natural decay of stale signals
- ✅ Emergent coordination patterns
- ✅ GDPR-compliant regional constraints

---

## Mapping to OpenClaw Architecture

### OpenClaw Pattern → Distributed Agent MVP

| OpenClaw Component | Current CRM | Distributed MVP |
|-------------------|-------------|-----------------|
| **Gateway Layer** | WebSocket/HTTP handler | Queue consumers + event routers |
| **Agent Core** | Single ChatAgent | Multiple specialized Workers (Support, Health, Churn) |
| **Memory Layer** | Session messages (JSONL) | Context Graph (traces with decay) |
| **Tool System** | LLM tool calling | Trace deposit/query operations |
| **Persistence** | Durable Objects (messages) | DOs (context graphs) + KV (propagation) + R2 (archive) |
| **Multi-Agent** | Router to specialized agents | Autonomous agents discovering traces |

### Stigmergy vs Direct Messaging

**OpenClaw uses**: Direct messaging between agents with shared memory files

**Distributed MVP uses**: Environmental traces that agents discover

```
OpenClaw:
  RouterAgent → sends message → SDRAgent
                              → receives response
                              → shared memory file

Distributed MVP:
  SupportAgent → deposits trace → Context Graph
                                     ↓
  HealthAgent  → queries graph → discovers trace
                                → deposits own trace
                                     ↓
  ChurnAgent   → pattern match → discovers multiple traces
                                → acts autonomously
```

**Benefit**: No coupling between agents, graceful degradation, regional isolation

---

## Functional Definition

### MVP Scope: Three Autonomous Agents

#### 1. Support Agent (Sentiment Analysis)

**Input**: Support ticket via Queue
**Process**:
1. Query `AccountContextGraph` DO for recent account history
2. Perform sentiment analysis on ticket text
3. Extract topics and urgency signals
4. Deposit trace with sentiment score, topics, timestamp

**Trace Schema**:
```typescript
{
  id: "trace_support_12345",
  namespace: "accounts",
  entityId: "acct_abc123",
  agentType: "support-analyzer",
  timestamp: 1707849600000,
  decayHalfLife: 259200000, // 72 hours
  reinforcementWeight: 1.0,
  jurisdictionConstraints: ["EU"], // GDPR: stays in EU
  payload: {
    sentiment: -0.8,
    topics: ["billing", "cancellation"],
    urgency: "high",
    ticketId: "TKT-98765"
  },
  parentTraces: []
}
```

**No orchestrator tells this agent what to do next** - it deposits the trace and terminates.

#### 2. Health Agent (Account Wellness)

**Trigger**: Scheduled (hourly)
**Process**:
1. Query `AccountContextGraph` for traces since last assessment
2. Calculate weighted health score:
   - Recent support sentiment (from Support Agent traces)
   - Usage patterns (from hypothetical Usage Agent)
   - Payment history (from Billing Agent)
3. Deposit health trace

**Trace Schema**:
```typescript
{
  id: "trace_health_67890",
  namespace: "accounts",
  entityId: "acct_abc123",
  agentType: "health-monitor",
  timestamp: 1707849660000,
  decayHalfLife: 604800000, // 168 hours
  reinforcementWeight: 1.5, // Health signals reinforce more strongly
  jurisdictionConstraints: [], // Global propagation
  payload: {
    healthScore: 45,
    contributors: [
      { type: "support_sentiment", weight: -30 },
      { type: "usage_decline", weight: -15 },
      { type: "payment_delay", weight: -10 }
    ],
    trend: "declining"
  },
  parentTraces: ["trace_support_12345"]
}
```

**Discovery**: Health Agent found Support Agent's trace by querying, not by being told to look for it.

#### 3. Churn Agent (Retention Risk)

**Trigger**: Conditional (when health drops below threshold)
**Process**:
1. Query `AccountContextGraph` for all traces (30-day window)
2. Pattern match across multiple signal types
3. Calculate churn probability
4. If high risk, deposit high-priority trace

**Trace Schema**:
```typescript
{
  id: "trace_churn_11111",
  namespace: "accounts",
  entityId: "acct_abc123",
  agentType: "churn-predictor",
  timestamp: 1707849720000,
  decayHalfLife: 1209600000, // 336 hours
  reinforcementWeight: 2.0, // Churn signals are critical
  jurisdictionConstraints: [],
  payload: {
    churnProbability: 0.92,
    riskLevel: "critical",
    contributingSignals: [
      "negative_support_sentiment",
      "health_degradation",
      "usage_decline",
      "billing_issues"
    ],
    recommendedAction: "executive_outreach"
  },
  parentTraces: ["trace_support_12345", "trace_health_67890"]
}
```

**Emergent Coordination**: Churn Agent discovered BOTH Support and Health traces independently. No one orchestrated this - it emerged from agents querying shared context.

---

## Technical Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  INGESTION LAYER (Queue Consumers)                          │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐│
│  │ SupportQueue   │  │ HealthQueue    │  │ ChurnQueue    ││
│  │ Consumer       │  │ Consumer       │  │ Consumer      ││
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘│
└───────────┼────────────────────┼──────────────────┼─────────┘
            │                    │                  │
┌───────────▼────────────────────▼──────────────────▼─────────┐
│  AGENT LAYER (Stateless Workers)                            │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐│
│  │ SupportAgent   │  │ HealthAgent    │  │ ChurnAgent    ││
│  │ Worker         │  │ Worker         │  │ Worker        ││
│  │                │  │                │  │               ││
│  │ 1. Query ctx   │  │ 1. Query ctx   │  │ 1. Query ctx  ││
│  │ 2. Analyze     │  │ 2. Calculate   │  │ 2. Pattern    ││
│  │ 3. Deposit     │  │ 3. Deposit     │  │ 3. Deposit    ││
│  └────────┬───────┘  └────────┬───────┘  └───────┬───────┘│
└───────────┼────────────────────┼──────────────────┼─────────┘
            │                    │                  │
┌───────────▼────────────────────▼──────────────────▼─────────┐
│  CONTEXT GRAPH LAYER (Regional Durable Objects)             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AccountContextGraph (EU Region)                      │  │
│  │                                                       │  │
│  │ Methods:                                              │  │
│  │  • depositTrace(trace)                               │  │
│  │  • queryTraces(entityId, timeRange, agentType?)      │  │
│  │  • calculateDecay()                                   │  │
│  │  • replicateToKV()                                    │  │
│  │                                                       │  │
│  │ Storage:                                              │  │
│  │  traces: Map<traceId, Trace>                         │  │
│  │  indexes:                                             │  │
│  │    - byTimestamp: SortedIndex                        │  │
│  │    - byEntity: Map<entityId, traceId[]>              │  │
│  │    - byAgent: Map<agentType, traceId[]>              │  │
│  └──────────────────┬───────────────────────────────────┘  │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      │ replicateToKV()
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  PROPAGATION LAYER (KV Namespaces)                          │
│                                                              │
│  EU KV Namespace                    US KV Namespace         │
│  ┌───────────────────┐              ┌───────────────────┐  │
│  │ eu:accounts:abc:* │─────────────▶│ us:accounts:abc:* │  │
│  │ (filtered by      │ Async repl   │ (receives global  │  │
│  │  jurisdiction)    │ ~30 seconds  │  traces only)     │  │
│  └───────────────────┘              └───────────────────┘  │
│          ▲                                    │              │
│          │                                    │              │
│          │                                    ▼              │
│  ┌───────┴───────────┐              ┌───────────────────┐  │
│  │ SyncWorker (EU)   │              │ SyncWorker (US)   │  │
│  │ Polls US KV       │              │ Polls EU KV       │  │
│  │ every 30s         │              │ every 30s         │  │
│  └───────────────────┘              └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  DECAY & ARCHIVAL LAYER                                     │
│                                                              │
│  ┌────────────────┐           ┌──────────────────────────┐ │
│  │ DecayWorker    │──────────▶│ R2 Bucket (Archive)      │ │
│  │ (scheduled)    │ Expired   │                          │ │
│  │                │ traces    │ accounts/2026/02/13/     │ │
│  │ Every 15 min   │           │   trace_xxx.json         │ │
│  └────────────────┘           └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Data Model

```typescript
// src/shared/types/trace.types.ts

export interface Trace {
  // Identity
  id: string;                          // Unique trace ID
  namespace: string;                   // Context domain (accounts, tickets, etc.)
  entityId: string;                    // Subject of trace (account ID, etc.)
  agentType: string;                   // Source agent type

  // Temporal
  timestamp: number;                   // Creation time (Unix ms)
  decayHalfLife: number;              // Time until 50% strength (ms)

  // Stigmergic properties
  reinforcementWeight: number;         // How strongly this reinforces (1.0 = normal)

  // Compliance
  jurisdictionConstraints: string[];   // ["EU", "US"] or [] for global

  // Content
  payload: Record<string, unknown>;    // Agent-specific data

  // Lineage
  parentTraces: string[];              // Traces that led to this one
}

export interface TraceQuery {
  namespace: string;
  entityId?: string;                   // Specific entity or all
  agentTypes?: string[];               // Filter by agent types
  timeRange?: {
    start: number;
    end: number;
  };
  includeDecayed?: boolean;            // Include expired traces?
}

export interface TraceDecayConfig {
  halfLife: number;                    // Base half-life in ms
  decayFunction: 'exponential' | 'linear';
  reinforcementBonus: number;          // Strength gain per reinforcement
}
```

### Context Graph Implementation

```typescript
// src/server/persistence/context/AccountContextGraph.ts

import { BaseDO } from '../base/BaseDO';
import type { Trace, TraceQuery } from '@/shared/types/trace.types';

export class AccountContextGraph extends BaseDO {
  private traces = new Map<string, Trace>();
  private entityIndex = new Map<string, Set<string>>(); // entityId → traceIds
  private timestampIndex: Array<{ timestamp: number; traceId: string }> = [];

  /**
   * Deposit a new trace into the context graph
   */
  async depositTrace(trace: Trace): Promise<void> {
    // Store trace
    this.traces.set(trace.id, trace);
    await this.set(`trace:${trace.id}`, trace);

    // Update indexes
    this.updateIndexes(trace);

    // Check replication threshold
    if (this.shouldReplicate(trace)) {
      await this.replicateToKV(trace);
    }

    // Trigger conditional agents
    await this.checkTriggers(trace);
  }

  /**
   * Query traces matching criteria
   */
  async queryTraces(query: TraceQuery): Promise<Trace[]> {
    let candidates: string[] = [];

    // Filter by entity if specified
    if (query.entityId) {
      candidates = Array.from(this.entityIndex.get(query.entityId) || []);
    } else {
      // All traces in namespace
      const allTraces = await this.list<Trace>(`trace:`);
      candidates = Array.from(allTraces.keys()).map(k => k.replace('trace:', ''));
    }

    // Apply filters
    let results = candidates
      .map(id => this.traces.get(id)!)
      .filter(trace => {
        // Time range
        if (query.timeRange) {
          if (trace.timestamp < query.timeRange.start ||
              trace.timestamp > query.timeRange.end) {
            return false;
          }
        }

        // Agent types
        if (query.agentTypes && !query.agentTypes.includes(trace.agentType)) {
          return false;
        }

        // Decay check
        if (!query.includeDecayed && this.isDecayed(trace)) {
          return false;
        }

        return true;
      });

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    return results;
  }

  /**
   * Calculate trace strength considering decay
   */
  private calculateStrength(trace: Trace): number {
    const age = Date.now() - trace.timestamp;
    const halfLives = age / trace.decayHalfLife;
    return trace.reinforcementWeight * Math.pow(0.5, halfLives);
  }

  /**
   * Check if trace has decayed below threshold
   */
  private isDecayed(trace: Trace): boolean {
    return this.calculateStrength(trace) < 0.1; // 10% threshold
  }

  /**
   * Replicate high-priority traces to KV for cross-region propagation
   */
  private async replicateToKV(trace: Trace): Promise<void> {
    const region = this.getRegion(); // 'eu' or 'us'
    const key = `${region}:${trace.namespace}:${trace.entityId}:${trace.timestamp}`;

    // Filter by jurisdiction
    if (trace.jurisdictionConstraints.length > 0) {
      // Only replicate to allowed regions
      if (!trace.jurisdictionConstraints.includes(region.toUpperCase())) {
        return;
      }
    }

    const env = (this as any).env;
    await env.TRACE_KV.put(key, JSON.stringify(trace), {
      expirationTtl: trace.decayHalfLife / 1000 // Convert to seconds
    });
  }

  /**
   * Check if trace should trigger other agents
   */
  private async checkTriggers(trace: Trace): Promise<void> {
    // Example: Health degradation triggers churn analysis
    if (trace.agentType === 'health-monitor') {
      const health = (trace.payload as any).healthScore;
      if (health < 50) {
        const env = (this as any).env;
        await env.CHURN_QUEUE.send({
          type: 'health-alert',
          entityId: trace.entityId,
          triggerTrace: trace.id
        });
      }
    }
  }

  private updateIndexes(trace: Trace): void {
    // Entity index
    if (!this.entityIndex.has(trace.entityId)) {
      this.entityIndex.set(trace.entityId, new Set());
    }
    this.entityIndex.get(trace.entityId)!.add(trace.id);

    // Timestamp index (sorted)
    this.timestampIndex.push({ timestamp: trace.timestamp, traceId: trace.id });
    this.timestampIndex.sort((a, b) => b.timestamp - a.timestamp);
  }

  private shouldReplicate(trace: Trace): boolean {
    // High-priority traces replicate immediately
    return trace.reinforcementWeight >= 1.5;
  }

  private getRegion(): string {
    // Detect region from DO location
    // For now, hardcode (in prod, use cf.colo or deployment config)
    return 'us';
  }
}
```

### Agent Worker Implementation

```typescript
// src/server/agents/support/SupportAgent.ts

import type { Trace } from '@/shared/types/trace.types';

export interface SupportTicket {
  id: string;
  accountId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export class SupportAgentWorker {
  async processTicket(
    ticket: SupportTicket,
    env: Env
  ): Promise<void> {
    // 1. Get context graph
    const accountGraph = this.getAccountGraph(ticket.accountId, env);

    // 2. Query recent history
    const recentTraces = await accountGraph.queryTraces({
      namespace: 'accounts',
      entityId: ticket.accountId,
      timeRange: {
        start: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
        end: Date.now()
      }
    });

    // 3. Analyze sentiment with context
    const sentiment = await this.analyzeSentiment(
      ticket.content,
      recentTraces
    );

    // 4. Extract topics
    const topics = this.extractTopics(ticket.content);

    // 5. Determine urgency
    const urgency = this.calculateUrgency(sentiment, topics, recentTraces);

    // 6. Deposit trace
    const trace: Trace = {
      id: `trace_support_${crypto.randomUUID()}`,
      namespace: 'accounts',
      entityId: ticket.accountId,
      agentType: 'support-analyzer',
      timestamp: Date.now(),
      decayHalfLife: 72 * 60 * 60 * 1000, // 72 hours
      reinforcementWeight: urgency === 'high' ? 1.5 : 1.0,
      jurisdictionConstraints: this.determineJurisdiction(ticket),
      payload: {
        sentiment,
        topics,
        urgency,
        ticketId: ticket.id
      },
      parentTraces: []
    };

    await accountGraph.depositTrace(trace);

    // Worker terminates - no further coordination
  }

  private async analyzeSentiment(
    content: string,
    context: Trace[]
  ): Promise<number> {
    // Sentiment analysis logic
    // Could use Workers AI for this
    const env = (this as any).env;
    const response = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
      text: content
    });

    // Return score between -1 and 1
    return response.score;
  }

  private extractTopics(content: string): string[] {
    // Topic extraction logic
    const keywords = ['billing', 'cancellation', 'feature', 'bug', 'support'];
    return keywords.filter(k => content.toLowerCase().includes(k));
  }

  private calculateUrgency(
    sentiment: number,
    topics: string[],
    history: Trace[]
  ): 'low' | 'medium' | 'high' {
    // Check for cancellation intent
    if (topics.includes('cancellation')) return 'high';

    // Check for repeated negative sentiment
    const recentNegative = history.filter(t =>
      t.agentType === 'support-analyzer' &&
      (t.payload as any).sentiment < -0.5
    ).length;

    if (sentiment < -0.7 || recentNegative >= 3) return 'high';
    if (sentiment < -0.3 || recentNegative >= 1) return 'medium';
    return 'low';
  }

  private determineJurisdiction(ticket: SupportTicket): string[] {
    // GDPR check based on account location
    const region = (ticket.metadata as any).region;
    return region === 'EU' ? ['EU'] : [];
  }

  private getAccountGraph(accountId: string, env: Env): any {
    const id = env.ACCOUNT_CONTEXT_GRAPH.idFromName(accountId);
    return env.ACCOUNT_CONTEXT_GRAPH.get(id);
  }
}
```

---

## Project Structure

### Updated Directory Layout

```
src/
├── client/                          # Frontend (unchanged)
│   └── ... (existing CRM UI)
│
├── server/
│   ├── gateway/                     # Entry points
│   │   ├── queue-consumer.ts       # NEW: Queue message routing
│   │   └── ... (existing handlers)
│   │
│   ├── agents/                      # Agent workers
│   │   ├── support/
│   │   │   ├── SupportAgent.ts     # NEW: Sentiment analysis worker
│   │   │   └── sentiment.ts        # Sentiment logic
│   │   ├── health/
│   │   │   ├── HealthAgent.ts      # NEW: Health monitoring worker
│   │   │   └── scoring.ts          # Health calculation
│   │   ├── churn/
│   │   │   ├── ChurnAgent.ts       # NEW: Churn prediction worker
│   │   │   └── patterns.ts         # Pattern matching
│   │   └── chat/                    # Existing chat agent
│   │       └── ... (keep for UI)
│   │
│   ├── persistence/
│   │   ├── context/                 # NEW: Context graphs
│   │   │   ├── AccountContextGraph.ts
│   │   │   ├── TicketContextGraph.ts
│   │   │   └── HealthContextGraph.ts
│   │   ├── crm/                     # Existing CRM DOs
│   │   │   └── ... (ContactDO, OpportunityDO)
│   │   └── base/
│   │       └── BaseDO.ts
│   │
│   ├── services/
│   │   ├── trace/                   # NEW: Trace operations
│   │   │   ├── decay-calculator.ts
│   │   │   ├── replication.ts
│   │   │   └── lineage-tracker.ts
│   │   └── ... (existing services)
│   │
│   └── workers/                     # NEW: Scheduled workers
│       ├── decay-processor.ts       # Trace cleanup
│       ├── sync-worker.ts           # Cross-region KV sync
│       └── health-scheduler.ts      # Periodic health checks
│
└── shared/
    ├── types/
    │   ├── trace.types.ts           # NEW: Trace definitions
    │   └── ... (existing types)
    └── constants/
        └── decay-configs.ts          # NEW: Half-life constants
```

---

## Migration Path: From Centralized to Distributed

### Current CRM → Distributed MVP Evolution

| Component | Current (Centralized) | Phase 1 (Hybrid) | Phase 2 (Distributed) |
|-----------|----------------------|------------------|----------------------|
| **User Chat** | ChatAgent DO (sync) | Keep as-is | Keep for UI, add trace deposits |
| **CRM Operations** | Direct tool calls | Keep as-is | Tools deposit traces |
| **Agent Coordination** | Single agent | Add Health/Churn agents | Full stigmergic network |
| **Memory** | Session messages | Add trace storage | Traces as primary memory |
| **Cross-Region** | None | Add KV replication | Full regional autonomy |

### Phase 1: Add Trace Infrastructure (Weeks 7-8)

Build trace system alongside existing CRM:

1. **Create Context Graph DOs**
   - `AccountContextGraph` with trace deposit/query
   - Keep existing `ContactDO`, `OpportunityDO` unchanged

2. **Implement Trace Schema**
   - Define `Trace` type in `shared/types/`
   - Add decay calculation utilities

3. **Build First Agent: Support Analyzer**
   - Create `SupportAgent` worker
   - Deposit traces when tickets processed
   - Existing chat still works normally

4. **Validate**: Support agent deposits traces, queryable via admin UI

### Phase 2: Add Autonomous Agents (Weeks 9-10)

Introduce agents that discover traces:

1. **Health Monitor Agent**
   - Scheduled worker (hourly)
   - Queries support traces
   - Deposits health scores

2. **Churn Predictor Agent**
   - Triggered by health degradation
   - Pattern matches across traces
   - Deposits churn predictions

3. **Validate**: Traces propagate autonomously, lineage trackable

### Phase 3: Cross-Region Propagation (Weeks 11-12)

Add geographic distribution:

1. **KV Replication**
   - High-priority traces → KV
   - Sync workers pull from remote regions
   - Jurisdiction filtering

2. **Regional Isolation**
   - EU traces stay in EU unless global
   - US traces propagate freely
   - Graceful degradation when regions disconnected

3. **Validate**: EU ticket → US churn prediction within 60s

---

## Success Criteria

### MVP Demonstrates

1. **Autonomous Coordination**
   - Support trace in EU triggers churn prediction in US
   - No centralized orchestrator
   - Full lineage traceable

2. **Graceful Degradation**
   - Disconnect US-EU link
   - EU agents continue operating
   - Reconnect → automatic sync
   - No data loss

3. **Stigmergic Properties**
   - Traces decay naturally (72-336 hour half-lives)
   - Signals reinforce when overlapping
   - Stale context expires automatically

4. **Compliance**
   - EU PII traces don't propagate to US
   - US traces visible in EU
   - Asymmetric sovereignty enforced

5. **Observability**
   - Admin query: "Why did account X get flagged for churn?"
   - Response: Trace lineage showing signal path across 3 agents
   - No centralized logs needed

---

## Development Milestones

### Week 7: Trace Foundation
- [ ] Create `Trace` type definitions
- [ ] Implement `AccountContextGraph` DO
- [ ] Build trace deposit/query methods
- [ ] Add decay calculation utilities
- [ ] HTTP endpoints for manual testing

### Week 8: Support Agent
- [ ] Create `SupportAgent` worker
- [ ] Implement sentiment analysis
- [ ] Topic extraction logic
- [ ] Queue integration
- [ ] Trace deposit on ticket processing

### Week 9: Health Agent
- [ ] Create `HealthAgent` worker
- [ ] Scheduled trigger (hourly)
- [ ] Multi-trace query implementation
- [ ] Health score calculation
- [ ] Trace deposit with lineage

### Week 10: Churn Agent
- [ ] Create `ChurnAgent` worker
- [ ] Conditional trigger (health threshold)
- [ ] Pattern matching across traces
- [ ] Churn probability calculation
- [ ] High-priority trace deposit

### Week 11: Cross-Region Setup
- [ ] Deploy to second region (EU)
- [ ] KV namespace configuration
- [ ] Replication logic
- [ ] Jurisdiction filtering
- [ ] Sync worker implementation

### Week 12: Integration & Testing
- [ ] End-to-end flow validation
- [ ] Failover testing (disconnect regions)
- [ ] Administrative dashboard
- [ ] Performance optimization
- [ ] Documentation

---

## Technical Flows

### End-to-End Example: EU Ticket → US Churn Prediction

```
T+0s:  Customer in Germany submits angry support ticket
       └─> SupportQueue receives message

T+1s:  SupportAgent Worker (EU) processes ticket
       ├─ Queries AccountContextGraph (EU) for history
       ├─ Sentiment analysis: -0.85 (very negative)
       ├─ Topics: ["billing", "cancellation"]
       ├─ Urgency: high
       └─> Deposits trace to AccountContextGraph (EU)

T+2s:  AccountContextGraph (EU) stores trace
       ├─ High urgency → reinforcementWeight = 1.5
       ├─ Customer is in EU → jurisdictionConstraints = ["EU"]
       └─> Does NOT replicate to KV (EU-only trace)

T+60s: HealthAgent Worker (EU) scheduled run
       ├─ Queries AccountContextGraph (EU)
       ├─ Discovers new support trace
       ├─ Calculates health: previous=75%, new=45% (drop)
       └─> Deposits health trace
           ├─ Global scope → jurisdictionConstraints = []
           └─> Replicates to EU_KV (high priority)

T+90s: SyncWorker (US) polls EU_KV
       ├─ Discovers new health trace
       ├─ Validates jurisdiction (global = OK)
       └─> Writes to AccountContextGraph (US)

T+91s: AccountContextGraph (US) receives health trace
       ├─ Health drop detected (75% → 45%)
       └─> Triggers ChurnQueue

T+92s: ChurnAgent Worker (US) processes trigger
       ├─ Queries AccountContextGraph (US)
       ├─ Discovers health trace (just arrived)
       ├─ Queries for supporting signals (30-day window)
       ├─ Pattern match: health drop + billing topic
       ├─ Calculates churnProbability = 0.92
       └─> Deposits churn trace
           ├─ High priority → replicates to US_KV
           └─> Propagates back to EU

T+120s: SyncWorker (EU) polls US_KV
        ├─ Discovers churn prediction
        └─> Writes to AccountContextGraph (EU)

T+121s: AccountContextGraph (EU) receives churn trace
        └─> Could trigger retention workflow (future)

Total: 121 seconds from ticket to cross-region churn prediction
```

**Key Point**: No agent told any other agent to do anything. Each acted autonomously based on discovered traces.

---

## Benefits Over Centralized Orchestration

### Resilience

**Centralized**:
```
Router fails → All agents blocked
Network partition → No coordination
```

**Distributed**:
```
EU disconnected from US → EU agents continue
Reconnect → Automatic sync
No data loss, no manual intervention
```

### Scalability

**Centralized**:
```
Router becomes bottleneck
Must scale orchestrator vertically
Single point of failure
```

**Distributed**:
```
Agents scale independently
Regional isolation = horizontal scaling
Failure isolated to one agent type
```

### Compliance

**Centralized**:
```
Complex logic to route data
Risk of accidental cross-border transfer
```

**Distributed**:
```
Jurisdiction constraints in traces
Automatic filtering in KV replication
Enforcement at data level
```

---

## Next Steps

1. **Review this MVP document**
2. **Complete Phase 1-6** (base architecture refactoring)
3. **Begin Phase 7** (trace infrastructure)
4. **Validate each milestone** before proceeding
5. **Deploy to production** in Week 12

---

**Status**: 📝 Design Document
**Author**: Claude Code
**Date**: 2026-02-13
**Version**: 1.0
**Dependencies**: ARCHITECTURE_PROPOSAL.md, MIGRATION_GUIDE.md
