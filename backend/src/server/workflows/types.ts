/**
 * Workflow System Types
 * Defines interfaces for multi-step business workflows
 */

export interface WorkflowIntent {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

export interface WorkflowState {
  storage: any; // Durable Object storage interface
  [key: string]: any;
}

export interface Workflow {
  name: string;
  description: string;
  handler: (intent: WorkflowIntent, state: WorkflowState) => Promise<string>;
}

export interface WorkflowResult {
  success: boolean;
  message: string;
  data?: any;
}
