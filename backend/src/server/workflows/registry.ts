/**
 * Workflow Registry - Central place to register all workflows
 * No imports needed in ChatAgent - just load from here
 */

import type { Workflow } from "./types";

/**
 * Get all registered workflows
 * Add new workflow loaders here as you create them
 */
export function getAllWorkflows(): Workflow[] {
  return [
    // Add workflow loaders here:
    // ...getMarketingWorkflows(),
    // ...getFinanceWorkflows(),
    // ...getOperationsWorkflows(),
  ];
}
