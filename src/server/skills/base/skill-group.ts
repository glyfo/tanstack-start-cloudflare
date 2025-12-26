/**
 * [INFRASTRUCTURE] Skill Group
 *
 * Container for domain-specific skills.
 * Groups skills by domain and manages domain-specific memory.
 * Handles execution context enhancement with domain information.
 *
 * USED BY: AgentInitializer, IntentRouter
 * DEPENDS ON: BaseSkill, SkillRegistry, MemoryManager
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
} from "@/server/skills/base/base-skill";
import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { MemoryManager } from "@/server/skills/base/memory-manager";
import { SkillContext } from "@/server/skills/base/skill-context";

export interface SkillGroupConfig {
  // OPTIONAL: Custom prefix for memory keys in this domain
  memoryPrefix?: string;
  // Optional description of this domain
  description?: string;
}

export class SkillGroup {
  private domain: string;
  private registry: SkillRegistry = new SkillRegistry();
  private memoryManager?: MemoryManager;

  constructor(domain: string, _config: SkillGroupConfig = {}) {
    this.domain = domain;
  }

  /**
   * Register a skill in this group
   */
  register(skill: BaseSkill): void {
    this.registry.register(skill);
  }

  /**
   * Initialize group with state
   */
  async initialize(state: any): Promise<void> {
    this.memoryManager = new MemoryManager(state);
    await this.memoryManager.initializeDomain(this.domain, {
      domain: this.domain,
      createdAt: new Date().toISOString(),
      skillCount: this.registry.count(),
    });
  }

  /**
   * Find skill that can handle input
   */
  findSkill(input: any): BaseSkill | null {
    return this.registry.findSkill(input);
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId: string): BaseSkill | null {
    return this.registry.getSkill(skillId);
  }

  /**
   * Execute skill in this group
   */
  async execute(
    skillId: string,
    input: any,
    context: SkillContext
  ): Promise<SkillResult> {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return {
        success: false,
        error: `Skill ${skillId} not found in ${this.domain} domain`,
      };
    }

    try {
      // Enhance context with domain info
      const enhancedContext = {
        ...context,
        currentDomain: this.domain,
      };

      // Initialize skill with context
      await skill.initialize(enhancedContext);

      // Execute skill
      const result = await skill.execute(input);

      // Cleanup
      await skill.cleanup(enhancedContext);

      return result;
    } catch (error: any) {
      console.error(
        `Error executing skill ${skillId} in domain ${this.domain}:`,
        error
      );
      return {
        success: false,
        error: error.message || "Skill execution failed",
      };
    }
  }

  /**
   * List all skills in this group
   */
  listSkills(): SkillMetadata[] {
    return this.registry.listSkills();
  }

  /**
   * Get domain name
   */
  getDomain(): string {
    return this.domain;
  }

  /**
   * Get memory manager
   */
  getMemoryManager(): MemoryManager | undefined {
    return this.memoryManager;
  }

  /**
   * Store data in domain memory
   */
  async storeInMemory(key: string, data: any): Promise<void> {
    if (!this.memoryManager) {
      throw new Error("Memory manager not initialized");
    }
    await this.memoryManager.set(`${this.domain}:${key}`, data);
  }

  /**
   * Retrieve data from domain memory
   */
  async getFromMemory(key: string): Promise<any> {
    if (!this.memoryManager) {
      return null;
    }
    return this.memoryManager.get(`${this.domain}:${key}`);
  }

  /**
   * Get domain statistics
   */
  async getStats(): Promise<any> {
    return {
      domain: this.domain,
      skillCount: this.registry.count(),
      memory: await this.memoryManager?.getStats(),
    };
  }
}
