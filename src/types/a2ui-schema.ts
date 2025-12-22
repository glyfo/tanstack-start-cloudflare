/**
 * A2UI - Lightweight Agent-to-UI Component Schema
 * ================================================
 *
 * Declarative component tree format sent from server to client.
 * Server describes UI structure, client renders with native components.
 * Progressive rendering via JSONL streaming.
 */

export type A2UIComponentType =
  | "heading"
  | "text"
  | "card"
  | "list"
  | "metric"
  | "button"
  | "section";

export interface A2UIProps {
  [key: string]: any;
}

export interface A2UIComponent {
  type: A2UIComponentType;
  props?: A2UIProps;
  children?: A2UIComponent[];
}

export interface A2UIMessage {
  id: string;
  role: "assistant";
  components: A2UIComponent[];
  timestamp: number;
  metadata?: {
    intent?: string;
    progressive?: boolean;
  };
}

/**
 * Component-specific prop types
 */
export interface HeadingProps {
  level: 1 | 2 | 3;
  text: string;
}

export interface TextProps {
  content: string;
}

export interface CardProps {
  title?: string;
  subtitle?: string;
  style?: "default" | "highlight" | "warning";
}

export interface MetricProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export interface ListProps {
  items: string[];
  ordered?: boolean;
  style?: "bullet" | "number" | "check";
}

export interface ButtonProps {
  text: string;
  action?: string;
  style?: "primary" | "secondary" | "danger";
}

export interface SectionProps {
  title?: string;
}
