/**
 * Agent Memory Types
 * Based on Discord/Letta agent pattern with memory blocks
 * Each agent has specialized memory blocks that persist across conversations
 */

export interface MemoryBlock {
  label: string;
  description: string;
  value: string;
  limit: number; // Max bytes for this block
  readOnly?: boolean;
  lastUpdated?: string;
}

export interface AgentMemoryState {
  agentRole: "router" | "support" | "csm" | "ae" | "sdr";
  blocks: MemoryBlock[];
  updatedAt: string;
}

// Router Agent Memory Blocks
export const ROUTER_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "interaction_history",
    description:
      "Complete user conversation history for context and decision-making",
    value: "",
    limit: 5000,
  },
  {
    label: "current_agent_assignment",
    description:
      "Which specialized agent is currently handling the conversation",
    value: "agent: none\nassigned_at: null\nreason: initial",
    limit: 1000,
    readOnly: false,
  },
  {
    label: "escalation_rules",
    description: "Conditions that trigger human intervention",
    value: `Escalate to human if:
- Customer sentiment: Angry/Very Upset
- Issue resolution time: > 2 hours
- Multiple failed resolution attempts: > 2
- Request type: Special request, contract negotiation
- Budget: Deal value > $100k (requires VP approval)
- Customer value: High-value customer flagged
- Conflict: Between support and customer
- Safety: Potential security/compliance issue`,
    limit: 1500,
    readOnly: true,
  },
  {
    label: "agent_capabilities",
    description: "What each agent can and cannot handle",
    value: `Support Agent: Bug fixes, how-to, technical issues
CSM Agent: Expansion, upsell, feature requests, satisfaction
AE Agent: Pricing, negotiation, deal structuring, contracts
SDR Agent: Lead qualification, meeting booking, discovery

Cannot cross boundaries:
- SDR handles leads only (pre-sale)
- AE handles prospects in pipeline (negotiation)
- CSM handles customers only (post-sale)
- Support handles operational issues (all)`,
    limit: 2000,
    readOnly: true,
  },
];

// Support Agent Memory Blocks
export const SUPPORT_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "current_issue",
    description: "The active technical issue being addressed",
    value: `status: none
issue_type: unknown
error_message: ''
first_reported: null
attempts: 0
customer_environment: ''`,
    limit: 2000,
  },
  {
    label: "known_solutions",
    description: "Library of known issues and their solutions",
    value: `API Timeout (5xx):
  - Check rate limiting
  - Verify webhook retries
  - Review auth token expiration
  - Solution: Implement exponential backoff

Database Connection:
  - Verify connection string
  - Check IP whitelist
  - Restart connection pool
  - Solution: Use connection pooling

CORS Errors:
  - Add to allowed origins
  - Check preflight requests
  - Verify credentials flag
  - Solution: Review CORS config`,
    limit: 3000,
  },
  {
    label: "customer_context",
    description: "This customer history and patterns",
    value: `previous_issues: 0
last_issue_date: null
technical_level: unknown
product_tier: standard
integration_type: unknown
sla_level: standard`,
    limit: 1000,
  },
  {
    label: "issue_patterns",
    description: "Common issues seen across customer base",
    value: `Most common (80% of tickets):
1. Authentication/Token issues (40%)
2. Rate limiting (25%)
3. Configuration/Setup (15%)

Pattern: Issues spike on Mondays 9am-12pm UTC
Pattern: Enterprise customers 2x issue rate (higher complexity)
Pattern: Self-service resolution rate: 85% for tier-1`,
    limit: 1500,
  },
];

// CSM Agent Memory Blocks
export const CSM_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "customer_health",
    description: "Overall customer health score and status",
    value: `health_score: 0/100
status: unknown
churn_risk: none
nrr_impact: 0%
last_interaction: null
quarterly_review: null`,
    limit: 500,
  },
  {
    label: "onboarding_progress",
    description: "Customer onboarding stage and completion",
    value: `stage: not_started
modules_completed: 0
modules_total: 5
blocking_issues: none
time_to_first_value: unknown
adoption_rate: 0%`,
    limit: 1000,
  },
  {
    label: "expansion_opportunities",
    description: "Potential upsells and expansion revenue",
    value: `opportunity_1: null
opportunity_2: null
opportunity_3: null
expansion_ready: false
expansion_target_revenue: 0
previous_expansions: 0`,
    limit: 1500,
  },
  {
    label: "risk_signals",
    description: "Early warnings of potential churn or issues",
    value: `support_tickets_last_month: 0
declining_usage: false
low_engagement: false
negative_sentiment: false
competitor_threat: false
payment_issues: false
last_escalation: null`,
    limit: 1000,
  },
];

// AE Agent Memory Blocks
export const AE_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "deal_structure",
    description: "Active deal details and structure",
    value: `deal_id: unknown
company_name: unknown
decision_maker: unknown
deal_size: 0
deal_currency: USD
proposed_product: unknown
contract_term: 12_months
renewal_date: null
discount_applied: 0%`,
    limit: 2000,
  },
  {
    label: "negotiation_state",
    description: "Current negotiation position and flexibility",
    value: `current_ask: pending
customer_pushback: none
our_flexibility: standard
authority_limit: 50000
discount_budget: 0.15
negotiation_stage: discovery
last_proposal_date: null`,
    limit: 1500,
  },
  {
    label: "competitor_intelligence",
    description: "Competitive threats and differentiation",
    value: `primary_competitor: unknown
competitor_strength: unknown
our_advantage: unknown
customer_preference: unknown
price_sensitivity: medium`,
    limit: 1000,
  },
  {
    label: "contract_stage",
    description: "Where the deal is in the contracting process",
    value: `stage: proposal
loi_signed: false
negotiation_complete: false
legal_review: pending
signature_date: null
approval_status: pending_sales_manager`,
    limit: 1000,
  },
];

// SDR Agent Memory Blocks
export const SDR_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "lead_profile",
    description: "Lead company and decision-maker information",
    value: `company_name: unknown
company_size: unknown
industry: unknown
annual_revenue: unknown
decision_maker: unknown
title: unknown
email: unknown
phone: unknown
linkedin_url: unknown`,
    limit: 2000,
  },
  {
    label: "engagement_strategy",
    description: "Personalized outreach approach for this lead",
    value: `outreach_cadence: unknown
messaging_angle: unknown
pain_point_primary: unknown
pain_point_secondary: unknown
best_contact_time: unknown
preferred_channel: unknown
previous_interactions: 0`,
    limit: 1500,
  },
  {
    label: "qualification_criteria",
    description: "BANT assessment (Budget, Authority, Need, Timeline)",
    value: `budget_available: unknown
budget_amount: 0
budget_decision_timeline: unknown
authority_level: unknown
authority_has_budget: unknown
need_identified: false
need_urgency: unknown
timeline_to_buy: unknown
timeline_months: 0
next_step: discovery_call`,
    limit: 2000,
  },
  {
    label: "follow_up_state",
    description: "Follow-up schedule and attempt history",
    value: `last_contact: null
next_contact: null
contact_attempts: 0
responses_received: 0
demo_scheduled: false
demo_date: null
objections_noted: ''
last_objection: none`,
    limit: 1500,
  },
];

// Default empty memory states for each agent
export function getDefaultMemoryBlocks(
  agentRole: "router" | "support" | "csm" | "ae" | "sdr"
): MemoryBlock[] {
  switch (agentRole) {
    case "router":
      return ROUTER_MEMORY_BLOCKS;
    case "support":
      return SUPPORT_MEMORY_BLOCKS;
    case "csm":
      return CSM_MEMORY_BLOCKS;
    case "ae":
      return AE_MEMORY_BLOCKS;
    case "sdr":
      return SDR_MEMORY_BLOCKS;
    default:
      return [];
  }
}

/**
 * Memory utilities
 */
export function findMemoryBlock(
  blocks: MemoryBlock[],
  label: string
): MemoryBlock | undefined {
  return blocks.find((b) => b.label === label);
}

export function updateMemoryBlock(
  blocks: MemoryBlock[],
  label: string,
  newValue: string
): MemoryBlock[] {
  return blocks.map((block) => {
    if (block.label === label) {
      return {
        ...block,
        value: newValue,
        lastUpdated: new Date().toISOString(),
      };
    }
    return block;
  });
}

export function replaceInMemoryBlock(
  blocks: MemoryBlock[],
  label: string,
  oldText: string,
  newText: string
): MemoryBlock[] {
  return blocks.map((block) => {
    if (block.label === label) {
      return {
        ...block,
        value: block.value.replace(oldText, newText),
        lastUpdated: new Date().toISOString(),
      };
    }
    return block;
  });
}

export function insertIntoMemoryBlock(
  blocks: MemoryBlock[],
  label: string,
  textToInsert: string
): MemoryBlock[] {
  return blocks.map((block) => {
    if (block.label === label) {
      return {
        ...block,
        value: block.value + "\n" + textToInsert,
        lastUpdated: new Date().toISOString(),
      };
    }
    return block;
  });
}

/**
 * Render memory blocks for system prompt
 */
export function renderMemoryBlocksForPrompt(blocks: MemoryBlock[]): string {
  return blocks
    .map(
      (block) =>
        `[${block.label.toUpperCase()}]
Description: ${block.description}
Content:
${block.value}`
    )
    .join("\n\n");
}
