export type LoopPhase =
  | "idle"
  | "observing"
  | "thinking"
  | "acting"
  | "learning";

export interface AgentLoopState {
  phase: LoopPhase;
  goal?: string;
  iteration: number;
  maxIterations: number;
  currentAction?: string;
  reasoning?: string;
  progress: number;
  lastUpdate: number;
}

import type { CardState, NotificationState, ToolExecutionState, FlowContextState } from './chat-agent-types';

export interface UIState {
  /** Currently active card to render */
  activeCard: CardState | null;
  /** Form state keyed by formId */
  formState: Record<string, unknown>;
  /** Active notifications */
  notifications: NotificationState[];
  /** Active conversational flow */
  conversationalFlow: FlowContextState | null;
}

export interface ToolsState {
  /** Last tool execution result */
  lastExecution: ToolExecutionState | null;
  /** Currently pending tool IDs */
  pendingTools: string[];
}

export interface ChatAgentState {
  agentLoop: AgentLoopState;
  lastGoalResult?: {
    success: boolean;
    result?: unknown;
    completedAt: number;
  };
  /** UI-synchronized state for cards, forms, and notifications */
  ui: UIState;
  /** Tool execution state */
  tools: ToolsState;
}
