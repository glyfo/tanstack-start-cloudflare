/**
 * CRM Agent System
 * Exports configured ChatAgent with all workflows loaded
 */

import { ChatAgent } from "./chat-agent";
import { getAllWorkflows } from "../workflows/registry";

// Factory function to create configured ChatAgent
export function createChatAgent(ctx: any, env: any): ChatAgent {
  const agent = new ChatAgent(ctx, env);

  // Load all workflows from registry
  try {
    const workflows = getAllWorkflows();
    console.log(`[Agent Init] Loading ${workflows.length} workflows`);

    workflows.forEach((workflow) => {
      try {
        agent.register(workflow);
      } catch (error) {
        console.error(
          `[Agent Init] Failed to register workflow: ${workflow.name}`,
          error
        );
      }
    });

    console.log(
      `[Agent Init] Available workflows:`,
      agent.getAvailableWorkflows()
    );
  } catch (error) {
    console.error("[Agent Init] Failed to load workflows", error);
  }

  return agent;
}

// Also export the class for direct use if needed
export { ChatAgent };
