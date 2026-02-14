/**
 * ConversationStateDO - Manages multi-turn conversation workflows
 *
 * Purpose: Ensures all required fields are collected before executing tools
 * Prevents premature tool execution that causes crashes
 *
 * Lifecycle:
 * idle → collecting_name → collecting_email → collecting_company → ready → executing → completed
 *
 * Each conversation session gets its own ConversationState instance
 */

// No import needed for DurableObject base class

import { createLogger } from "../utils/logger";

const logger = createLogger("ConversationStateDO");

export type WorkflowState =
  | "idle"
  | "collecting_name"
  | "collecting_email"
  | "collecting_company"
  | "collecting_phone"
  | "ready"
  | "executing"
  | "completed"
  | "error";

export interface PartialContactData {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  notes?: string;
}

export interface ConversationStateData {
  id: string;
  workflowState: WorkflowState;
  partialData: PartialContactData;
  missingFields: string[];
  errorCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * ConversationStateDO - Stateful workflow management
 *
 * Key features:
 * - State machine for multi-turn workflows
 * - Partial data collection with validation
 * - Message history for context
 * - Field-level validation
 * - Error recovery
 */
export class ConversationStateDO {
  private sql: SqlStorage;
  private conversationId: string;

  constructor(ctx: any) {
    this.sql = ctx.storage.sql;
    this.conversationId = ctx.id.toString();
    this.initializeSchema();
    logger.info(`[ConversationStateDO] Initialized: ${this.conversationId}`);
  }

  /**
   * Initialize SQL schema for conversation state
   */
  private initializeSchema(): void {
    // Conversation state table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS conversation_state (
        id TEXT PRIMARY KEY DEFAULT 'current',
        workflow_state TEXT NOT NULL DEFAULT 'idle',
        partial_data TEXT NOT NULL DEFAULT '{}',
        missing_fields TEXT NOT NULL DEFAULT '[]',
        error_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Message history table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS conversation_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER DEFAULT (unixepoch()),
        metadata TEXT
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_history_timestamp 
      ON conversation_history(timestamp DESC)
    `);

    // Initialize state if not exists
    const existing = this.sql
      .exec(
        `
      SELECT id FROM conversation_state WHERE id = 'current'
    `
      )
      .toArray();

    if (existing.length === 0) {
      this.sql.exec(`
        INSERT INTO conversation_state (id, workflow_state, partial_data, missing_fields)
        VALUES ('current', 'idle', '{}', '[]')
      `);
    }

    logger.info(`[ConversationStateDO] Schema initialized`);
  }

  // ============================================
  // RPC METHODS (called from ChatAgent)
  // ============================================

  /**
   * Get current conversation state
   */
  async getState(): Promise<ConversationStateData> {
    const row = this.sql
      .exec(
        `
      SELECT * FROM conversation_state WHERE id = 'current'
    `
      )
      .toArray()[0] as any;

    return {
      id: row.id,
      workflowState: row.workflow_state as WorkflowState,
      partialData: JSON.parse(row.partial_data),
      missingFields: JSON.parse(row.missing_fields),
      errorCount: row.error_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Process user message and update workflow state
   * Returns whether the tool should be executed
   */
  async processMessage(message: {
    role: "user" | "assistant";
    content: string;
    intent?: string;
  }): Promise<{
    shouldExecuteTool: boolean;
    state: WorkflowState;
    partialData: PartialContactData;
    missingFields: string[];
    promptForUser?: string;
  }> {
    logger.info(`[ConversationStateDO] Processing message`, {
      role: message.role,
      intent: message.intent,
      contentLength: message.content.length,
    });

    // Save message to history
    await this.saveMessage({
      role: message.role,
      content: message.content,
      metadata: { intent: message.intent },
    });

    // Get current state
    const state = await this.getState();

    // If user message, extract fields
    if (message.role === "user") {
      await this.extractFieldsFromMessage(message.content, state);
    }

    // Re-fetch state after extraction
    const updatedState = await this.getState();

    // Update workflow state based on collected data
    const newWorkflowState = this.determineWorkflowState(
      updatedState.partialData
    );

    if (newWorkflowState !== updatedState.workflowState) {
      await this.updateWorkflowState(newWorkflowState);
    }

    // Check if ready to execute
    const shouldExecute =
      newWorkflowState === "ready" && message.intent === "createContact";
    const missingFields = this.getMissingFields(updatedState.partialData);

    // Generate prompt if fields are missing
    let promptForUser: string | undefined;
    if (!shouldExecute && message.intent === "createContact") {
      promptForUser = this.generatePromptForMissingFields(
        missingFields,
        updatedState.partialData
      );
    }

    return {
      shouldExecuteTool: shouldExecute,
      state: shouldExecute ? "ready" : newWorkflowState,
      partialData: updatedState.partialData,
      missingFields,
      promptForUser,
    };
  }

  /**
   * Extract contact fields from user message using regex and patterns
   */
  private async extractFieldsFromMessage(
    content: string,
    state: ConversationStateData
  ): Promise<void> {
    const partialData = { ...state.partialData };
    let updated = false;

    const lowerContent = content.toLowerCase();

    // Extract email (highest confidence pattern)
    const emailMatch = content.match(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
    );
    if (emailMatch && !partialData.email) {
      partialData.email = emailMatch[0].toLowerCase();
      updated = true;
      logger.info(
        `[ConversationStateDO] Extracted email: ${partialData.email}`
      );
    }

    // Extract phone
    const phoneMatch = content.match(
      /\b(\+?1[-.]?)?\(?\d{3}\)?[-\.\s]?\d{3}[-\.\s]?\d{4}\b/
    );
    if (phoneMatch && !partialData.phone) {
      partialData.phone = phoneMatch[0];
      updated = true;
      logger.info(
        `[ConversationStateDO] Extracted phone: ${partialData.phone}`
      );
    }

    // Extract name (if asking "my name is X" or "I'm X" or just a name)
    if (!partialData.name) {
      // Pattern 1: "my name is John Doe"
      const nameMatch1 = content.match(
        /(?:my name is|i am|i'm|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
      );
      if (nameMatch1) {
        partialData.name = nameMatch1[1].trim();
        updated = true;
        logger.info(
          `[ConversationStateDO] Extracted name (pattern 1): ${partialData.name}`
        );
      }

      // Pattern 2: Just a capitalized name "John Doe" when state is collecting_name OR when no other fields extracted
      if (
        !partialData.name &&
        (state.workflowState === "collecting_name" ||
          state.workflowState === "idle")
      ) {
        const nameMatch2 = content.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)$/);
        if (nameMatch2) {
          partialData.name = nameMatch2[1].trim();
          updated = true;
          logger.info(
            `[ConversationStateDO] Extracted name (pattern 2): ${partialData.name}`
          );
        }
      }
    }

    // Extract company (if mentioning company patterns)
    if (!partialData.company) {
      // Pattern 1: "I work at X" or "I'm from X"
      const companyMatch1 = content.match(
        /(?:work at|works at|from|company is)\s+([A-Z][A-Za-z0-9\s&.,-]+?)(?=[.,!?]|$)/i
      );
      if (companyMatch1) {
        partialData.company = companyMatch1[1].trim();
        updated = true;
        logger.info(
          `[ConversationStateDO] Extracted company (pattern 1): ${partialData.company}`
        );
      }

      // Pattern 2: Infer from email domain
      if (!partialData.company && partialData.email) {
        const domain = partialData.email.split("@")[1];
        if (
          domain &&
          !domain.includes("gmail") &&
          !domain.includes("yahoo") &&
          !domain.includes("hotmail")
        ) {
          const companyName = domain.split(".")[0];
          partialData.company =
            companyName.charAt(0).toUpperCase() + companyName.slice(1);
          updated = true;
          logger.info(
            `[ConversationStateDO] Inferred company from email: ${partialData.company}`
          );
        }
      }

      // Pattern 3: Just a company name when state is collecting_company
      if (
        !partialData.company &&
        state.workflowState === "collecting_company"
      ) {
        const companyMatch3 = content.match(/^([A-Z][A-Za-z0-9\s&.,-]+)$/);
        if (companyMatch3) {
          partialData.company = companyMatch3[1].trim();
          updated = true;
          logger.info(
            `[ConversationStateDO] Extracted company (pattern 3): ${partialData.company}`
          );
        }
      }
    }

    // Extract notes/additional context
    if (lowerContent.includes("note:") || lowerContent.includes("notes:")) {
      const notesMatch = content.match(/notes?:\s*(.+?)(?:\.|$)/i);
      if (notesMatch) {
        partialData.notes =
          (partialData.notes || "") + " " + notesMatch[1].trim();
        updated = true;
      }
    }

    // Update if we extracted any fields
    if (updated) {
      await this.updatePartialData(partialData);
    }
  }

  /**
   * Determine workflow state based on collected data
   */
  private determineWorkflowState(
    partialData: PartialContactData
  ): WorkflowState {
    const hasName = !!partialData.name && partialData.name.length >= 2;
    const hasEmail = !!partialData.email && partialData.email.includes("@");

    if (!hasName) {
      return "collecting_name";
    }

    if (!hasEmail) {
      return "collecting_email";
    }

    // Name and email are required, others are optional
    // But we can ask for company if not provided
    if (!partialData.company) {
      return "collecting_company";
    }

    // All required fields collected
    return "ready";
  }

  /**
   * Get list of missing required fields
   */
  private getMissingFields(partialData: PartialContactData): string[] {
    const missing: string[] = [];

    if (!partialData.name || partialData.name.length < 2) {
      missing.push("name");
    }

    if (!partialData.email || !partialData.email.includes("@")) {
      missing.push("email");
    }

    return missing;
  }

  /**
   * Generate helpful prompt for user to provide missing fields
   */
  private generatePromptForMissingFields(
    missingFields: string[],
    partialData: PartialContactData
  ): string {
    if (missingFields.length === 0) {
      // Ask for optional company if not provided
      if (!partialData.company) {
        return "Great! I have your name and email. What company do you work for? (or say 'skip' if you prefer not to share)";
      }
      return "I have all the information I need. Let me create your contact now.";
    }

    if (missingFields.includes("name") && missingFields.includes("email")) {
      return "I'd love to add you as a contact! Could you please tell me your full name and email address?";
    }

    if (missingFields.includes("name")) {
      return "What's your full name?";
    }

    if (missingFields.includes("email")) {
      return "What's your email address?";
    }

    return "Could you provide a bit more information?";
  }

  /**
   * Update workflow state
   */
  private async updateWorkflowState(newState: WorkflowState): Promise<void> {
    this.sql.exec(
      `
      UPDATE conversation_state 
      SET workflow_state = ?, updated_at = unixepoch()
      WHERE id = 'current'
    `,
      newState
    );

    logger.info(`[ConversationStateDO] State updated: ${newState}`);
  }

  /**
   * Update partial contact data
   */
  private async updatePartialData(data: PartialContactData): Promise<void> {
    const missingFields = this.getMissingFields(data);

    this.sql.exec(
      `
      UPDATE conversation_state 
      SET partial_data = ?, missing_fields = ?, updated_at = unixepoch()
      WHERE id = 'current'
    `,
      JSON.stringify(data),
      JSON.stringify(missingFields)
    );

    logger.info(`[ConversationStateDO] Partial data updated`, {
      data: JSON.stringify(data),
    });
  }

  /**
   * Mark tool execution started
   */
  async startToolExecution(): Promise<void> {
    await this.updateWorkflowState("executing");
  }

  /**
   * Mark tool execution completed
   */
  async completeToolExecution(success: boolean): Promise<void> {
    if (success) {
      await this.updateWorkflowState("completed");
      // Reset for next workflow
      await this.reset();
    } else {
      await this.updateWorkflowState("error");
      // Increment error count
      this.sql.exec(`
        UPDATE conversation_state 
        SET error_count = error_count + 1
        WHERE id = 'current'
      `);
    }
  }

  /**
   * Reset conversation state for new workflow
   */
  async reset(): Promise<void> {
    this.sql.exec(`
      UPDATE conversation_state 
      SET workflow_state = 'idle',
          partial_data = '{}',
          missing_fields = '[]',
          error_count = 0,
          updated_at = unixepoch()
      WHERE id = 'current'
    `);

    logger.info(`[ConversationStateDO] State reset`);
  }

  /**
   * Save message to history
   */
  private async saveMessage(message: {
    role: "user" | "assistant" | "system";
    content: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const metadata = message.metadata ? JSON.stringify(message.metadata) : null;

    this.sql.exec(
      `
      INSERT INTO conversation_history (id, role, content, metadata)
      VALUES (?, ?, ?, ?)
    `,
      id,
      message.role,
      message.content,
      metadata
    );
  }

  /**
   * Get conversation history
   */
  async getHistory(limit: number = 50): Promise<MessageRecord[]> {
    const rows = this.sql
      .exec(
        `
      SELECT * FROM conversation_history
      ORDER BY timestamp DESC
      LIMIT ?
    `,
        limit
      )
      .toArray() as any[];

    return rows
      .map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }))
      .reverse(); // Return chronological order
  }

  /**
   * Validate contact data is complete
   */
  async validateContactData(): Promise<{
    valid: boolean;
    errors: string[];
    data: PartialContactData;
  }> {
    const state = await this.getState();
    const errors: string[] = [];

    if (!state.partialData.name || state.partialData.name.length < 2) {
      errors.push("Name must be at least 2 characters");
    }

    if (!state.partialData.email || !state.partialData.email.includes("@")) {
      errors.push("Valid email is required");
    }

    return {
      valid: errors.length === 0,
      errors,
      data: state.partialData,
    };
  }

  /**
   * Get statistics about conversation
   */
  async getStats(): Promise<{
    messageCount: number;
    state: WorkflowState;
    fieldsCollected: number;
    errorCount: number;
  }> {
    const state = await this.getState();

    const messageRow = this.sql
      .exec(
        `
      SELECT COUNT(*) as count FROM conversation_history
    `
      )
      .toArray()[0] as any;

    const fieldsCollected = Object.values(state.partialData).filter(
      (v) => v
    ).length;

    return {
      messageCount: messageRow.count,
      state: state.workflowState,
      fieldsCollected,
      errorCount: state.errorCount,
    };
  }
}
