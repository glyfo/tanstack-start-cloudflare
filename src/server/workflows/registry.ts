/**
 * Workflow Registry - Central place to register all workflows
 * No imports needed in ChatAgent - just load from here
 */

import type { Workflow } from "../agents/chat-agent";
import { getContactWorkflows } from "./contact-workflows";

/**
 * Get all registered workflows
 * Add new workflow loaders here as you create them
 */
export function getAllWorkflows(): Workflow[] {
  return [
    ...getContactWorkflows(),
    // Add more here:
    // ...getMarketingWorkflows(),
    // ...getFinanceWorkflows(),
    // ...getOperationsWorkflows(),
  ];
}
