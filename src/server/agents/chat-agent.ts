/**
 * Main Chat Agent - Now uses Orchestrator pattern
 * Delegates to specialized agents based on user intent
 */

import { OrchestratorAgent } from "./orchestrator-agent";

/**
 * ChatAgent is now an Orchestrator that coordinates specialized agents
 */
export class ChatAgent extends OrchestratorAgent {
  // Inherits all orchestration logic from OrchestratorAgent
  // This maintains backward compatibility with existing routes
}
