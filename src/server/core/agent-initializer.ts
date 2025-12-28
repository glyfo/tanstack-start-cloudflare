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

const DOMAIN_SKILLS: Record<string, Array<new () => any>> = {
  sales: [ContactWorkflowSkill, ViewAllContactsSkill],
};

export class AgentInitializer {
  static setupSharedSkills(registry: SkillRegistry): void {
    registry.register(new IntentSkill());
    registry.register(new ConversationSkill());
    registry.register(new WorkflowCoordinatorSkill());
  }

  static async setupDomainGroups(
    state: any,
    env: any
  ): Promise<Map<string, SkillGroup>> {
    const groups = new Map<string, SkillGroup>();
    const storage = new StorageAdapter();

    for (const [name, config] of Object.entries(DOMAIN_CONFIGS)) {
      const group = new SkillGroup(name, { description: config.description });

      DOMAIN_SKILLS[name]?.forEach((SkillClass) =>
        group.register(new SkillClass())
      );

      await group.initialize(storage);
      groups.set(name, group);
    }

    return groups;
  }
}

export const getDomainNames = getDomainNamesFromTypes;
