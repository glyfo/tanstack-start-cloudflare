/**
 * [INFRASTRUCTURE] Skill Registry
 *
 * Manages skill registration and discovery.
 * Enables dynamic lookup of skills by ID, capability, category, or tag.
 *
 * USED BY: AgentInitializer, SkillManager, IntentRouter
 * DEPENDS ON: BaseSkill
 */

import { BaseSkill, SkillMetadata } from "@/server/skills/base/base-skill";

export class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map();
  private skillMetadata: Map<string, SkillMetadata> = new Map();

  /**
   * Register a skill in the registry
   */
  register(skill: BaseSkill): void {
    if (!skill.metadata.id) {
      throw new Error("Skill must have an ID");
    }

    if (this.skills.has(skill.metadata.id)) {
      console.warn(
        `Skill ${skill.metadata.id} already registered, overwriting`
      );
    }

    this.skills.set(skill.metadata.id, skill);
    this.skillMetadata.set(skill.metadata.id, skill.metadata);
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId: string): BaseSkill | null {
    return this.skills.get(skillId) || null;
  }

  /**
   * Find skill that can handle input
   * Checks canHandle() method on each skill until one returns true
   */
  findSkill(input: any): BaseSkill | null {
    for (const skill of this.skills.values()) {
      if (skill.canHandle(input)) {
        return skill;
      }
    }
    return null;
  }

  /**
   * List all available skills
   */
  listSkills(): SkillMetadata[] {
    return Array.from(this.skillMetadata.values());
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: string): SkillMetadata[] {
    return Array.from(this.skillMetadata.values()).filter(
      (m) => m.category === category
    );
  }

  /**
   * Get skills by tag
   */
  getSkillsByTag(tag: string): SkillMetadata[] {
    return Array.from(this.skillMetadata.values()).filter((m) =>
      m.tags.includes(tag)
    );
  }

  /**
   * Get total number of registered skills
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Check if skill exists
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * Get all skill IDs
   */
  getAllSkillIds(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Clear all skills
   */
  clear(): void {
    this.skills.clear();
    this.skillMetadata.clear();
  }
}
