/**
 * Contact Skill - Types
 *
 * Single source of truth using Prisma-generated types.
 * Eliminates duplication, ensures consistency.
 *
 * Hierarchy:
 * 1. Prisma Types (auto-generated)
 * 2. Domain Types (business logic)
 * 3. Conversational Types (workflow state)
 * 4. UI Types (presentation)
 */

import {
  Contact,
  ContactTag,
  ContactGroup,
  Interaction,
  Communication,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";

// ============================================================================
// SECTION 1: Prisma-Derived Types (Import, don't redefine)
// ============================================================================

// Re-export for convenience
export type { Contact, ContactTag, ContactGroup, Interaction, Communication };

// Prisma input types (for CRUD operations)
export type ContactCreateInput = Prisma.ContactCreateInput;
export type ContactUpdateInput = Prisma.ContactUpdateInput;
export type ContactWhereInput = Prisma.ContactWhereInput;
export type ContactWhereUniqueInput = Prisma.ContactWhereUniqueInput;

export type TagCreateInput = Prisma.ContactTagCreateInput;
export type TagUpdateInput = Prisma.ContactTagUpdateInput;
export type GroupCreateInput = Prisma.ContactGroupCreateInput;
export type GroupUpdateInput = Prisma.ContactGroupUpdateInput;
export type InteractionCreateInput = Prisma.InteractionCreateInput;
export type InteractionUpdateInput = Prisma.InteractionUpdateInput;
export type CommunicationCreateInput = Prisma.CommunicationCreateInput;
export type CommunicationUpdateInput = Prisma.CommunicationUpdateInput;

// ============================================================================
// SECTION 2: Complex Types (with relations)
// ============================================================================

/**
 * Contact with tags and groups (for list views)
 */
export type ContactWithMeta = Prisma.ContactGetPayload<{
  include: { tags: true; groups: true };
}>;

/**
 * Contact with full history (for detail views)
 */
export type ContactWithHistory = Prisma.ContactGetPayload<{
  include: {
    tags: true;
    groups: true;
  };
}>;

/**
 * Contact for listing (minimal, paginated)
 */
export type ContactSummary = Pick<
  Contact,
  "id" | "firstName" | "lastName" | "email" | "company" | "updatedAt"
>;

// ============================================================================
// SECTION 3: Field Metadata (Eliminates FIELD_UI duplication)
// ============================================================================

/**
 * UI type for form fields
 */
export type FieldUIType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "date"
  | "number";

/**
 * Comprehensive field metadata combining:
 * - Prisma schema info
 * - UI presentation
 * - Validation rules
 */
export interface FieldMetadata {
  /** Field name as in Prisma schema */
  name: keyof Contact;
  /** Display label for UI */
  label: string;
  /** Field type for HTML input */
  type: FieldUIType;
  /** Whether field is required */
  required: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Logical grouping */
  group: "basic" | "work" | "personal" | "custom";
  /** Help text for user */
  helpText?: string;
  /** Pattern for validation (if applicable) */
  pattern?: string;
  /** Max length (if applicable) */
  maxLength?: number;
  /** Min length (if applicable) */
  minLength?: number;
  /** Enum values (if applicable) */
  enum?: string[];
  /** Zod schema for validation */
  zodSchema?: z.ZodSchema;
}

/**
 * Complete field registry (eliminates FIELD_UI object)
 * Maps directly to Contact schema in Prisma
 */
export const FIELD_REGISTRY: Record<keyof Contact, FieldMetadata> = {
  id: {
    name: "id",
    label: "ID",
    type: "text",
    required: false,
    group: "custom",
    placeholder: "auto-generated",
  },
  firstName: {
    name: "firstName",
    label: "First Name",
    type: "text",
    required: true,
    group: "basic",
    placeholder: "John",
    minLength: 1,
    maxLength: 100,
  },
  lastName: {
    name: "lastName",
    label: "Last Name",
    type: "text",
    required: true,
    group: "basic",
    placeholder: "Doe",
    minLength: 1,
    maxLength: 100,
  },
  email: {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    group: "basic",
    placeholder: "john@example.com",
  },
  phone: {
    name: "phone",
    label: "Phone",
    type: "phone",
    required: false,
    group: "basic",
    placeholder: "555-123-4567",
    pattern: "[\\d\\-\\+\\s()]{10,}",
  },
  company: {
    name: "company",
    label: "Company",
    type: "text",
    required: false,
    group: "work",
    placeholder: "Acme Inc",
    maxLength: 100,
  },
  jobTitle: {
    name: "jobTitle",
    label: "Job Title",
    type: "text",
    required: false,
    group: "work",
    placeholder: "Manager",
    maxLength: 100,
  },
  address: {
    name: "address",
    label: "Address",
    type: "textarea",
    required: false,
    group: "personal",
    placeholder: "123 Main St, City, State",
    maxLength: 200,
  },
  birthday: {
    name: "birthday",
    label: "Birthday",
    type: "date",
    required: false,
    group: "personal",
  },
  relationship: {
    name: "relationship",
    label: "Relationship",
    type: "select",
    required: false,
    group: "custom",
    enum: ["friend", "colleague", "client", "prospect", "other"],
  },
  notes: {
    name: "notes",
    label: "Notes",
    type: "textarea",
    required: false,
    group: "custom",
    placeholder: "Additional information...",
    maxLength: 1000,
  },
  userId: {
    name: "userId",
    label: "User ID",
    type: "text",
    required: true,
    group: "custom",
    placeholder: "auto-set",
  },
  createdAt: {
    name: "createdAt",
    label: "Created",
    type: "date",
    required: false,
    group: "custom",
    placeholder: "auto-generated",
  },
  updatedAt: {
    name: "updatedAt",
    label: "Updated",
    type: "date",
    required: false,
    group: "custom",
    placeholder: "auto-generated",
  },
};

/**
 * Get fields by group
 */
export function getFieldsByGroup(
  group: FieldMetadata["group"]
): FieldMetadata[] {
  return Object.values(FIELD_REGISTRY).filter((f) => f.group === group);
}

/**
 * Get required fields
 */
export function getRequiredFields(): FieldMetadata[] {
  return Object.values(FIELD_REGISTRY).filter((f) => f.required);
}

/**
 * Get optional fields
 */
export function getOptionalFields(): FieldMetadata[] {
  return Object.values(FIELD_REGISTRY).filter((f) => !f.required);
}

/**
 * Get editable fields (exclude id, createdAt, updatedAt)
 */
export function getEditableFields(): FieldMetadata[] {
  return Object.values(FIELD_REGISTRY).filter(
    (f) => !["id", "createdAt", "updatedAt", "userId"].includes(f.name)
  );
}

/**
 * Get field by name
 */
export function getField(name: string): FieldMetadata | undefined {
  return FIELD_REGISTRY[name as keyof Contact];
}

// ============================================================================
// SECTION 4: Conversational Types (Workflow state)
// ============================================================================

/**
 * CRUD action type
 */
export type CRUDAction = "create" | "read" | "update" | "delete";

/**
 * Workflow step in conversational flow
 */
export interface WorkflowStep {
  type: "field_collection" | "confirmation" | "display" | "action";
  action?: CRUDAction;
  field?: FieldMetadata;
  message?: string;
  data?: any;
}

/**
 * Conversational context during CRUD workflow
 */
export interface ConversationalContext {
  workflowId: string;
  action: CRUDAction;
  status:
    | "active"
    | "pending_confirmation"
    | "complete"
    | "cancelled"
    | "error";
  entity: Contact | null;
  collectedData: Partial<Contact>;
  currentField: FieldMetadata | null;
  completedFields: (keyof Contact)[];
  errors: Record<string, string>;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  startedAt: Date;
  updatedAt: Date;
}

/**
 * Result from conversational operation
 */
export interface ConversationalResult<T = any> {
  success: boolean;
  workflowId?: string;
  action?: CRUDAction;
  status?: ConversationalContext["status"];
  message?: string;
  data?: T;
  errors?: Record<string, string>;
  nextStep?: WorkflowStep;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  stopProcessing?: boolean;
}

// ============================================================================
// SECTION 5: Repository Result Types
// ============================================================================

/**
 * Generic CRUD result
 */
export interface CRUDResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
  count?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: Record<string, string>;
  data?: any;
}

// ============================================================================
// SECTION 6: Input Types for Conversational Operations
// ============================================================================

/**
 * Input for create conversation
 */
export interface CreateContactInput {
  action: "start" | "submit_field" | "confirm" | "complete" | "cancel";
  workflowId?: string;
  fieldName?: keyof Contact;
  fieldValue?: any;
  collectedData?: Partial<Contact>;
}

/**
 * Input for read conversation
 */
export interface ReadContactInput {
  action: "start" | "select" | "view_details" | "back" | "cancel";
  workflowId?: string;
  query?: string;
  filters?: Partial<Contact>;
  page?: number;
  limit?: number;
  contactId?: string;
}

/**
 * Input for update conversation
 */
export interface UpdateContactInput {
  action:
    | "start"
    | "select_field"
    | "submit_value"
    | "confirm"
    | "complete"
    | "cancel";
  workflowId?: string;
  contactId: string;
  fieldName?: keyof Contact;
  fieldValue?: any;
  collectedChanges?: Partial<Contact>;
}

/**
 * Input for delete conversation
 */
export interface DeleteContactInput {
  action: "start" | "select" | "confirm" | "complete" | "cancel";
  workflowId?: string;
  contactId?: string;
  confirmPhrase?: string;
}

/**
 * Union of all CRUD inputs
 */
export type CRUDInput =
  | CreateContactInput
  | ReadContactInput
  | UpdateContactInput
  | DeleteContactInput;

// ============================================================================
// SECTION 7: Display/Formatting Types
// ============================================================================

/**
 * Contact formatted for display
 */
export interface FormattedContact {
  title: string;
  fields: Array<{
    label: string;
    value: string;
    group: FieldMetadata["group"];
  }>;
  markdown: string;
  compact: string;
}

/**
 * List of contacts formatted for display
 */
export interface FormattedContactList {
  title: string;
  contacts: Array<{
    id: string;
    display: string;
    preview: string;
  }>;
  total: number;
  page: number;
  hasMore: boolean;
  markdown: string;
}

// ============================================================================
// SECTION 8: Constants
// ============================================================================

/**
 * Required field names for creation
 */
export const REQUIRED_FIELD_NAMES: (keyof Contact)[] = Object.entries(
  FIELD_REGISTRY
)
  .filter(
    ([_, field]) =>
      field.required &&
      !["id", "userId", "createdAt", "updatedAt"].includes(field.name)
  )
  .map(([name]) => name as keyof Contact);

/**
 * Editable field names (for update operations)
 */
export const EDITABLE_FIELD_NAMES = getEditableFields().map((f) => f.name);

/**
 * Readonly field names (system fields)
 */
export const READONLY_FIELD_NAMES: (keyof Contact)[] = [
  "id",
  "userId",
  "createdAt",
  "updatedAt",
];
