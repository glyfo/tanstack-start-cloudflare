/**
 * [FRAMEWORK] Workflow Skill Base Class
 *
 * Base class for all workflow-based skills (multi-step forms).
 * Handles workflow initialization, field collection, confirmation, and completion.
 * NOT a skill implementation - use as base class only.
 *
 * EXTENDS: BaseSkill
 * USED BY: All workflow implementations (ContactWorkflowSkill, etc)
 *
 * FEATURES:
 * - Multi-step field collection
 * - Field validation with custom error messages
 * - Workflow state persistence in Durable Objects
 * - Confirmation step before submission
 * - Memory management for workflow tracking
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";
import { MemoryManager } from "@/server/skills/base/memory-manager";

export interface WorkflowState {
  id: string;
  type: string;
  startedAt: string;
  currentFieldIndex: number;
  collectedData: Record<string, any>;
  status: "active" | "pending_confirmation" | "complete" | "cancelled";
}

export interface FieldDefinition {
  name: string;
  prompt: string;
  validator: (value: string) => boolean;
  errorMessage?: string;
}

export abstract class WorkflowSkill extends BaseSkill {
  protected abstract fieldDefinitions: FieldDefinition[];
  protected memoryManager?: MemoryManager;

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
    this.memoryManager = new MemoryManager(context.state);
  }

  async execute(input: any): Promise<SkillResult> {
    const action = input.action || "start";

    switch (action) {
      case "start":
        return await this.startWorkflow();
      case "submit_field":
        return await this.submitField(input.data);
      case "complete":
        return await this.completeWorkflow(input.data);
      case "cancel":
        return await this.cancelWorkflow(input.data);
      default:
        return { success: false, error: `Unknown workflow action: ${action}` };
    }
  }

  canHandle(input: any): boolean {
    return (
      input &&
      (input.action || input.intent) &&
      this.metadata.id.includes(this.getIntentForWorkflow())
    );
  }

  /**
   * Get the intent this workflow handles
   * Override in subclasses
   */
  protected abstract getIntentForWorkflow(): string;

  /**
   * Start workflow - initialize first field
   */
  protected async startWorkflow(): Promise<SkillResult> {
    if (!this.memoryManager) {
      return { success: false, error: "Memory manager not initialized" };
    }

    if (this.fieldDefinitions.length === 0) {
      return { success: false, error: "No fields defined for workflow" };
    }

    const workflowId = this.generateWorkflowId();
    const workflow: WorkflowState = {
      id: workflowId,
      type: this.metadata.id,
      startedAt: new Date().toISOString(),
      currentFieldIndex: 0,
      collectedData: {},
      status: "active",
    };

    const stateKey = `workflow:${workflowId}`;
    await this.context!.state.put(stateKey, workflow);

    const currentField = this.fieldDefinitions[0];

    return {
      success: true,
      data: {
        workflowId,
        message: currentField.prompt,
        progress: {
          current: 1,
          total: this.fieldDefinitions.length,
          percentage: Math.round((1 / this.fieldDefinitions.length) * 100),
        },
      },
    };
  }

  /**
   * Submit field value
   */
  protected async submitField(data: any): Promise<SkillResult> {
    if (!data.workflowId || data.fieldValue === undefined) {
      return {
        success: false,
        error: "Missing workflowId or fieldValue",
      };
    }

    const stateKey = `workflow:${data.workflowId}`;
    const workflow = (await this.context!.state.get(stateKey)) as WorkflowState;

    if (!workflow) {
      return { success: false, error: "Workflow not found" };
    }

    const fieldIndex = workflow.currentFieldIndex;
    if (fieldIndex >= this.fieldDefinitions.length) {
      return { success: false, error: "All fields already submitted" };
    }

    const currentField = this.fieldDefinitions[fieldIndex];

    if (!currentField.validator(String(data.fieldValue))) {
      return {
        success: false,
        error: currentField.errorMessage || `Invalid ${currentField.name}`,
        data: {
          workflowId: data.workflowId,
          rejectedField: currentField.name,
          retryMessage: currentField.prompt,
        },
      };
    }

    workflow.collectedData[currentField.name] = data.fieldValue;
    workflow.currentFieldIndex++;

    if (workflow.currentFieldIndex >= this.fieldDefinitions.length) {
      workflow.status = "pending_confirmation";
      await this.context!.state.put(stateKey, workflow);

      const confirmationMessage = this.buildConfirmationMessage(
        workflow.collectedData
      );

      return {
        success: true,
        data: {
          workflowId: data.workflowId,
          status: "pending_confirmation",
          message: `${confirmationMessage}\n\nIs this correct? Say "yes" to continue or "no" to cancel.`,
          collectedData: workflow.collectedData,
        },
      };
    }

    const nextField = this.fieldDefinitions[workflow.currentFieldIndex];
    await this.context!.state.put(stateKey, workflow);

    return {
      success: true,
      data: {
        workflowId: data.workflowId,
        message: nextField.prompt,
        progress: {
          current: workflow.currentFieldIndex + 1,
          total: this.fieldDefinitions.length,
          percentage: Math.round(
            ((workflow.currentFieldIndex + 1) / this.fieldDefinitions.length) *
              100
          ),
        },
      },
    };
  }

  /**
   * Complete workflow - persist to database
   */
  protected async completeWorkflow(data: any): Promise<SkillResult> {
    if (!data.workflowId) {
      return { success: false, error: "Missing workflowId" };
    }

    const stateKey = `workflow:${data.workflowId}`;
    const workflow = (await this.context!.state.get(stateKey)) as WorkflowState;

    if (!workflow) {
      return { success: false, error: "Workflow not found" };
    }

    for (const field of this.fieldDefinitions) {
      if (!(field.name in workflow.collectedData)) {
        return {
          success: false,
          error: `Missing required field: ${field.name}`,
        };
      }
    }

    workflow.status = "complete";
    await this.context!.state.put(stateKey, workflow);

    return {
      success: true,
      data: {
        workflowId: data.workflowId,
        collectedData: workflow.collectedData,
        status: "complete",
      },
      nextSkill: `action:submit_${this.getActionTypeForWorkflow()}`,
    };
  }

  /**
   * Cancel workflow
   */
  protected async cancelWorkflow(data: any): Promise<SkillResult> {
    if (data.workflowId) {
      const stateKey = `workflow:${data.workflowId}`;
      const workflow = (await this.context!.state.get(
        stateKey
      )) as WorkflowState;

      if (workflow) {
        workflow.status = "cancelled";
        await this.context!.state.put(stateKey, workflow);
      }
    }

    return {
      success: true,
      data: { message: "Workflow cancelled" },
      stopProcessing: true,
    };
  }

  /**
   * Build confirmation message from collected data
   * Override in subclasses for custom formatting
   */
  protected buildConfirmationMessage(data: Record<string, any>): string {
    let message = "Please confirm the following information:\n";
    for (const [key, value] of Object.entries(data)) {
      const fieldLabel = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      message += `${fieldLabel}: ${value}\n`;
    }
    return message;
  }

  /**
   * Get action type for workflow submission
   * Override in subclasses
   */
  protected getActionTypeForWorkflow(): string {
    return this.metadata.id.replace("workflow:", "");
  }

  /**
   * Generate unique workflow ID
   */
  protected generateWorkflowId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup(_context: SkillContext): Promise<void> {
    // Override in subclasses if needed
  }
}
