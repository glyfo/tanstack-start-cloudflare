// Shared types for ChatAgent and helpers

// ============================================================================
// CARD TYPES FOR UI STATE
// ============================================================================

export type CardType =
  | 'contact'
  | 'contact-list'
  | 'create-contact-form'
  | 'opportunity'
  | 'opportunity-list'
  | 'create-opportunity-form'
  | 'opportunity-form-with-contact'
  | 'contact-selector'
  | 'tiktok-lead'
  | 'facebook-lead'
  | 'instagram-lead'
  | 'whatsapp-conversation'
  | 'action'
  | 'success'
  | 'notification'
  | 'lead-summary'
  | 'analytics'
  | 'qualification-status';

export interface CardState {
  type: CardType;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: number;
  autoClose?: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    source?: 'client' | 'server' | 'mcp';
  };
}

export interface ToolExecutionState {
  toolId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Extended UIMessage type that includes content and createdAt properties
 * used by the ChatAgent for message handling and persistence.
 * This extends the base UIMessage from 'ai' package with our custom fields.
 */
export interface ExtendedUIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool';
  content: string;
  createdAt?: Date;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  toolCalls?: ToolCallInfo[];
  summary?: string;
  processingTime?: number;
  modelUsed?: string;
  tokensUsed?: number;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "error";
  startTime: number;
  endTime?: number;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
}

export interface StatusUpdate {
  type: "status";
  phase: "analyzing" | "calling-tool" | "formatting" | "thinking" | "processing";
  tool?: string;
  progress?: number;
  message?: string;
  details?: any;
}

// ============================================================================
// CONVERSATIONAL FLOW TYPES
// ============================================================================

export interface FlowContextState {
  flowId: string;
  stage: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
  startedAt: number;
  updatedAt: number;
  /** Accumulated data from all stages */
  collectedData: Record<string, any>;
  /** Error message if status is 'error' */
  error?: string;
}

export interface SmartContext {
  lastUpdate?: number;
  activeForm?: string;
  formState?: Record<string, any>;
  lastAction?: string;
  /** Active conversational flow */
  conversationalFlow?: FlowContextState;
  [key: string]: any;
}

export interface FlowContextUpdate {
  type: 'flow-update';
  flowId: string;
  stage: number;
  status: FlowContextState['status'];
  collectedData?: Record<string, any>;
  action?: 'started' | 'advanced' | 'completed' | 'cancelled' | 'contact-selected';
}
