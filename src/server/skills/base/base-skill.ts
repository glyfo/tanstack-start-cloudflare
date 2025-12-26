/**
 * [INFRASTRUCTURE] Base Skill Class
 *
 * Foundation for all skills in the system.
 * All skills extend this class and implement business logic.
 *
 * USED BY: All skill implementations (conversation, intent, action, workflow skills)
 * DEPENDS ON: SkillContext types
 *
 * Features:
 * - Memory management (OPTIONAL - only if skill needs persistence)
 * - Context access (provides sessionId, environment, WebSocket, state)
 * - Error handling (try-catch in all operations)
 */

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  category: "intent" | "workflow" | "conversation" | "action" | "tool";
  tags: string[];
  dependencies?: string[];
  requiredContext?: string[];
}

export interface SkillContext {
  sessionId: string;
  userId?: string;
  env: any;
  ws: any;
  state: any;
  messageHistory: ChatMessage[];
  sharedData?: Record<string, any>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface SkillResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  nextSkill?: string;
  stopProcessing?: boolean;
  metadata?: Record<string, any>;
}

export abstract class BaseSkill {
  abstract metadata: SkillMetadata;
  protected context?: SkillContext;

  /**
   * Initialize skill with context
   */
  async initialize(context: SkillContext): Promise<void> {
    this.context = context;
  }

  /**
   * Execute skill logic - implement in subclasses
   */
  abstract execute(input: any): Promise<SkillResult>;

  /**
   * Check if skill can handle this input
   */
  abstract canHandle(input: any): boolean;

  /**
   * Cleanup after execution
   */
  async cleanup(_context: SkillContext): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Get skill capabilities
   */
  getCapabilities(): string[] {
    return [this.metadata.id];
  }

  /**
   * Get memory for this skill
   */
  protected async getMemory(key?: string): Promise<any> {
    if (!this.context?.state) {
      return null;
    }

    const memoryKey = key || `skill-memory:${this.metadata.id}`;
    return await this.context.state.get(memoryKey);
  }

  /**
   * Store memory for this skill
   */
  protected async setMemory(data: any, key?: string): Promise<void> {
    if (!this.context?.state) {
      throw new Error("State not available in context");
    }

    const memoryKey = key || `skill-memory:${this.metadata.id}`;
    await this.context.state.put(memoryKey, data);
  }

  /**
   * Validate required context
   */
  protected validateContext(): void {
    if (!this.context) {
      throw new Error("Skill context not initialized");
    }

    if (
      this.metadata.requiredContext &&
      this.metadata.requiredContext.length > 0
    ) {
      for (const key of this.metadata.requiredContext) {
        if (!(key in this.context)) {
          throw new Error(`Required context missing: ${key}`);
        }
      }
    }
  }

  /**
   * Format error for user
   */
  protected formatError(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
