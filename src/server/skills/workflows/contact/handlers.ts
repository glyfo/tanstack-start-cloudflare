/**
 * Contact Skill - CRUD Handlers
 *
 * Contact-specific handlers using generic base classes.
 * Delegates generic logic to base handlers, focuses on Contact domain logic.
 *
 * Uses Prisma types to eliminate duplication and ensure type safety.
 */

import { Contact } from "@prisma/client";
import { ContactRepository } from "@/server/db/contact-repository";
import {
  validateEntityData,
  getMissingFields,
  getNextRequiredField,
  areAllRequiredFieldsCollected,
  formatEntityDetailed,
  formatForEntityConfirmation,
  formatEntityList,
  createEntity,
  readEntity,
  updateEntity,
  deleteEntity,
  listEntity,
} from "@/server/skills/base";
import {
  FIELD_REGISTRY,
  REQUIRED_FIELD_NAMES,
  EDITABLE_FIELD_NAMES,
  FieldMetadata,
  CRUDResult,
  ContactWithMeta,
  ContactWithHistory,
} from "./types";

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================

export interface PersistenceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

export const REQUIRED_FIELDS: (keyof Contact)[] = REQUIRED_FIELD_NAMES;

// ============================================================================
// CONTACT-SPECIFIC VALIDATOR
// ============================================================================

/**
 * Validate contact data using generic validator
 */
const validateContactDataGeneric = (
  data: unknown,
  operation: "create" | "update" = "update"
): CRUDResult<Record<string, any>> => {
  return validateEntityData(
    data,
    FIELD_REGISTRY,
    REQUIRED_FIELD_NAMES,
    ["id", "userId", "createdAt", "updatedAt"],
    operation
  );
};

/**
 * Export for backwards compatibility and specific usage
 */
export function validateContactData(
  data: unknown,
  operation: "create" | "update" = "update"
): CRUDResult<Partial<Contact>> {
  return validateContactDataGeneric(data, operation) as CRUDResult<
    Partial<Contact>
  >;
}

// ============================================================================
// VALIDATION HELPERS - Contact Specific
// ============================================================================

/**
 * Get missing required fields
 */
export function getMissingRequiredFields(
  data: Partial<Contact>
): FieldMetadata[] {
  return getMissingFields(
    data,
    REQUIRED_FIELD_NAMES.map((k) => String(k)),
    FIELD_REGISTRY
  );
}

// ============================================================================
// CRUD OPERATION HANDLERS - Using Generic Base
// ============================================================================

/**
 * Create a new contact (legacy signature with env)
 */
export async function createContact(
  data: unknown,
  userId: string,
  env: any
): Promise<PersistenceResult<Contact>>;

/**
 * Create a new contact (new signature)
 */
export async function createContact(
  repository: ContactRepository,
  data: unknown,
  userId: string
): Promise<CRUDResult<Contact>>;

export async function createContact(
  repositoryOrData: ContactRepository | unknown,
  userIdOrUserId: string,
  env?: any
): Promise<CRUDResult<Contact> | PersistenceResult<Contact>> {
  // Handle legacy signature
  if (env && !(repositoryOrData instanceof ContactRepository)) {
    const repo = new ContactRepository(env);
    return createContactNew(repo, repositoryOrData, userIdOrUserId) as any;
  }

  // Handle new signature
  const repository = repositoryOrData as ContactRepository;
  const userId = userIdOrUserId;
  const data = env;

  return createContactNew(repository, data, userId);
}

/**
 * Read a single contact
 */
export async function readContact(
  repository: ContactRepository,
  id: string,
  userId: string,
  includeHistory: boolean = false
): Promise<CRUDResult<Contact | ContactWithHistory>> {
  return readEntity(repository, id, userId, includeHistory) as any;
}

/**
 * List contacts for a user
 */
export async function listContacts(
  repository: ContactRepository,
  userId: string,
  query?: string,
  page: number = 1,
  limit: number = 20
): Promise<CRUDResult<ContactWithMeta[]>> {
  return listEntity(repository, userId, query, page, limit) as any;
}

/**
 * Update an existing contact
 */
export async function updateContact(
  repository: ContactRepository,
  id: string,
  userId: string,
  data: unknown
): Promise<CRUDResult<Contact>> {
  return updateEntity(
    repository,
    id,
    userId,
    data,
    validateContactDataGeneric
  ) as any;
}

/**
 * Delete a contact
 */
export async function deleteContact(
  repository: ContactRepository,
  id: string,
  userId: string
): Promise<CRUDResult> {
  return deleteEntity(repository, id, userId);
}

// ============================================================================
// FORMATTING HANDLERS - Contact Specific Display
// ============================================================================

/**
 * Format a single contact for display
 */
export function formatContactForDisplay(contact: Partial<Contact>): string {
  const fields = getFieldDefinitions();
  let msg = "📋 **Confirm Details:**\n\n";

  for (const field of fields) {
    const value = contact[field.name as keyof Contact];
    if (value) {
      msg += `• **${field.label}:** ${value}\n`;
    }
  }

  return msg;
}

/**
 * Format contact for detailed display
 */
export function formatContactDetailed(
  contact: Partial<Contact>
): FormattedContact {
  return formatEntityDetailed(
    contact as Record<string, any>,
    FIELD_REGISTRY,
    ["id", "userId", "createdAt", "updatedAt"],
    "Contact"
  ) as any;
}

/**
 * Format contact list for display
 */
export function formatContactListForDisplay(
  contacts: ContactWithMeta[],
  total: number,
  page: number,
  limit: number
): FormattedContactList {
  const result = formatEntityList(
    contacts,
    (c) => `${c.firstName} ${c.lastName}`,
    (c) => `${c.email} | ${c.company || "N/A"} | ${c.jobTitle || "N/A"}`,
    total,
    page,
    limit,
    "Contacts"
  );

  return {
    title: result.title,
    contacts: result.items,
    total: result.total,
    page: result.page,
    hasMore: result.hasMore,
    markdown: result.markdown,
  };
}

/**
 * Format for confirmation display
 */
export function formatForConfirmation(contact: Partial<Contact>): string {
  const formatted = formatContactDetailed(contact);
  return (
    formatted.markdown +
    '\n**Is this correct?** Say "yes" to confirm or "no" to edit.\n'
  );
}

// ============================================================================
// FIELD HELPER FUNCTIONS
// ============================================================================

/**
 * Get all field definitions
 */
export function getFieldDefinitions(): FieldMetadata[] {
  return Object.values(FIELD_REGISTRY);
}

/**
 * Get required field definitions
 */
export function getRequiredFieldDefinitions(): FieldMetadata[] {
  return REQUIRED_FIELD_NAMES.map((name) => FIELD_REGISTRY[name]);
}

/**
 * Get optional field definitions
 */
export function getOptionalFieldDefinitions(): FieldMetadata[] {
  return getFieldDefinitions().filter((f) => !f.required);
}

/**
 * Get editable field definitions
 */
export function getEditableFieldDefinitions(): FieldMetadata[] {
  return EDITABLE_FIELD_NAMES.map(
    (name) => FIELD_REGISTRY[name as keyof Contact]
  );
}

/**
 * Get field by name
 */
export function getFieldByName(name: string): FieldMetadata | null {
  const field = FIELD_REGISTRY[name as keyof Contact];
  return field || null;
}

/**
 * Get fields by group
 */
export function getFieldsByGroup(
  group: FieldMetadata["group"]
): FieldMetadata[] {
  return getFieldDefinitions().filter((f) => f.group === group);
}

// ============================================================================
// EXPORT DEPRECATED FUNCTIONS FOR BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use getFieldDefinitions() instead
 */
export function getRequiredFields(): FieldMetadata[] {
  return getRequiredFieldDefinitions();
}

/**
 * @deprecated Use getOptionalFieldDefinitions() instead
 */
export function getOptionalFields(): FieldMetadata[] {
  return getOptionalFieldDefinitions();
}

/**
 * @deprecated Use getFieldByName() instead
 */
export function getField(name: string): FieldMetadata | undefined {
  return getFieldByName(name) || undefined;
}
