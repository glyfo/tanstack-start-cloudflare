# SuperHuman CRM: Project Roadmap
## From Monolith to Distributed Stigmergic Agents

**Last Updated**: 2026-02-13

---

## 🎯 Vision Overview

Transform the SuperHuman CRM from a **centralized monolithic chat application** into a **distributed network of autonomous agents** that coordinate through environmental traces rather than direct messaging.

### Current State
```
User ──> ChatEngine (1,467 lines) ──> ChatAgent (2,048 lines) ──> Response
          └─ Monolithic, tightly coupled, hard to maintain
```

### Target State (Week 12)
```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Cloudflare Pages)                                │
│  ChatEngine (200 lines) + Forms + Cards                     │
└────────────────┬────────────────────────────────────────────┘
                 │ WebSocket
┌────────────────▼────────────────────────────────────────────┐
│  Gateway (Workers)                                           │
│  WebSocket Handler + API Router + Queue Consumer            │
└────────┬────────────────────────────────────────────────────┘
         │
    ┌────┴────┬─────────┬─────────┬─────────┐
    │         │         │         │         │
┌───▼───┐ ┌──▼──┐ ┌───▼───┐ ┌───▼───┐ ┌──▼──┐
│Support│ │Health│ │ Churn │ │ Chat  │ │Sales│
│ Agent │ │Agent │ │ Agent │ │ Agent │ │Agent│
│(EU)   │ │(US)  │ │ (US)  │ │ (Any) │ │(Any)│
└───┬───┘ └──┬───┘ └───┬───┘ └───┬───┘ └──┬──┘
    │        │         │         │        │
    └────────┴─────────┴─────────┴────────┘
                      │
        ┌─────────────▼──────────────┐
        │ Context Graphs (DOs)       │
        │ - Traces with decay        │
        │ - Regional isolation       │
        │ - KV propagation           │
        └────────────────────────────┘

Autonomous coordination, emergent patterns, graceful degradation
```

---

## 📅 12-Week Roadmap

### **Phase 1: Refactoring Foundation** (Weeks 1-6)

**Goal**: Clean up architecture, reduce token consumption, enable independent deployment

#### Week 1: Foundation
- [MIGRATION_GUIDE.md § Phase 1](./MIGRATION_GUIDE.md#phase-1-foundation-week-1)
- Create new directory structure (`client/`, `server/gateway/`, `server/agents/`, etc.)
- Move shared types to `src/shared/`
- Create `BaseDO` abstract class
- Create `SessionManager` interface

#### Week 2: Gateway
- [MIGRATION_GUIDE.md § Phase 2](./MIGRATION_GUIDE.md#phase-2-extract-gateway-week-2)
- Extract gateway layer (`websocket-handler.ts`, `api-router.ts`)
- Clean entry point routing
- Update `entry.cloudflare.ts`

#### Week 3: ChatAgent Refactor
- [MIGRATION_GUIDE.md § Phase 3](./MIGRATION_GUIDE.md#phase-3-refactor-chatagent-week-3)
- Split `chat-agent.ts` (2,048 lines → 4 files × 400 lines)
- Extract prompts, handler, state machine
- Keep core agent slim

#### Week 4: Memory Layer
- [MIGRATION_GUIDE.md § Phase 4](./MIGRATION_GUIDE.md#phase-4-memory-layer-week-4)
- Create `SessionManager` implementation
- Implement context compaction
- Add long-term memory (cross-session)

#### Week 5: Client Separation
- [MIGRATION_GUIDE.md § Phase 5](./MIGRATION_GUIDE.md#phase-5-client-separation-week-5)
- Move all client code to `src/client/`
- Configure separate build for Pages deployment
- Ensure client only imports from `src/shared/`

#### Week 6: Tool Registry Enhancement
- [MIGRATION_GUIDE.md § Phase 6](./MIGRATION_GUIDE.md#phase-6-tool-registry-enhancement-week-6)
- Add direct tool invocation (MCP Apps pattern)
- Update gateway to handle `tool-invoke` messages
- Create `useInvokeTool` hook

**Milestone**: Clean modular architecture, 85% token savings, independent deployment

---

### **Phase 2: Distributed Agent System** (Weeks 7-12)

**Goal**: Autonomous agents coordinating through stigmergic traces

#### Week 7: Trace Infrastructure
- [DISTRIBUTED_AGENT_MVP.md § Technical Architecture](./DISTRIBUTED_AGENT_MVP.md#technical-architecture)
- [MIGRATION_GUIDE.md § Phase 7](./MIGRATION_GUIDE.md#phase-7-trace-infrastructure-week-7)
- Define `Trace` type with decay properties
- Implement `AccountContextGraph` DO
- Create trace deposit/query methods
- Admin endpoints for testing

#### Week 8: Support Agent Worker
- [DISTRIBUTED_AGENT_MVP.md § Support Agent](./DISTRIBUTED_AGENT_MVP.md#1-support-agent-sentiment-analysis)
- [MIGRATION_GUIDE.md § Phase 8](./MIGRATION_GUIDE.md#phase-8-support-agent-worker-week-8)
- Create Support Queue
- Implement sentiment analysis worker
- Deposit traces on ticket processing
- Queue consumer integration

#### Week 9: Health Agent
- [DISTRIBUTED_AGENT_MVP.md § Health Agent](./DISTRIBUTED_AGENT_MVP.md#2-health-agent-account-wellness)
- [MIGRATION_GUIDE.md § Phase 9](./MIGRATION_GUIDE.md#phase-9-health-agent-week-9)
- Scheduled worker (hourly)
- Query support traces autonomously
- Calculate health scores
- Deposit traces with lineage

#### Week 10: Churn Agent
- [DISTRIBUTED_AGENT_MVP.md § Churn Agent](./DISTRIBUTED_AGENT_MVP.md#3-churn-agent-retention-risk)
- [MIGRATION_GUIDE.md § Phase 10](./MIGRATION_GUIDE.md#phase-10-churn-agent-week-10)
- Conditional trigger (health degradation)
- Pattern match across multiple traces
- Deposit churn predictions
- High-priority trace propagation

#### Week 11: Cross-Region Propagation
- [DISTRIBUTED_AGENT_MVP.md § Cross-Region](./DISTRIBUTED_AGENT_MVP.md#cross-region-propagation)
- [MIGRATION_GUIDE.md § Phase 11](./MIGRATION_GUIDE.md#phase-11-cross-region-propagation-week-11)
- Deploy to EU region
- KV namespace for trace replication
- Sync worker (30s polling)
- Jurisdiction constraint enforcement

#### Week 12: Integration & Dashboard
- [DISTRIBUTED_AGENT_MVP.md § Success Criteria](./DISTRIBUTED_AGENT_MVP.md#success-criteria)
- [MIGRATION_GUIDE.md § Phase 12](./MIGRATION_GUIDE.md#phase-12-integration--dashboard-week-12)
- Trace lineage API
- Admin dashboard (trace timeline)
- End-to-end testing
- Performance optimization

**Milestone**: EU ticket → US churn prediction in <120s, full autonomous coordination

---

## 📊 Success Metrics

### Phase 1 (Refactoring)

| Metric | Current | Target | Achieved? |
|--------|---------|--------|-----------|
| Max file size | 2,048 lines | 400 lines | ⬜ |
| ChatEngine lines | 1,467 | 200 | ⬜ |
| Token cost (bug fix) | ~8k | <2k | ⬜ |
| Build time | ~45s | <30s | ⬜ |
| Modules | 5 (flat) | 8 (layered) | ⬜ |
| Independent deploy | ❌ | ✅ | ⬜ |

### Phase 2 (Distributed)

| Metric | Target | Achieved? |
|--------|--------|-----------|
| Autonomous coordination | EU ticket → US prediction | ⬜ |
| Coordination time | <120 seconds | ⬜ |
| Trace lineage | Full path visible | ⬜ |
| Graceful degradation | EU-only mode works | ⬜ |
| GDPR compliance | EU traces stay in EU | ⬜ |
| Trace decay | Natural expiration | ⬜ |

---

## 🗂️ Documentation Index

### Main Documents

1. **[ARCHITECTURE_PROPOSAL.md](./ARCHITECTURE_PROPOSAL.md)** ⭐
   - Complete vision (Phase 1 + Phase 2)
   - Comparison tables
   - Benefits analysis

2. **[DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md)** ⭐
   - Phase 2 detailed design
   - Stigmergic coordination explained
   - Technical flows
   - Data models

3. **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** ⭐
   - Step-by-step implementation
   - All 12 phases with code examples
   - Validation checklists

4. **[ARCHITECTURE_QUICK_REF.md](./ARCHITECTURE_QUICK_REF.md)**
   - Developer cheat sheet
   - Import rules
   - Common patterns

5. **[PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md)** (this file)
   - High-level timeline
   - Success metrics
   - Navigation guide

### Supporting Documents

- **[../README.md](../README.md)** - Current project README
- **[UI_DESIGN_GUIDELINES.md](./reference/UI_DESIGN_GUIDELINES.md)** - Design system
- **[MCP_APPS_PATTERN.md](./guides/MCP_APPS_PATTERN.md)** - Direct tool invocation

---

## 🚀 Getting Started

### 1. Review Documents (Today)

Read in this order:
1. This roadmap (you're here!)
2. [ARCHITECTURE_PROPOSAL.md](./ARCHITECTURE_PROPOSAL.md) - Understand the vision
3. [DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md) - See where we're going
4. [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - How to get there

### 2. Set Up Tracking (Day 1)

```bash
# Create GitHub project
gh project create "CRM Refactoring"

# Add milestones
gh milestone create "Phase 1: Refactoring" --due 2026-03-26
gh milestone create "Phase 2: Distributed Agents" --due 2026-05-07
```

### 3. Start Phase 1 (Week 1)

```bash
# Navigate to project
cd /Users/alex/workspaces/tanstack-start-cloudflare

# Create feature branch
git checkout -b feature/phase-1-foundation

# Follow Phase 1 steps in MIGRATION_GUIDE.md
```

---

## 🎓 Key Concepts

### Stigmergy
Coordination through environmental modification rather than direct communication. Like ants using pheromones to guide each other without talking.

**Example**:
- SupportAgent deposits negative sentiment trace
- HealthAgent discovers trace, recalculates health
- ChurnAgent discovers health drop, predicts churn
- No agent told any other agent to do anything!

### Trace Decay
Traces have half-lives (72-336 hours). Old signals fade unless reinforced.

**Example**:
- Single negative ticket → fades in 3 days
- Multiple negative tickets → reinforce each other
- Pattern persists → triggers churn prediction

### Regional Autonomy
Agents operate in regional DOs, coordinate via KV.

**Example**:
- EU support agent works even if US is down
- When US reconnects, traces sync automatically
- No manual intervention needed

### Jurisdiction Constraints
Traces carry compliance rules.

**Example**:
- EU customer PII → `jurisdictionConstraints: ["EU"]`
- Stays in EU, never replicates to US
- GDPR compliant by design

---

## ❓ FAQs

### Q: Can we skip Phase 1 and go straight to distributed agents?

**A**: No. Phase 1 creates the foundation:
- Clean module boundaries
- Storage abstractions
- Gateway pattern
- Tool registry

Without this, Phase 2 becomes chaotic.

### Q: Can we do Phase 1 faster than 6 weeks?

**A**: Yes, if you're willing to take risks:
- **Aggressive**: 3 weeks (risky, might break things)
- **Recommended**: 6 weeks (safe, well-tested)
- **Conservative**: 8 weeks (includes buffer time)

### Q: Is Phase 2 optional?

**A**: Yes! Phase 1 already delivers huge value:
- 85% token savings
- Independent deployment
- Easier maintenance

Phase 2 adds:
- Regional autonomy
- Graceful degradation
- Emergent patterns

### Q: What if we only have 1 region?

**A**: Phase 2 still works! Benefits:
- Autonomous agents (no orchestrator)
- Trace-based memory (better than session logs)
- Natural decay (auto-cleanup)
- Scalability (agents scale independently)

Just skip cross-region KV sync.

### Q: Can we mix centralized and distributed?

**A**: Yes! Hybrid architecture:
- ChatAgent stays centralized (for UI)
- Support/Health/Churn agents distributed
- Best of both worlds

---

## 🔗 Quick Links

| Document | Purpose | Read When |
|----------|---------|-----------|
| [ARCHITECTURE_PROPOSAL.md](./ARCHITECTURE_PROPOSAL.md) | Full vision | Planning |
| [DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md) | Phase 2 details | Week 6 |
| [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) | Implementation steps | During work |
| [ARCHITECTURE_QUICK_REF.md](./ARCHITECTURE_QUICK_REF.md) | Cheat sheet | Daily coding |
| [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) | Timeline & metrics | Weekly reviews |

---

## 📞 Support

**Questions about**:
- **Architecture**: See [ARCHITECTURE_PROPOSAL.md](./ARCHITECTURE_PROPOSAL.md)
- **Implementation**: See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- **Distributed agents**: See [DISTRIBUTED_AGENT_MVP.md](./DISTRIBUTED_AGENT_MVP.md)
- **Daily coding**: See [ARCHITECTURE_QUICK_REF.md](./ARCHITECTURE_QUICK_REF.md)

---

**Status**: 📝 Proposal
**Next Action**: Review documents, get team approval, start Phase 1
**Timeline**: 12 weeks (flexible)
**Risk Level**: Low (Phase 1), Medium (Phase 2)

---

**Last Updated**: 2026-02-13
**Version**: 1.0
