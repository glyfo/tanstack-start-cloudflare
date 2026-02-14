export type CardType =
  | "contact"
  | "contact-list"
  | "create-contact-form"
  | "opportunity"
  | "opportunity-list"
  | "create-opportunity-form"
  | "opportunity-form-with-contact"
  | "contact-selector"
  | "tiktok-lead"
  | "facebook-lead"
  | "instagram-lead"
  | "whatsapp-conversation"
  | "action"
  | "success"
  | "notification"
  | "lead-summary"
  | "analytics"
  | "qualification-status";

export interface CardState {
  type: CardType;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface NotificationState {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  timestamp: number;
  autoClose?: boolean;
}

export interface FlowContextState {
  flowId: string;
  stage: number;
  status: "active" | "paused" | "completed" | "cancelled" | "error";
  startedAt: number;
  updatedAt: number;
  collectedData: Record<string, any>;
  error?: string;
}

export interface ToolExecutionState {
  toolId: string;
  status: "pending" | "running" | "success" | "error";
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface UIState {
  activeCard: CardState | null;
  formState: Record<string, unknown>;
  notifications: NotificationState[];
  conversationalFlow: FlowContextState | null;
}

export interface ToolsState {
  lastExecution: ToolExecutionState | null;
  pendingTools: string[];
}

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

export interface ChatAgentState {
  agentLoop: AgentLoopState;
  lastGoalResult?: {
    success: boolean;
    result?: unknown;
    completedAt: number;
  };
  ui: UIState;
  tools: ToolsState;
}
