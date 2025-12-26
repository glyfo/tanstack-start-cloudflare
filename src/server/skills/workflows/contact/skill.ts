/**
 * [IMPLEMENTATION] Contact Workflow Skill
 *
 * Orchestrates contact creation workflow using Zod schemas.
 * Manages multi-step form collection with validation and persistence.
 *
 * CATEGORY: workflow
 * EXTENDS: BaseSkill
 * USED BY: SkillManager, IntentRouter
 *
 * Features:
 * - Zod-based validation
 * - Progressive field collection
 * - Confirmation step
 * - Database persistence
 *
 * USES:
 * - schemas.ts (entity definitions & validation)
 * - handlers.ts (persistence & field management)
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";
import { Contact } from "./schemas";
import {
  getFieldDefinitions,
  validateFieldValue,
  createContact,
  formatContactForDisplay,
} from "./handlers";

export class ContactWorkflowSkill extends BaseSkill {
  metadata: SkillMetadata = {
    id: "workflow:contact",
    name: "Contact Management",
    description: "Create and manage contacts in your CRM",
    version: "2.0.0",
    category: "workflow",
    tags: ["contact", "form", "sales", "crm"],
  };

  /**
   * Check if this skill can handle the input
   */
  canHandle(input: any): boolean {
    if (!input || typeof input !== "object") return false;
    return (
      input.action === "start" ||
      input.action === "submit_field" ||
      input.action === "confirm" ||
      input.action === "complete" ||
      input.action === "cancel"
    );
  }

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
  }

  /**
   * Execute contact workflow
   */
  async execute(input: any): Promise<SkillResult> {
    const { action, workflowId, fieldName, fieldValue, collectedData } = input;

    if (!action) {
      return { success: false, error: "Missing action parameter" };
    }

    try {
      switch (action) {
        case "start":
          return this.startWorkflow();

        case "submit_field":
          return this.submitField(workflowId, fieldName, fieldValue);

        case "confirm":
          return this.confirmWorkflow(workflowId, collectedData);

        case "complete":
          return this.completeWorkflow(workflowId, collectedData);

        case "cancel":
          return this.cancelWorkflow(workflowId);

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async cleanup(_context: SkillContext): Promise<void> {
    await super.cleanup(_context);
  }

  /**
   * Start a new contact workflow
   */
  private startWorkflow(): SkillResult {
    const workflowId = this.generateWorkflowId();
    const fields = getFieldDefinitions();

    // In production: save to durable state
    console.log(`[ContactSkill] Started workflow: ${workflowId}`);

    const firstField = fields[0];
    const requiredCount = fields.filter((f) => f.required).length;

    return {
      success: true,
      data: {
        workflowId,
        message: `${firstField.label}?`,
        field: firstField,
        progress: {
          current: 1,
          total: requiredCount,
          percentage: Math.round((1 / requiredCount) * 100),
        },
      },
    };
  }

  /**
   * Submit field value during workflow
   */
  private submitField(
    workflowId: string,
    fieldName: string,
    fieldValue: unknown
  ): SkillResult {
    if (!workflowId || !fieldName || fieldValue === undefined) {
      return {
        success: false,
        error: "Missing required parameters: workflowId, fieldName, fieldValue",
      };
    }

    // Validate field value
    const validation = validateFieldValue(
      fieldName as keyof Contact,
      fieldValue
    );
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        data: {
          workflowId,
          fieldName,
          errorField: fieldName,
        },
      };
    }

    // In production: retrieve workflow state and update it
    // For now: simulate successful field submission
    const fields = getFieldDefinitions();
    const currentFieldIndex = fields.findIndex((f) => f.name === fieldName);
    const nextField = fields[currentFieldIndex + 1];

    if (!nextField) {
      return {
        success: true,
        data: {
          workflowId,
          status: "pending_confirmation",
          message: "Ready to save?",
          fieldSubmitted: fieldName,
        },
      };
    }

    const requiredFields = fields.filter((f) => f.required);
    const currentRequiredFieldIndex = requiredFields.findIndex(
      (f) => f.name === fieldName
    );

    return {
      success: true,
      data: {
        workflowId,
        fieldSubmitted: fieldName,
        message: `${nextField.label}?`,
        field: nextField,
        progress: {
          current: currentRequiredFieldIndex + 2,
          total: requiredFields.length,
          percentage: Math.round(
            ((currentRequiredFieldIndex + 2) / requiredFields.length) * 100
          ),
        },
      },
    };
  }

  /**
   * Confirm collected data before submission
   */
  private confirmWorkflow(
    workflowId: string,
    collectedData: Record<string, unknown>
  ): SkillResult {
    if (!workflowId || !collectedData) {
      return { success: false, error: "Missing workflowId or collectedData" };
    }

    // Format for display
    const displayText = formatContactForDisplay(collectedData);

    return {
      success: true,
      data: {
        workflowId,
        status: "pending_confirmation",
        message:
          displayText +
          "\n\nIs this correct? Say 'yes' to create or 'no' to cancel.",
        collectedData,
      },
    };
  }

  /**
   * Complete workflow - persist to database
   */
  private async completeWorkflow(
    workflowId: string,
    collectedData: Record<string, unknown>
  ): Promise<SkillResult> {
    if (!workflowId || !collectedData) {
      return { success: false, error: "Missing workflowId or collectedData" };
    }

    try {
      // Persist to database
      const result = await createContact(
        collectedData,
        this.context!.userId || "anonymous",
        this.context!.env
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          data: { errors: result.errors },
        };
      }

      const contact = result.data!;

      return {
        success: true,
        data: {
          workflowId,
          contactId: contact.id,
          message: `✅ Contact saved: ${contact.firstName} ${contact.lastName}`,
          contact: {
            id: contact.id,
            name: `${contact.firstName} ${contact.lastName}`,
            email: contact.email,
          },
        },
        stopProcessing: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to create contact: ${message}`,
      };
    }
  }

  /**
   * Cancel workflow
   */
  private cancelWorkflow(workflowId: string): SkillResult {
    if (!workflowId) {
      return { success: false, error: "Missing workflowId" };
    }

    console.log(`[ContactSkill] Cancelled workflow: ${workflowId}`);

    return {
      success: true,
      data: {
        workflowId,
        message: "Contact creation cancelled.",
      },
      stopProcessing: true,
    };
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `wf_contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
