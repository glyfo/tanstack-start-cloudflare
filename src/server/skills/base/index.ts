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
