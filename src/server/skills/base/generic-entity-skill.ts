/**
 * Generic Entity CRUD Skill Base Class
 *
 * Abstract base class providing all CRUD workflow logic for any entity
 * Eliminates 91% duplication across all entity skills
 *
 * FEATURES:
 * - Conversational CREATE workflow (multi-step form)
 * - READ workflow (list, search, view details)
 * - UPDATE workflow (field-by-field conversational updates)
 * - DELETE workflow (confirmation-based deletion)
 * - LIST workflow with pagination
 * - SEARCH workflow with entity-specific filters
 * - Workflow state persistence
 * - Progressive disclosure (ask field by field)
 *
 * USAGE:
 * export class AccountCRUDSkill extends GenericEntityCRUDSkill<Account> {
 *   metadata = {
 *     id: 'workflow:account',
 *     name: 'Account Management',
 *     // ...
 *   };
 *
 *   protected entityConfig: EntityConfig<Account> = {
 *     name: 'Account',
 *     fields: [
 *       { name: 'name', type: 'text', required: true },
 *       { name: 'email', type: 'email', required: true },
 *       // ...
 *     ]
 *   };
 *
 *   async validateField(fieldName, value) {
 *     if (fieldName === 'email') {
 *       return CommonValidators.isValidEmail(value);
 *     }
 *   }
 * }
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
} from "@/server/skills/base/base-skill";
import { GenericRepository } from "@/server/db/base/generic-repository";
import { ResponseBuilder } from "@/server/utils/response-builder";
import { CommonValidators } from "@/server/utils/validators";
import { CommonFormatters } from "@/server/utils/formatters";

/**
 * Entity field definition
 */
export interface EntityField<T> {
  name: keyof T;
  label?: string;
  type:
    | "text"
    | "email"
    | "url"
    | "phone"
    | "number"
    | "currency"
    | "date"
    | "textarea"
    | "select"
    | "checkbox"
    | "color";
  required?: boolean;
  readonly?: boolean;
  description?: string;
  placeholder?: string;
  validation?: (value: any) => boolean;
  options?: { label: string; value: any }[];
}

/**
 * Entity configuration
 */
export interface EntityConfig<T> {
  name: string;
  pluralName?: string;
  fields: EntityField<T>[];
  readonlyFields?: (keyof T)[];
}

/**
 * CRUD input interface
 */
export interface CRUDInput {
  action: "create" | "read" | "update" | "delete" | "list" | "search" | "view";
  entityId?: string;
  fieldName?: string;
  fieldValue?: any;
  query?: string;
  page?: number;
  limit?: number;
  workflowState?: Record<string, any>;
  userId: string;
}

/**
 * Generic CRUD skill base class
 */
export abstract class GenericEntityCRUDSkill<T> extends BaseSkill {
  abstract metadata: SkillMetadata;
  abstract readonly repository: GenericRepository<T>;
  protected abstract entityConfig: EntityConfig<T>;

  /**
   * Check if skill can handle input
   */
  canHandle(input: any): boolean {
    if (!input || typeof input !== "object") return false;
    const { action } = input;
    return [
      "create",
      "read",
      "update",
      "delete",
      "list",
      "search",
      "view",
    ].includes(action);
  }

  /**
   * Execute CRUD workflow
   */
  async execute(input: CRUDInput): Promise<SkillResult> {
    const { action } = input;

    if (!action) {
      return ResponseBuilder.error("Missing action parameter");
    }

    try {
      switch (action) {
        case "create":
          return await this.handleCreate(input);
        case "read":
          return await this.handleRead(input);
        case "update":
          return await this.handleUpdate(input);
        case "delete":
          return await this.handleDelete(input);
        case "list":
          return await this.handleList(input);
        case "search":
          return await this.handleSearch(input);
        case "view":
          return await this.handleView(input);
        default:
          return ResponseBuilder.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[${this.metadata.name}] ❌ EXECUTION FAILED`, {
        action,
        error: msg,
      });
      return ResponseBuilder.error(
        `Failed to ${action} ${this.entityConfig.name}`,
        msg
      );
    }
  }

  /**
   * CREATE - Multi-step form workflow
   * Progressively collects required fields
   */
  protected async handleCreate(input: CRUDInput): Promise<SkillResult> {
    const state = input.workflowState || {};
    const requiredFields = this.entityConfig.fields.filter((f) => f.required);

    // Collect next required field
    const nextMissing = requiredFields.find((f) => !state[f.name as string]);

    if (!nextMissing) {
      // All required fields collected - create entity
      const createData = this.buildCreateData(state, input.userId);
      const result = await this.repository.create(createData);

      if (!result.success) {
        return ResponseBuilder.error(
          `Failed to create ${this.entityConfig.name}`,
          result.error
        );
      }

      return ResponseBuilder.success(
        `${this.entityConfig.name} created successfully`,
        result.data,
        "create_success",
        "view"
      );
    }

    // Ask for next field
    const prompt = this.getFieldPrompt(nextMissing);
    const step =
      requiredFields.filter((f) => state[f.name as string]).length + 1;

    return ResponseBuilder.workflowStep(
      `Please provide ${prompt}`,
      step,
      requiredFields.length,
      String(nextMissing.name),
      nextMissing.type,
      nextMissing.description || "",
      state
    ) as any;
  }

  /**
   * READ - Fetch single entity and display details
   */
  protected async handleRead(input: CRUDInput): Promise<SkillResult> {
    if (!input.entityId) {
      return ResponseBuilder.error("Missing entityId");
    }

    const result = await this.repository.read(input.entityId);

    if (!result.success) {
      return ResponseBuilder.notFound(this.entityConfig.name, input.entityId);
    }

    const formatted = this.formatDetailed(result.data!);
    return ResponseBuilder.success(
      `${this.entityConfig.name} details:`,
      formatted
    );
  }

  /**
   * UPDATE - Field-by-field conversational update
   */
  protected async handleUpdate(input: CRUDInput): Promise<SkillResult> {
    if (!input.entityId) {
      return ResponseBuilder.error("Missing entityId");
    }

    if (!input.fieldName || input.fieldValue === undefined) {
      return ResponseBuilder.error("Missing fieldName or fieldValue");
    }

    // Validate field value
    const isValid = await this.validateField(input.fieldName, input.fieldValue);
    if (!isValid) {
      return ResponseBuilder.error(`Invalid value for ${input.fieldName}`);
    }

    // Update entity
    const updateData = {
      [input.fieldName]: input.fieldValue,
    } as any;

    const result = await this.repository.update(input.entityId, updateData);

    if (!result.success) {
      return ResponseBuilder.error(
        `Failed to update ${this.entityConfig.name}`,
        result.error
      );
    }

    return ResponseBuilder.success(
      `${this.entityConfig.name} updated successfully`,
      result.data,
      "update_success"
    );
  }

  /**
   * DELETE - Confirmation-based deletion
   */
  protected async handleDelete(input: CRUDInput): Promise<SkillResult> {
    if (!input.entityId) {
      return ResponseBuilder.error("Missing entityId");
    }

    const state = input.workflowState || {};

    // First call: ask for confirmation
    if (!state.confirmDelete) {
      const entity = await this.repository.read(input.entityId);

      if (!entity.success) {
        return ResponseBuilder.notFound(this.entityConfig.name, input.entityId);
      }

      return ResponseBuilder.confirmation(
        `Are you sure you want to delete this ${this.entityConfig.name.toLowerCase()}?`,
        "delete",
        this.entityConfig.name,
        this.formatForConfirmation(entity.data!)
      );
    }

    // Second call: confirmed - execute delete
    const result = await this.repository.delete(input.entityId);

    if (!result.success) {
      return ResponseBuilder.error(
        `Failed to delete ${this.entityConfig.name}`,
        result.error
      );
    }

    return ResponseBuilder.success(
      `${this.entityConfig.name} deleted successfully`,
      null,
      "delete_success"
    );
  }

  /**
   * LIST - Show paginated list of entities
   */
  protected async handleList(input: CRUDInput): Promise<SkillResult> {
    const page = input.page || 1;
    const limit = input.limit || 20;

    const result = await this.repository.list(input.userId, {
      page,
      limit,
    });

    if (!result.success) {
      return ResponseBuilder.error(
        `Failed to list ${this.entityConfig.pluralName || this.entityConfig.name}s`,
        result.error
      );
    }

    const formatted = this.formatList(result.data!);
    return ResponseBuilder.list(
      `Found ${result.data!.length} ${this.entityConfig.pluralName || this.entityConfig.name}s`,
      formatted,
      page,
      limit,
      result.count
    ) as any;
  }

  /**
   * SEARCH - Search entities with query
   */
  protected async handleSearch(input: CRUDInput): Promise<SkillResult> {
    if (!input.query) {
      return ResponseBuilder.error("Missing search query");
    }

    const page = input.page || 1;
    const limit = input.limit || 20;

    const result = await this.repository.search(input.userId, input.query, {
      page,
      limit,
    });

    if (!result.success) {
      return ResponseBuilder.error(`Search failed`, result.error);
    }

    const formatted = this.formatList(result.data!);
    return ResponseBuilder.searchResults(
      `Search results for "${input.query}"`,
      formatted,
      input.query,
      result.count || 0,
      page,
      limit
    ) as any;
  }

  /**
   * VIEW - Alias for read with different context
   */
  protected async handleView(input: CRUDInput): Promise<SkillResult> {
    return this.handleRead(input);
  }

  /**
   * HELPER: Build create data from form state
   */
  protected buildCreateData(state: Record<string, any>, userId: string): any {
    const data: any = { userId };

    for (const field of this.entityConfig.fields) {
      const fieldName = field.name as string;
      if (state[fieldName] !== undefined) {
        data[fieldName] = state[fieldName];
      }
    }

    return data;
  }

  /**
   * HELPER: Validate field value
   * Override for entity-specific validation
   */
  protected async validateField(
    fieldName: string,
    value: any
  ): Promise<boolean> {
    const field = this.entityConfig.fields.find((f) => f.name === fieldName);

    if (!field) return false;
    if (!value && field.required) return false;

    // Type-based validation
    switch (field.type) {
      case "email":
        return CommonValidators.isValidEmail(value);
      case "url":
        return CommonValidators.isValidUrl(value);
      case "phone":
        return CommonValidators.isValidPhone(value);
      case "currency":
        return CommonValidators.isValidCurrency(value);
      case "date":
        return CommonValidators.isValidDate(value);
      case "number":
        return typeof value === "number" && !isNaN(value);
      default:
        if (field.validation) {
          return field.validation(value);
        }
        return true;
    }
  }

  /**
   * HELPER: Get prompt for field
   */
  protected getFieldPrompt(field: EntityField<T>): string {
    const label = field.label || String(field.name);

    let prompt = `${label}`;

    if (field.description) {
      prompt += ` (${field.description})`;
    }

    return prompt;
  }

  /**
   * HELPER: Format entity for confirmation (summary)
   */
  protected formatForConfirmation(entity: T): Record<string, any> {
    const summary: Record<string, any> = {};
    const keyFields = this.entityConfig.fields.slice(0, 3);

    for (const field of keyFields) {
      const value = (entity as any)[field.name];
      summary[field.label || String(field.name)] = this.formatFieldValue(
        value,
        field.type
      );
    }

    return summary;
  }

  /**
   * HELPER: Format entity in detail view
   */
  protected formatDetailed(entity: T): string {
    let output = `**${this.entityConfig.name}**\n\n`;

    for (const field of this.entityConfig.fields) {
      const value = (entity as any)[field.name];
      const label = field.label || String(field.name);
      const formatted = this.formatFieldValue(value, field.type);
      output += `${label}: ${formatted}\n`;
    }

    return output;
  }

  /**
   * HELPER: Format entity as list item
   */
  protected formatListItem(entity: T): string {
    const mainField = this.entityConfig.fields[0];
    const value = (entity as any)[mainField.name];
    return String(value);
  }

  /**
   * HELPER: Format entire list of entities
   */
  protected formatList(entities: T[]): string[] {
    return entities.map((entity) => this.formatListItem(entity));
  }

  /**
   * HELPER: Format individual field value based on type
   */
  protected formatFieldValue(value: any, fieldType: string): string {
    if (value === null || value === undefined) return "-";

    switch (fieldType) {
      case "currency":
        return CommonFormatters.currency(value);
      case "date":
        return CommonFormatters.date(value);
      case "phone":
        return CommonFormatters.phone(value);
      default:
        return String(value);
    }
  }
}
