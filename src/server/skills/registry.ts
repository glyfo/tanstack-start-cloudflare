/**
 * Skill Registry
 *
 * Declarative skill configuration and initialization
 * Manages all skills with priority ordering for intent routing
 *
 * FEATURES:
 * - Declarative skill configuration
 * - Priority-based skill ordering
 * - Automatic skill initialization
 * - Easy to add/remove skills
 * - Centralized skill management
 *
 * USAGE:
 * import { SkillRegistry } from '@/server/skills/registry';
 * import { SkillContext } from '@/server/skills/base/base-skill';
 *
 * const context = { ... } as SkillContext;
 * const skills = await SkillRegistry.initializeAllSkills(context);
 *
 * // Or get skills by category
 * const workflowSkills = SkillRegistry.getSkillsByCategory('workflow');
 */

import { BaseSkill, SkillContext } from "@/server/skills/base/base-skill";
import { AccountCRUDSkill } from "@/server/skills/workflows/account";
import { ContactCRUDSkill } from "@/server/skills/workflows/contact/skill";

/**
 * Skill registration entry
 */
export interface SkillRegistryEntry {
  skill: typeof BaseSkill;
  priority: number;
  enabled: boolean;
  description?: string;
}

/**
 * Skill registry for declarative skill configuration
 */
export class SkillRegistry {
  /**
   * All registered skills with metadata
   * Priority: higher number = higher priority (evaluated first)
   * This matches Contact skill at priority 100, Account skill at 90
   */
  static readonly SKILLS_REGISTRY: SkillRegistryEntry[] = [
    {
      skill: ContactCRUDSkill,
      priority: 100,
      enabled: true,
      description: "Contact management with full CRUD operations",
    },
    {
      skill: AccountCRUDSkill,
      priority: 90,
      enabled: true,
      description: "Account/company management with full CRUD operations",
    },
    // Future skills (when implemented):
    // {
    //   skill: ProductCRUDSkill,
    //   priority: 80,
    //   enabled: true,
    //   description: "Product management with full CRUD operations",
    // },
    // {
    //   skill: OrderCRUDSkill,
    //   priority: 75,
    //   enabled: true,
    //   description: "Order management with full CRUD operations",
    // },
    // {
    //   skill: PipelineCRUDSkill,
    //   priority: 70,
    //   enabled: true,
    //   description: "Pipeline management with full CRUD operations",
    // },
    // {
    //   skill: OpportunityCRUDSkill,
    //   priority: 65,
    //   enabled: true,
    //   description: "Opportunity management with full CRUD operations",
    // },
  ];

  /**
   * Initialize all registered skills
   * Returns skill instances ordered by priority (highest first)
   */
  static async initializeAllSkills(
    context: SkillContext
  ): Promise<BaseSkill[]> {
    console.log("[SkillRegistry] 🎯 INITIALIZING ALL SKILLS");

    // Filter enabled skills and sort by priority (highest first)
    const enabledSkills = this.SKILLS_REGISTRY.filter((entry) => entry.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map((entry) => entry.skill);

    const initializedSkills: BaseSkill[] = [];

    for (const SkillClass of enabledSkills) {
      try {
        const instance = new (SkillClass as any)();
        await instance.initialize(context);
        initializedSkills.push(instance);
        console.log(
          `[SkillRegistry] ✅ INITIALIZED: ${instance.metadata.name}`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(
          `[SkillRegistry] ❌ FAILED TO INITIALIZE ${SkillClass.name}:`,
          msg
        );
      }
    }

    console.log(
      `[SkillRegistry] ✅ READY: ${initializedSkills.length} skill(s) initialized`
    );
    return initializedSkills;
  }

  /**
   * Get skills by category
   */
  static getSkillsByCategory(category: string): SkillRegistryEntry[] {
    return this.SKILLS_REGISTRY.filter(
      (entry) =>
        entry.enabled &&
        new (entry.skill as any)().metadata.category === category
    );
  }

  /**
   * Get skills by tag
   */
  static getSkillsByTag(tag: string): SkillRegistryEntry[] {
    return this.SKILLS_REGISTRY.filter(
      (entry) =>
        entry.enabled && new (entry.skill as any)().metadata.tags.includes(tag)
    );
  }

  /**
   * Get skill by ID
   */
  static getSkillById(id: string): SkillRegistryEntry | undefined {
    return this.SKILLS_REGISTRY.find(
      (entry) => entry.enabled && new (entry.skill as any)().metadata.id === id
    );
  }

  /**
   * Get all enabled skills (ordered by priority)
   */
  static getEnabledSkills(): SkillRegistryEntry[] {
    return this.SKILLS_REGISTRY.filter((entry) => entry.enabled).sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Register new skill (for dynamic registration)
   */
  static registerSkill(
    skill: typeof BaseSkill,
    priority: number,
    description?: string
  ): void {
    this.SKILLS_REGISTRY.push({
      skill,
      priority,
      enabled: true,
      description,
    });

    // Re-sort by priority
    this.SKILLS_REGISTRY.sort((a, b) => b.priority - a.priority);
    console.log(`[SkillRegistry] 🆕 REGISTERED: ${skill.name}`);
  }

  /**
   * Disable skill by ID
   */
  static disableSkill(skillId: string): void {
    const entry = this.SKILLS_REGISTRY.find(
      (s) => new (s.skill as any)().metadata.id === skillId
    );
    if (entry) {
      entry.enabled = false;
      console.log(`[SkillRegistry] 🔒 DISABLED: ${skillId}`);
    }
  }

  /**
   * Enable skill by ID
   */
  static enableSkill(skillId: string): void {
    const entry = this.SKILLS_REGISTRY.find(
      (s) => new (s.skill as any)().metadata.id === skillId
    );
    if (entry) {
      entry.enabled = true;
      console.log(`[SkillRegistry] 🔓 ENABLED: ${skillId}`);
    }
  }

  /**
   * Get summary of all skills
   */
  static getSummary(): {
    total: number;
    enabled: number;
    disabled: number;
    skills: Array<{ id: string; name: string; priority: number }>;
  } {
    const enabled = this.SKILLS_REGISTRY.filter((s) => s.enabled).length;
    const disabled = this.SKILLS_REGISTRY.filter((s) => !s.enabled).length;

    return {
      total: this.SKILLS_REGISTRY.length,
      enabled,
      disabled,
      skills: this.SKILLS_REGISTRY.map((entry) => {
        const instance = new (entry.skill as any)();
        return {
          id: instance.metadata.id,
          name: instance.metadata.name,
          priority: entry.priority,
        };
      }),
    };
  }
}
