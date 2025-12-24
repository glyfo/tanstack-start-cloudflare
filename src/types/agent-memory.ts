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
];

// SDR Agent Memory Blocks
export const SDR_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "prospect_profile",
    description: "Key details about the prospect being engaged",
    value: "",
    limit: 2000,
  },
  {
    label: "qualification_status",
    description:
      "BANT qualification progress: Budget, Authority, Need, Timeline",
    value:
      "budget: unknown\nauthority: unknown\nneed: unknown\ntimeline: unknown",
    limit: 1000,
  },
  {
    label: "next_steps",
    description: "Proposed next actions and follow-up timing",
    value: "",
    limit: 1000,
  },
];

// AE Agent Memory Blocks
export const AE_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "deal_stage",
    description: "Current stage of the opportunity",
    value: "prospecting",
    limit: 500,
  },
  {
    label: "stakeholder_map",
    description: "Key stakeholders, their roles, and influence",
    value: "",
    limit: 2000,
  },
  {
    label: "deal_notes",
    description: "Deal-specific notes, objections, and solutions discussed",
    value: "",
    limit: 3000,
  },
];

// CSM Agent Memory Blocks
export const CSM_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "customer_health",
    description: "Health score and key metrics",
    value: "health: unknown\noutcome_progress: 0%\nengagement_level: low",
    limit: 1000,
  },
  {
    label: "success_plan",
    description: "Agreed success metrics and milestones",
    value: "",
    limit: 2000,
  },
  {
    label: "escalation_alerts",
    description: "Warning signs or escalation triggers",
    value: "",
    limit: 1000,
  },
];

// Support Agent Memory Blocks
export const SUPPORT_MEMORY_BLOCKS: MemoryBlock[] = [
  {
    label: "ticket_context",
    description: "Issue description and attempts so far",
    value: "",
    limit: 3000,
  },
  {
    label: "escalation_check",
    description: "Whether this needs human intervention",
    value: "escalation_needed: false\nreason: initial",
    limit: 1000,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find a memory block by label
 */
export function findMemoryBlock(
  blocks: MemoryBlock[],
  label: string
): MemoryBlock | undefined {
  return blocks.find((b) => b.label === label);
}

/**
 * Render memory blocks for inclusion in AI prompt
 */
export function renderMemoryBlocksForPrompt(blocks: MemoryBlock[]): string {
  return blocks
    .map(
      (block) =>
        `## ${block.label}\n${block.description}\n\n${block.value || "(empty)"}`
    )
    .join("\n\n---\n\n");
}
