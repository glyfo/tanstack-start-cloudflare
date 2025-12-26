/**
 * Skill Execution Types
 * Defines interfaces for skill execution configuration and state
 */

import { SkillContext } from "@/server/skills/base/skill-context";

export interface SkillExecutionOptions {
  skillId: string;
  input: any;
  context: SkillContext;
  defaultDomain?: string;
}
