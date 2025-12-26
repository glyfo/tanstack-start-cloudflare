// src/server/state/workflow-durable-object.ts
/**
 * Workflow Durable Object - Persistence Layer Only
 *
 * ⚠️ RESPONSIBILITY: Persist workflow state across messages
 * - Load/save workflow state to durable storage
 * - Track field index and completion
 * - Store collected data
 *
 * ❌ NOT RESPONSIBLE FOR:
 * - Field validation (use workflow-specific form utilities)
 * - Intent detection (use IntentSkill)
 * - Business logic (use skills)
 *
 * This is a thin persistence wrapper - keep it simple!
 */

import type { ActionSchema } from "@/server/skills/workflows/contact/contact-forms";

export interface WorkflowState {
  id: string;
  sessionId: string;
  schema: ActionSchema;
  currentFieldIndex: number;
  collectedData: Record<string, unknown>;
  isComplete: boolean;
  startedAt: number;
}

/**
 * WorkflowDurableObject handles form collection with stateful persistence
 */
export class WorkflowDurableObject {
  private state: WorkflowState | null = null;

  constructor(private durableState: any) {}

  /**
   * Initialize a new workflow session
   */
  async initialize(
    sessionId: string,
    schema: ActionSchema
  ): Promise<WorkflowState> {
    this.state = {
      id: crypto.randomUUID(),
      sessionId,
      schema,
      currentFieldIndex: 0,
      collectedData: {},
      isComplete: false,
      startedAt: Date.now(),
    };

    await this.durableState.put("workflow", this.state);
    return this.state;
  }

  /**
   * Load existing workflow state from storage
   */
  async load(): Promise<WorkflowState | null> {
    if (!this.state) {
      this.state = await this.durableState.get("workflow");
    }
    return this.state;
  }

  /**
   * Get the current field to ask for
   */
  getCurrentField() {
    if (!this.state || this.state.isComplete) return null;
    return this.state.schema.fields[this.state.currentFieldIndex] || null;
  }

  /**
   * Collect field value (caller must validate)
   * Simply saves the value and advances to next field
   */
  async collectField(fieldName: string, value: unknown): Promise<void> {
    const state = await this.load();
    if (!state) throw new Error("Workflow not initialized");

    state.collectedData[fieldName] = value;
    state.currentFieldIndex++;

    // Auto-complete if all required fields collected
    const requiredFields = state.schema.fields.filter((f) => f.required);
    if (
      requiredFields.every((f) => state.collectedData.hasOwnProperty(f.name))
    ) {
      state.isComplete = true;
    }

    await this.durableState.put("workflow", state);
    this.state = state;
  }

  /**
   * Mark workflow complete
   */
  async complete(): Promise<void> {
    const state = await this.load();
    if (!state) throw new Error("Workflow not initialized");

    state.isComplete = true;
    await this.durableState.put("workflow", state);
    this.state = state;
  }

  /**
   * Get collected data
   */
  getCollectedData(): Record<string, unknown> {
    return this.state ? { ...this.state.collectedData } : {};
  }

  /**
   * Get current state
   */
  getState(): WorkflowState | null {
    return this.state;
  }
}

export default WorkflowDurableObject;
