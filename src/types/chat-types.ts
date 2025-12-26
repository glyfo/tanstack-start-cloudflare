/**
 * Chat Agent Types and Interfaces
 * Consolidated in /src/types for consistency across the repo
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface ChatState {
  sessionId: string;
  userId?: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  lastUpdated: number;
}

export interface SkillExecutionRequest {
  skillId?: string;
  content?: string;
  message?: string;
  action?: string;
  [key: string]: any;
}

export interface AgentResponse<T = any> {
  type: "welcome" | "skill_result" | "error" | "status";
  sessionId?: string;
  message?: string;
  skillId?: string;
  domain?: string;
  data?: T;
  nextSkill?: string;
  availableDomains?: string[];
  availableSkills?: any[];
}
