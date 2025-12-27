/**
 * Contact Workflow - Public Exports
 *
 * Clean exports for the contact workflow module.
 * Single skill entry point with support for all CRUD operations.
 */

// Skills
export { ContactCRUDSkill as ContactWorkflowSkill } from "./skill";
export { ContactCRUDSkill } from "./skill";
export { ViewAllContactsSkill } from "./view-all";

// Types (Prisma-driven, single source of truth)
export type {
  // Prisma types
  Contact,
  ContactTag,
  ContactGroup,
  Interaction,
  Communication,
  ContactCreateInput,
  ContactUpdateInput,
  ContactWhereInput,
  // Complex types with relations
  ContactWithMeta,
  ContactWithHistory,
  ContactSummary,
  // Field metadata
  FieldMetadata,
  FieldUIType,
  // Conversational types
  CRUDAction,
  ConversationalContext,
  ConversationalResult,
  WorkflowStep,
  // CRUD operations
  CreateContactInput,
  ReadContactInput,
  UpdateContactInput,
  DeleteContactInput,
  CRUDInput,
  // Display types
  FormattedContact,
  FormattedContactList,
  // Repository
  CRUDResult,
  ValidationResult,
} from "./types";

// Constants
export {
  FIELD_REGISTRY,
  REQUIRED_FIELD_NAMES,
  EDITABLE_FIELD_NAMES,
  READONLY_FIELD_NAMES,
} from "./types";

// Handlers - CRUD Operations
export {
  createContact,
  readContact,
  listContacts,
  updateContact,
  deleteContact,
  validateContactData,
  validateFieldValue,
  areAllRequiredFieldsCollected,
  getMissingRequiredFields,
  getNextRequiredField,
} from "./handlers";

// Handlers - Field Utilities
export {
  getFieldDefinitions,
  getFieldByName,
  getRequiredFieldDefinitions,
  getOptionalFieldDefinitions,
  getEditableFieldDefinitions,
  getFieldsByGroup,
  // Deprecated but kept for compatibility
  getRequiredFields,
  getOptionalFields,
  getField,
} from "./handlers";

// Handlers - Formatting
export {
  formatContactForDisplay,
  formatContactDetailed,
  formatContactListForDisplay,
  formatForConfirmation,
} from "./handlers";

// Backwards compatibility
export { REQUIRED_FIELDS, PersistenceResult } from "./handlers";
