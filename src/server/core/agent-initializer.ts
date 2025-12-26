/**
 * Agent Initializer - Handle all setup logic
 * Manages skill groups and shared skills initialization
 */

import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { SkillGroup } from "@/server/skills/base/skill-group";
import { IntentSkill } from "@/server/skills/required/intent-skill";
import { ConversationSkill } from "@/server/skills/required/conversation-skill";
import {
  ContactWorkflowSkill,
  ViewAllContactsSkill,
} from "@/server/skills/workflows/contact";
import { WorkflowCoordinatorSkill } from "@/server/skills/helpers/workflow-coordinator-skill";
import { StorageAdapter } from "@/server/state/storage-adapter";
import {
  DOMAIN_CONFIGS,
  getDomainNames as getDomainNamesFromTypes,
} from "@/types/domain-types";

export class AgentInitializer {
  /**
   * Setup shared skills
   */
  static setupSharedSkills(registry: SkillRegistry): void {
    registry.register(new IntentSkill());
    registry.register(new ConversationSkill());
  }

  /**
   * Setup all domain groups
   */
  static async setupDomainGroups(
    _state: any,
    _env: any
  ): Promise<Map<string, SkillGroup>> {
    const groups = new Map<string, SkillGroup>();
    // Create storage adapter for memory management
    const storageAdapter = new StorageAdapter();

    for (const [name, config] of Object.entries(DOMAIN_CONFIGS)) {
      const group = new SkillGroup(name, { description: config.description });

      // Register skills for domain
      switch (name) {
        case "sales":
          group.register(new ContactWorkflowSkill());
          group.register(new ViewAllContactsSkill());
          break;
        // TODO: customer-service, support domains
      }

      await group.initialize(storageAdapter);
      groups.set(name, group);
    }

    return groups;
  }

  /**
   * Register shared coordinator skill
   * Handles workflow orchestration and submission coordination
   */
  static registerCoordinatorSkill(registry: SkillRegistry): void {
    registry.register(new WorkflowCoordinatorSkill());
  }
}

/**
 * Get all available domain names
 */
export const getDomainNames = getDomainNamesFromTypes;
