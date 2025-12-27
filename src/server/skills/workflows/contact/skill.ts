/**
 * [IMPROVED] Contact CRUD Skill
 *
 * Unified skill for all Contact CRUD operations with conversational workflows.
 * Supports:
 * - CREATE: Multi-step form with validation and confirmation
 * - READ: List, search, and view details
 * - UPDATE: Conversational field-by-field update
 * - DELETE: Confirmation workflow
 *
 * CATEGORY: workflow
 * EXTENDS: BaseSkill
 * USED BY: SkillManager, IntentRouter
 *
 * Features:
 * - Prisma type safety (no manual type duplication)
 * - Conversational UI for all operations
 * - Workflow state persistence
 * - Progressive disclosure
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";
import { Contact } from "@prisma/client";
import { ContactRepository } from "@/server/db/contact-repository";
import {
  getFieldDefinitions,
  getNextRequiredField,
  getRequiredFieldDefinitions,
  getEditableFieldDefinitions,
  validateFieldValue,
  validateContactData,
  areAllRequiredFieldsCollected,
  createContact,
  readContact,
  updateContact,
  deleteContact,
  listContacts,
  formatContactForDisplay,
  formatContactDetailed,
  formatContactListForDisplay,
  formatForConfirmation,
} from "./handlers";
import type { CRUDAction, CRUDInput } from "./types";

export class ContactCRUDSkill extends BaseSkill {
  metadata: SkillMetadata = {
    id: "workflow:contact-crud",
    name: "Contact Management",
    description: "Create, read, update, and delete contacts conversationally",
    version: "3.0.0",
    category: "workflow",
    tags: ["contact", "crm", "crud", "form", "workflow"],
  };

  private repository!: ContactRepository;

  /**
   * Check if this skill can handle the input
   */
  canHandle(input: any): boolean {
    if (!input || typeof input !== "object") return false;
    const { action } = input;
    return (
      action === "create" ||
      action === "read" ||
      action === "update" ||
      action === "delete" ||
      action === "list" ||
      action === "search" ||
      action === "view"
    );
  }

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
    this.repository = new ContactRepository(context.env);
  }

  /**
   * Execute contact CRUD workflow
   */
  async execute(input: CRUDInput): Promise<SkillResult> {
    const { action } = input as any;

    if (!action) {
      return { success: false, error: "Missing action parameter" };
    }

    try {
      switch (action) {
        // CREATE operations
        case "create":
          return this.handleCreate(input as any);

        // READ operations
        case "read":
        case "list":
        case "search":
        case "view":
          return this.handleRead(input as any);

        // UPDATE operations
        case "update":
          return this.handleUpdate(input as any);

        // DELETE operations
        case "delete":
          return this.handleDelete(input as any);

        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  // ============================================================================
  // CREATE WORKFLOW
  // ============================================================================

  private async handleCreate(input: any): Promise<SkillResult> {
    const {
      createAction = "start",
      workflowId,
      fieldName,
      fieldValue,
      collectedData,
    } = input;

    switch (createAction) {
      case "start":
        return this.startCreateWorkflow();
      case "submit_field":
        return this.submitCreateField(workflowId || "", fieldName!, fieldValue);
      case "confirm":
        return this.confirmCreateWorkflow(
          workflowId || "",
          collectedData || {}
        );
      case "complete":
        return this.completeCreateWorkflow(
          workflowId || "",
          collectedData || {}
        );
      case "cancel":
        return this.cancelWorkflow(workflowId || "");
      default:
        return {
          success: false,
          error: `Unknown create action: ${createAction}`,
        };
    }
  }

  private startCreateWorkflow(): SkillResult {
    const workflowId = this.generateWorkflowId("create");
    const requiredFields = getRequiredFieldDefinitions();
    const firstField = requiredFields[0];

    console.log(`[ContactCRUDSkill] Started CREATE workflow: ${workflowId}`);

    return {
      success: true,
      data: {
        workflowId,
        action: "create",
        message: `Let's create a new contact. ${firstField.label}?`,
        field: firstField,
        progress: {
          current: 1,
          total: requiredFields.length,
          percentage: Math.round((1 / requiredFields.length) * 100),
        },
      },
    };
  }

  private submitCreateField(
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
    const validation = validateFieldValue(fieldName, fieldValue);
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

    // Get next field
    const requiredFields = getRequiredFieldDefinitions();
    const currentIndex = requiredFields.findIndex((f) => f.name === fieldName);
    const nextField = requiredFields[currentIndex + 1] || null;

    if (!nextField) {
      return {
        success: true,
        data: {
          workflowId,
          status: "pending_confirmation",
          message: "Great! Ready to review and confirm?",
          fieldSubmitted: fieldName,
          progress: {
            current: requiredFields.length,
            total: requiredFields.length,
            percentage: 100,
          },
        },
      };
    }

    return {
      success: true,
      data: {
        workflowId,
        fieldSubmitted: fieldName,
        message: `${nextField.label}?`,
        field: nextField,
        progress: {
          current: currentIndex + 2,
          total: requiredFields.length,
          percentage: Math.round(
            ((currentIndex + 2) / requiredFields.length) * 100
          ),
        },
      },
    };
  }

  private confirmCreateWorkflow(
    workflowId: string,
    collectedData: Record<string, unknown>
  ): SkillResult {
    if (!workflowId || !collectedData) {
      return { success: false, error: "Missing workflowId or collectedData" };
    }

    const displayText = formatForConfirmation(collectedData as any);

    return {
      success: true,
      data: {
        workflowId,
        status: "pending_confirmation",
        message: displayText,
        collectedData,
      },
    };
  }

  private async completeCreateWorkflow(
    workflowId: string,
    collectedData: Record<string, unknown>
  ): Promise<SkillResult> {
    if (!workflowId || !collectedData) {
      return { success: false, error: "Missing workflowId or collectedData" };
    }

    try {
      const result = await createContact(
        this.repository,
        collectedData,
        this.context!.userId || "anonymous"
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
          message: `✅ Contact created: **${contact.firstName} ${contact.lastName}**`,
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

  // ============================================================================
  // READ WORKFLOW
  // ============================================================================

  private async handleRead(input: any): Promise<SkillResult> {
    const {
      action = "start",
      workflowId,
      query,
      filters,
      page,
      limit,
      contactId,
    } = input;

    switch (action) {
      case "start":
        return this.startReadWorkflow();

      case "select":
        return this.selectContactForView(workflowId || "", contactId || "");

      case "view_details":
        return this.viewContactDetails(contactId || "", this.context!.userId);

      case "cancel":
        return this.cancelWorkflow(workflowId || "");

      default:
        return this.searchOrListContacts(query || "", page || 1, limit || 20);
    }
  }

  private startReadWorkflow(): SkillResult {
    const workflowId = this.generateWorkflowId("read");

    return {
      success: true,
      data: {
        workflowId,
        action: "read",
        message:
          "What would you like to do? Say 'list all' to see all contacts or provide a search term.",
      },
    };
  }

  private async searchOrListContacts(
    query: string,
    page: number,
    limit: number
  ): Promise<SkillResult> {
    const result = await listContacts(
      this.repository,
      this.context!.userId,
      query || undefined,
      page,
      limit
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data || result.data.length === 0) {
      return {
        success: true,
        data: {
          message: query
            ? `No contacts found matching "${query}"`
            : "No contacts found",
        },
      };
    }

    const formatted = formatContactListForDisplay(
      result.data,
      result.count || 0,
      page,
      limit
    );

    return {
      success: true,
      data: {
        message: formatted.markdown,
        contacts: formatted.contacts,
        total: formatted.total,
        page,
        hasMore: formatted.hasMore,
      },
    };
  }

  private selectContactForView(
    workflowId: string,
    contactId: string
  ): SkillResult {
    return {
      success: true,
      data: {
        workflowId,
        message: "Fetching contact details...",
        nextAction: "view_details",
        contactId,
      },
    };
  }

  private async viewContactDetails(
    contactId: string,
    userId: string
  ): Promise<SkillResult> {
    const result = await readContact(this.repository, contactId, userId, true);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const contact = result.data as Contact;
    const formatted = formatContactDetailed(contact);

    return {
      success: true,
      data: {
        message: formatted.markdown,
        contact,
      },
      stopProcessing: true,
    };
  }

  // ============================================================================
  // UPDATE WORKFLOW
  // ============================================================================

  private async handleUpdate(input: any): Promise<SkillResult> {
    const {
      action = "start",
      workflowId,
      contactId,
      fieldName,
      fieldValue,
      collectedChanges,
    } = input;

    switch (action) {
      case "start":
        return this.startUpdateWorkflow(contactId);

      case "select_field":
        return this.selectFieldForUpdate(workflowId || "", fieldName!);

      case "submit_value":
        return this.submitUpdateValue(workflowId || "", fieldName!, fieldValue);

      case "confirm":
        return this.confirmUpdateWorkflow(
          workflowId || "",
          contactId,
          collectedChanges || {}
        );

      case "complete":
        return this.completeUpdateWorkflow(
          workflowId || "",
          contactId,
          collectedChanges || {}
        );

      case "cancel":
        return this.cancelWorkflow(workflowId || "");

      default:
        return { success: false, error: `Unknown update action: ${action}` };
    }
  }

  private async startUpdateWorkflow(contactId: string): Promise<SkillResult> {
    const workflowId = this.generateWorkflowId("update");
    const editableFields = getEditableFieldDefinitions();

    return {
      success: true,
      data: {
        workflowId,
        contactId,
        action: "update",
        message: `Which field would you like to update? Available: ${editableFields
          .map((f) => f.label)
          .join(", ")}`,
        editableFields,
      },
    };
  }

  private selectFieldForUpdate(
    workflowId: string,
    fieldName: string
  ): SkillResult {
    const field = getFieldDefinitions().find((f) => f.name === fieldName);

    if (!field) {
      return { success: false, error: `Unknown field: ${fieldName}` };
    }

    return {
      success: true,
      data: {
        workflowId,
        fieldSelected: fieldName,
        message: `Enter the new value for ${field.label}${
          field.placeholder ? ` (e.g., ${field.placeholder})` : ""
        }`,
        field,
      },
    };
  }

  private submitUpdateValue(
    workflowId: string,
    fieldName: string,
    fieldValue: unknown
  ): SkillResult {
    const validation = validateFieldValue(fieldName, fieldValue);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        data: { workflowId, fieldName },
      };
    }

    return {
      success: true,
      data: {
        workflowId,
        fieldUpdated: fieldName,
        message: "Updated! Would you like to update another field or confirm?",
      },
    };
  }

  private confirmUpdateWorkflow(
    workflowId: string,
    contactId: string,
    collectedChanges: Record<string, unknown>
  ): SkillResult {
    if (!collectedChanges || Object.keys(collectedChanges).length === 0) {
      return { success: false, error: "No changes to apply" };
    }

    const formatted = formatContactDetailed(collectedChanges as any);

    return {
      success: true,
      data: {
        workflowId,
        contactId,
        message: `Review changes:\n${formatted.markdown}\nConfirm?`,
        collectedChanges,
      },
    };
  }

  private async completeUpdateWorkflow(
    workflowId: string,
    contactId: string,
    collectedChanges: Record<string, unknown>
  ): Promise<SkillResult> {
    if (!contactId || !collectedChanges) {
      return { success: false, error: "Missing contactId or collectedChanges" };
    }

    const result = await updateContact(
      this.repository,
      contactId,
      this.context!.userId,
      collectedChanges
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
        contactId,
        message: `✅ Contact updated: **${contact.firstName} ${contact.lastName}**`,
        contact,
      },
      stopProcessing: true,
    };
  }

  // ============================================================================
  // DELETE WORKFLOW
  // ============================================================================

  private async handleDelete(input: any): Promise<SkillResult> {
    const { action = "start", workflowId, contactId, confirmPhrase } = input;

    switch (action) {
      case "start":
        return this.startDeleteWorkflow(contactId!);

      case "select":
        return this.selectContactForDelete(workflowId || "", contactId!);

      case "confirm":
        return this.confirmDeleteWorkflow(
          workflowId || "",
          contactId!,
          confirmPhrase
        );

      case "complete":
        return this.completeDeleteWorkflow(workflowId || "", contactId!);

      case "cancel":
        return this.cancelWorkflow(workflowId || "");

      default:
        return { success: false, error: `Unknown delete action: ${action}` };
    }
  }

  private async startDeleteWorkflow(contactId: string): Promise<SkillResult> {
    const workflowId = this.generateWorkflowId("delete");

    // Fetch contact to confirm
    const result = await readContact(
      this.repository,
      contactId,
      this.context!.userId
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const contact = result.data as Contact;

    return {
      success: true,
      data: {
        workflowId,
        contactId,
        message: `⚠️ Are you sure you want to delete **${contact.firstName} ${contact.lastName}**? Say "yes, delete" to confirm.`,
        contact: {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`,
          email: contact.email,
        },
      },
    };
  }

  private selectContactForDelete(
    workflowId: string,
    contactId: string
  ): SkillResult {
    return {
      success: true,
      data: {
        workflowId,
        contactId,
        message: "Proceeding with delete confirmation...",
      },
    };
  }

  private confirmDeleteWorkflow(
    workflowId: string,
    contactId: string,
    confirmPhrase?: string
  ): SkillResult {
    if (!confirmPhrase || !confirmPhrase.toLowerCase().includes("delete")) {
      return {
        success: false,
        error: "Please confirm by saying 'yes, delete'",
        data: { workflowId, contactId },
      };
    }

    return {
      success: true,
      data: {
        workflowId,
        contactId,
        status: "pending_deletion",
        message: "Deleting contact...",
      },
    };
  }

  private async completeDeleteWorkflow(
    workflowId: string,
    contactId: string
  ): Promise<SkillResult> {
    const result = await deleteContact(
      this.repository,
      contactId,
      this.context!.userId
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: {
        workflowId,
        contactId,
        message: "✅ Contact deleted successfully",
      },
      stopProcessing: true,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private cancelWorkflow(workflowId: string): SkillResult {
    if (!workflowId) {
      return { success: false, error: "Missing workflowId" };
    }

    console.log(`[ContactCRUDSkill] Cancelled workflow: ${workflowId}`);

    return {
      success: true,
      data: {
        workflowId,
        message: "Operation cancelled.",
      },
      stopProcessing: true,
    };
  }

  private generateWorkflowId(action: CRUDAction): string {
    return `wf_contact_${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup(_context: SkillContext): Promise<void> {
    await super.cleanup(_context);
  }
}

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
    const requiredCount = REQUIRED_FIELDS.length;

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

    const currentRequiredFieldIndex = REQUIRED_FIELDS.findIndex(
      (f) => f === fieldName
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
          total: REQUIRED_FIELDS.length,
          percentage: Math.round(
            ((currentRequiredFieldIndex + 2) / REQUIRED_FIELDS.length) * 100
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
