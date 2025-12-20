/**
 * Schema-Based Content System
 * Defines structured content types for rich messaging
 */

export type ContentSchema =
  | TextSchema
  | TableSchema
  | ListSchema
  | TimelineSchema
  | DefinitionListSchema
  | ProcessFlowSchema
  | ComparisonSchema
  | AlertSchema;

// ============== BASE INTERFACE ==============
export interface BaseSchema {
  type: string;
  metadata?: {
    displayHint?: "expanded" | "collapsed" | "inline";
    layout?: "full-width" | "two-column" | "three-column";
    priority?: number;
    theme?: "default" | "highlight" | "warning" | "success";
  };
}

// ============== TEXT SCHEMA ==============
export interface TextSchema extends BaseSchema {
  type: "text";
  content: string;
  format?: "plain" | "markdown" | "html";
  style?: "body" | "heading-1" | "heading-2" | "heading-3" | "quote";
}

// ============== TABLE SCHEMA ==============
export interface TableSchema extends BaseSchema {
  type: "table";
  title?: string;
  description?: string;
  headers: TableHeader[];
  rows: TableRow[];
  footer?: string;
  sortable?: boolean;
  filterable?: boolean;
}

export interface TableHeader {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
  type?: "text" | "number" | "badge" | "icon";
}

export interface TableRow {
  id?: string;
  cells: Record<string, TableCell>;
  metadata?: Record<string, any>;
}

export interface TableCell {
  value: string | number | boolean;
  type?: "text" | "badge" | "progress" | "icon";
  color?: string;
  icon?: string;
}

// ============== LIST SCHEMA ==============
export interface ListSchema extends BaseSchema {
  type: "list";
  title?: string;
  items: ListItem[];
  style?: "bullet" | "numbered" | "checkmark";
  grouped?: boolean;
}

export interface ListItem {
  id?: string;
  label: string;
  description?: string;
  icon?: string;
  children?: ListItem[];
  metadata?: Record<string, any>;
}

// ============== TIMELINE SCHEMA ==============
export interface TimelineSchema extends BaseSchema {
  type: "timeline";
  title?: string;
  events: TimelineEvent[];
  layout?: "vertical" | "horizontal";
  showConnector?: boolean;
}

export interface TimelineEvent {
  step: number;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  duration?: string;
  details?: string[];
}

// ============== DEFINITION LIST SCHEMA ==============
export interface DefinitionListSchema extends BaseSchema {
  type: "definition-list";
  title?: string;
  items: DefinitionItem[];
  columns?: 1 | 2 | 3;
}

export interface DefinitionItem {
  term: string;
  definition: string;
  icon?: string;
  tags?: string[];
  characteristics?: string[];
}

// ============== PROCESS FLOW SCHEMA ==============
export interface ProcessFlowSchema extends BaseSchema {
  type: "process-flow";
  title?: string;
  description?: string;
  steps: ProcessStep[];
  indicators?: "numbered" | "checkmark" | "icon";
}

export interface ProcessStep {
  id: string;
  title: string;
  description: string;
  icon?: string;
  details?: string[];
  subSteps?: ProcessStep[];
}

// ============== COMPARISON SCHEMA ==============
export interface ComparisonSchema extends BaseSchema {
  type: "comparison";
  title?: string;
  items: ComparisonItem[];
  highlightDifferences?: boolean;
}

export interface ComparisonItem {
  name: string;
  properties: Record<string, string | number>;
  icon?: string;
  color?: string;
}

// ============== ALERT SCHEMA ==============
export interface AlertSchema extends BaseSchema {
  type: "alert";
  level?: "info" | "warning" | "error" | "success";
  title?: string;
  message: string;
  icon?: string;
  action?: {
    label: string;
    link?: string;
    callback?: string;
  };
}

// ============== MESSAGE STRUCTURE ==============
export interface StructuredMessage {
  id: string;
  role: "user" | "assistant";
  timestamp: number;
  content: ContentSchema[];
  metadata?: {
    theme?: string;
    layout?: "single-column" | "multi-column";
    readTime?: number;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | ContentSchema[];
  timestamp: number;
  isStructured?: boolean;
}
