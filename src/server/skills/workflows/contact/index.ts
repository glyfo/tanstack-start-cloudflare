/**
 * Contact Workflow - Public Exports
 *
 * Clean exports for the contact workflow module.
 */

// Skills
export { ContactWorkflowSkill } from "./skill";
export { ViewAllContactsSkill } from "./view-all";

// Schemas and types
export {
  ContactSchema,
  ContactEntitySchema,
  WorkflowStateSchema,
  validateContact,
  validatePartialContact,
  validateField,
  type Contact,
  type ContactEntity,
  type PartialContact,
  type WorkflowState,
} from "./schemas";

// Handlers and utilities
export {
  createContact,
  getFieldDefinitions,
  getRequiredFields,
  getOptionalFields,
  getField,
  validateFieldValue,
  getNextRequiredField,
  areAllRequiredFieldsCollected,
  formatContactForDisplay,
  type FieldMetadata,
  type PersistenceResult,
} from "./handlers";
