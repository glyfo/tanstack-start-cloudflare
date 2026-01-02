/**
 * Multi-Agent System - Export all agents
 * Central export point for the agent architecture
 */

export { ChatAgent } from "./chat-agent";
export { OrchestratorAgent } from "./orchestrator-agent";
export { PlanningAgent } from "./planning-agent";
export { KnowledgeAgent } from "./knowledge-agent";
export { ExecutionAgent } from "./execution-agent";
export { VerificationAgent } from "./verification-agent";

/**
 * Agent Intent Types
 */
export type AgentIntent =
  | "PLANNING"
  | "KNOWLEDGE"
  | "EXECUTION"
  | "VERIFICATION";

/**
 * Agent Metadata
 */
export const AGENT_METADATA = {
  orchestrator: {
    name: "Orchestrator",
    description: "Routes requests to specialized agents",
    className: "ChatAgent",
  },
  planning: {
    name: "Planning Agent",
    description: "Breaks down complex tasks into subtasks",
    className: "PlanningAgent",
  },
  knowledge: {
    name: "Knowledge Agent",
    description: "Retrieves and analyzes CRM data",
    className: "KnowledgeAgent",
  },
  execution: {
    name: "Execution Agent",
    description: "Performs CRM operations",
    className: "ExecutionAgent",
  },
  verification: {
    name: "Verification Agent",
    description: "Validates data quality",
    className: "VerificationAgent",
  },
} as const;
