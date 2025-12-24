/**
 * ChatFlow Types
 * Centralized types for all chat and UI flow components
 * Used by: ChatFlowEngine, ChatFlowRenderer, LoginForm, MarkdownMessage, TypingIndicator
 */

// ============================================
// CHATFLOW COMPONENT TYPES
// ============================================

export type ChatFlowComponentType =
  | "heading"
  | "text"
  | "card"
  | "list"
  | "metric"
  | "button"
  | "section";

export type ChatFlowProps = Record<string, any>;

export interface ChatFlowComponent {
  id?: string;
  type: ChatFlowComponentType;
  props?: ChatFlowProps;
  children?: ChatFlowComponent[];
}

export interface ChatFlowMessage {
  id: string;
  role: "assistant";
  components: ChatFlowComponent[];
  timestamp: number;
  metadata?: {
    intent?: string;
    progressive?: boolean;
  };
}

// ============================================
// MESSAGE TYPES
// ============================================

export interface RenderedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  chatFlowComponents?: ChatFlowComponent[];
  isSuccess?: boolean;
  successData?: Record<string, unknown>;
}

export interface ServerMessage {
  type:
    | "connected"
    | "history"
    | "message_added"
    | "field_question"
    | "field_error"
    | "field_valid"
    | "progress"
    | "success"
    | "error"
    | "complete"
    | "stream_start"
    | "stream_chunk"
    | "stream_end";
  sessionId?: string;
  userId?: string;
  messages?: any[];
  message?: any;
  fieldName?: string;
  prompt?: string;
  error?: string;
  current?: number;
  total?: number;
  action?: string;
  data?: Record<string, unknown>;
  messageId?: string;
  value?: string;
  options?: string[];
}

// ============================================
// CHAT FLOW ENGINE TYPES
// ============================================

export interface ChatProps {
  sessionId?: string;
}

export interface ChatState {
  messages: RenderedMessage[];
  input: string;
  isLoading: boolean;
  error: string | null;
  currentSessionId: string;
}

export interface ChatTip {
  title: string;
  description: string;
  examples: string[];
}

// ============================================
// MESSAGE RENDERER TYPES
// ============================================

export interface UIRendererProps {
  components: ChatFlowComponent[];
  isLoading?: boolean;
}

export interface MessageRendererProps {
  message: RenderedMessage;
  isLoading?: boolean;
  isLastMessage?: boolean;
}

export interface ComponentProps {
  component: ChatFlowComponent;
}

// ============================================
// LOGIN FORM TYPES
// ============================================

export interface LoginFormProps {
  onLoginSuccess: (session: Session) => void;
}

export interface Session {
  sessionId: string;
  userId: string;
  email: string;
  role: "user" | "admin";
  createdAt?: number;
}

export interface LoginFormState {
  email: string;
  isLoading: boolean;
  error: string | null;
}

export type LoginFormAction =
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean };

// ============================================
// MARKDOWN MESSAGE TYPES
// ============================================

export interface MarkdownMessageProps {
  content: string;
}

// ============================================
// TYPING INDICATOR TYPES
// ============================================

export interface TypingIndicatorProps {
  message?: string;
}

// ============================================
// WEBSOCKET FLOW TYPES
// ============================================

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface FieldQuestionMessage extends ServerMessage {
  type: "field_question";
  fieldName: string;
  prompt: string;
  options?: string[];
}

export interface FieldValidMessage extends ServerMessage {
  type: "field_valid";
  fieldName: string;
}

export interface FieldErrorMessage extends ServerMessage {
  type: "field_error";
  fieldName: string;
  error: string;
}

export interface ProgressMessage extends ServerMessage {
  type: "progress";
  current: number;
  total: number;
}

export interface SuccessMessage extends ServerMessage {
  type: "success" | "complete";
  data: Record<string, unknown>;
  message: string;
}

export interface StreamMessage extends ServerMessage {
  type: "stream_start" | "stream_chunk" | "stream_end";
  messageId?: string;
  value?: string;
}

// ============================================
// UI COMPONENT TYPES
// ============================================

export interface HeadingProps {
  level: 1 | 2 | 3;
  text: string;
  className?: string;
}

export interface TextProps {
  content: string;
  className?: string;
}

export interface MetricProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
}

export interface ListProps {
  items: string[];
  ordered?: boolean;
  className?: string;
}

export interface CardProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export interface SectionProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

// ============================================
// ERROR HANDLING TYPES
// ============================================

export interface ErrorState {
  message: string;
  code?: string;
  timestamp: number;
  retry?: boolean;
}

export interface ConnectionError extends ErrorState {
  code: "CONNECTION_FAILED" | "CONNECTION_LOST" | "MESSAGE_FAILED";
}

// ============================================
// HELPER TYPES
// ============================================

export type MessageRole = "user" | "assistant";

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "select"
  | "textarea"
  | "number";

export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}
