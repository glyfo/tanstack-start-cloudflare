/**
 * [INFRASTRUCTURE] Skill Context Types
 *
 * Shared context interface passed to all skills.
 * Provides access to session, environment, state, and message history.
 *
 * USED BY: BaseSkill and all skill implementations
 * DEPENDS ON: None (pure type definitions)
 */

export interface SkillContextState {
  sessionId: string;
  userId?: string;
  messages: any[];
  context: Record<string, any>;
  lastUpdated: number;
}

export interface SkillContext {
  sessionId: string;
  userId?: string;
  env: any; // Cloudflare bindings
  ws: any; // WebSocket connection
  state: any; // Durable Object state
  messageHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp?: number;
  }>;
  sharedData?: Record<string, any>;
  currentDomain?: string;
}

export type SkillExecutionContext = SkillContext & {
  memoryKey: string;
  domainGroup?: string;
};
