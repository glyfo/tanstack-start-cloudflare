/**
 * Agent Tools
 * Tools that agents can call to perform actions and update memory
 */

import { getMemoryManager } from "../memory-manager";

/**
 * Memory Tools - Allow agents to edit their own memory via tool calling
 * Pattern: Agent thinks something, calls tool to remember it
 */
export const memoryTools = {
  /**
   * Insert text into a memory block
   * Appends to the end of the block
   */
  memoryInsert: {
    name: "memoryInsert",
    description: "Add new information to a memory block (append)",
    parameters: {
      type: "object",
      properties: {
        blockLabel: {
          type: "string",
          description:
            'The memory block to insert into (e.g., "current_issue", "lead_profile")',
        },
        textToInsert: {
          type: "string",
          description: "The text to append to the memory block",
        },
      },
      required: ["blockLabel", "textToInsert"],
    },
    execute: async (
      args: { blockLabel: string; textToInsert: string },
      sessionId: string
    ) => {
      const mm = getMemoryManager();
      // This will be called from agent context with agentRole available
      return `Appended to ${args.blockLabel}`;
    },
  },

  /**
   * Replace text within a memory block
   * Finds and replaces specific text
   */
  memoryReplace: {
    name: "memoryReplace",
    description: "Update information in a memory block (replace)",
    parameters: {
      type: "object",
      properties: {
        blockLabel: {
          type: "string",
          description: "The memory block to update",
        },
        oldText: {
          type: "string",
          description: "The text to find and replace",
        },
        newText: {
          type: "string",
          description: "The new text to replace with",
        },
      },
      required: ["blockLabel", "oldText", "newText"],
    },
    execute: async (
      args: { blockLabel: string; oldText: string; newText: string },
      sessionId: string
    ) => {
      const mm = getMemoryManager();
      // This will be called from agent context with agentRole available
      return `Updated ${args.blockLabel}`;
    },
  },

  /**
   * Update entire memory block
   * Replaces the entire block content
   */
  memoryUpdate: {
    name: "memoryUpdate",
    description: "Replace entire content of a memory block",
    parameters: {
      type: "object",
      properties: {
        blockLabel: {
          type: "string",
          description: "The memory block to update",
        },
        newContent: {
          type: "string",
          description: "The complete new content for the block",
        },
      },
      required: ["blockLabel", "newContent"],
    },
    execute: async (
      args: { blockLabel: string; newContent: string },
      sessionId: string
    ) => {
      const mm = getMemoryManager();
      // This will be called from agent context with agentRole available
      return `Replaced ${args.blockLabel}`;
    },
  },
};

/**
 * Router Agent Tools - Tools for the router to use
 */
export const routerTools = {
  /**
   * Delegate message to another agent
   */
  delegateToAgent: {
    name: "delegateToAgent",
    description: "Hand off the conversation to a different specialized agent",
    parameters: {
      type: "object",
      properties: {
        targetAgent: {
          type: "string",
          enum: ["support", "csm", "ae", "sdr"],
          description: "Which agent should handle this message",
        },
        reason: {
          type: "string",
          description: "Why we are delegating to this agent",
        },
      },
      required: ["targetAgent", "reason"],
    },
  },

  /**
   * Stay with current agent
   */
  stayWithAgent: {
    name: "stayWithAgent",
    description: "Continue with the current agent (no delegation)",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why we are staying with current agent",
        },
      },
      required: ["reason"],
    },
  },

  /**
   * Escalate to human
   */
  escalateToHuman: {
    name: "escalateToHuman",
    description: "Escalate the conversation to a human",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why this needs human intervention",
        },
        priority: {
          type: "string",
          enum: ["normal", "urgent"],
          description: "How urgent is the escalation",
        },
      },
      required: ["reason"],
    },
  },
};

/**
 * Support Agent Tools
 */
export const supportTools = {
  /**
   * Update issue status
   */
  updateIssueStatus: {
    name: "updateIssueStatus",
    description: "Update the status of the current issue",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "open",
            "in_progress",
            "waiting_customer",
            "resolved",
            "escalated",
          ],
          description: "New status for the issue",
        },
        note: {
          type: "string",
          description: "Note about the status change",
        },
      },
      required: ["status"],
    },
  },

  /**
   * Suggest solution from knowledge base
   */
  suggestSolution: {
    name: "suggestSolution",
    description: "Suggest a solution from the knowledge base",
    parameters: {
      type: "object",
      properties: {
        solutionType: {
          type: "string",
          description:
            'Type of solution (e.g., "API Timeout", "Database Connection")',
        },
      },
      required: ["solutionType"],
    },
  },

  /**
   * Request escalation to support manager
   */
  escalateToManager: {
    name: "escalateToManager",
    description: "Escalate to human support manager",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why escalation is needed",
        },
      },
      required: ["reason"],
    },
  },
};

/**
 * SDR Agent Tools
 */
export const sdrTools = {
  /**
   * Score/qualify lead
   */
  scoreLead: {
    name: "scoreQualified",
    description: "Score a lead based on BANT criteria",
    parameters: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: "Qualification score 1-100",
        },
        qualificationLevel: {
          type: "string",
          enum: ["unqualified", "mql", "sql", "ready_for_ae"],
          description: "Lead qualification level",
        },
        reason: {
          type: "string",
          description: "Why this score",
        },
      },
      required: ["score", "qualificationLevel"],
    },
  },

  /**
   * Schedule demo/meeting
   */
  scheduleDemo: {
    name: "scheduleDemo",
    description: "Schedule a demo or discovery meeting",
    parameters: {
      type: "object",
      properties: {
        demoDate: {
          type: "string",
          description: "Proposed date/time for demo (ISO format)",
        },
        demoType: {
          type: "string",
          enum: ["discovery", "product_demo", "technical_deep_dive"],
          description: "Type of demo/meeting",
        },
      },
      required: ["demoDate", "demoType"],
    },
  },

  /**
   * Escalate to AE
   */
  escalateToAE: {
    name: "escalateToAE",
    description: "Hand off qualified lead to Account Executive",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why this lead is ready for AE",
        },
      },
      required: ["reason"],
    },
  },
};

/**
 * AE Agent Tools
 */
export const aeTools = {
  /**
   * Create quote
   */
  createQuote: {
    name: "createQuote",
    description: "Generate a pricing quote",
    parameters: {
      type: "object",
      properties: {
        dealSize: {
          type: "number",
          description: "Deal size in USD",
        },
        contractTerm: {
          type: "number",
          description: "Contract term in months",
        },
        discount: {
          type: "number",
          description: "Discount percentage (0-15)",
        },
      },
      required: ["dealSize", "contractTerm"],
    },
  },

  /**
   * Update deal stage
   */
  updateDealStage: {
    name: "updateDealStage",
    description: "Move deal through sales pipeline",
    parameters: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: [
            "discovery",
            "proposal",
            "negotiation",
            "approval",
            "closed_won",
            "closed_lost",
          ],
          description: "New deal stage",
        },
        note: {
          type: "string",
          description: "Note about the stage change",
        },
      },
      required: ["stage"],
    },
  },

  /**
   * Request approval for deal
   */
  requestApproval: {
    name: "requestApproval",
    description: "Request manager/VP approval for deal",
    parameters: {
      type: "object",
      properties: {
        dealSize: {
          type: "number",
          description: "Deal size requiring approval",
        },
        approverLevel: {
          type: "string",
          enum: ["manager", "director", "vp"],
          description: "Level of approval needed",
        },
        reason: {
          type: "string",
          description: "Why approval is needed",
        },
      },
      required: ["dealSize", "approverLevel"],
    },
  },
};

/**
 * CSM Agent Tools
 */
export const csmTools = {
  /**
   * Update health score
   */
  updateHealthScore: {
    name: "updateHealthScore",
    description: "Update customer health score",
    parameters: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description: "Health score 0-100",
        },
        factors: {
          type: "string",
          description: "What factors influenced this score",
        },
      },
      required: ["score"],
    },
  },

  /**
   * Log expansion opportunity
   */
  logExpansionOpportunity: {
    name: "logExpansionOpportunity",
    description: "Document an upsell or expansion opportunity",
    parameters: {
      type: "object",
      properties: {
        opportunityType: {
          type: "string",
          enum: [
            "seat_expansion",
            "module_upgrade",
            "feature_addition",
            "professional_services",
          ],
          description: "Type of expansion",
        },
        estimatedValue: {
          type: "number",
          description: "Estimated deal size",
        },
        timeline: {
          type: "string",
          description: "When customer might be ready",
        },
      },
      required: ["opportunityType"],
    },
  },

  /**
   * Flag at-risk account
   */
  flagAtRisk: {
    name: "flagAtRisk",
    description: "Alert management to at-risk account",
    parameters: {
      type: "object",
      properties: {
        riskLevel: {
          type: "string",
          enum: ["warning", "critical"],
          description: "How serious is the churn risk",
        },
        reason: {
          type: "string",
          description: "Why account is at risk",
        },
      },
      required: ["riskLevel", "reason"],
    },
  },
};
