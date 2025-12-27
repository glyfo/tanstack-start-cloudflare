/**
 * Base Skill Framework
 *
 * This folder contains the infrastructure/foundation for all skills.
 * Skills extend these base classes and types to create capabilities.
 *
 * DO NOT add business logic here. This is framework code only.
 */

export {
  BaseSkill,
  type SkillMetadata,
  type SkillContext,
  type SkillResult,
  type ChatMessage,
} from "./base-skill";
export {
  type SkillContextState,
  type SkillExecutionContext,
} from "./skill-context";
export { SkillRegistry } from "./skill-registry";
export { SkillGroup, type SkillGroupConfig } from "./skill-group";
export {
  MemoryManager,
  type MemoryEntry,
  type MemoryStats,
} from "./memory-manager";
export {
  WorkflowSkill,
  type WorkflowState,
  type FieldDefinition,
} from "./workflow-skill";

// Generic Entity Framework - Reusable handlers for all entities
export {
  IEntityRepository,
  ISearchableRepository,
  isSearchable,
} from "./entity-repository.interface";
export type { IEntityRepository as IGenericRepository };

export {
  validateFieldValue,
  validateEntityData,
  getMissingFields,
  getNextRequiredField,
  areAllRequiredFieldsCollected,
  validateEntityIds,
} from "./entity-validator";
export type { EntityFieldRegistry };

export {
  createEntity,
  readEntity,
  updateEntity,
  deleteEntity,
  listEntity,
} from "./entity-crud-handlers";

export {
  formatEntityDetailed,
  formatForEntityConfirmation,
  formatEntityForDisplay,
  formatEntityList,
} from "./entity-formatter";
export type { FormattedEntity, FormattedEntityList };
