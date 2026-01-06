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
  agentLoop?: AgentLoopState;
  lastGoalResult?: {
    success: boolean;
    result?: any;
    completedAt: number;
  };
}
