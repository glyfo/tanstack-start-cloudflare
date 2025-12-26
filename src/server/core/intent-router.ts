/**
 * Intent Router - Extract intent detection and routing logic
 * Reduces 20+ lines from agent-chat.ts
 */

import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { SkillGroup } from "@/server/skills/base/skill-group";

export class IntentRouter {
  constructor(
    private sharedRegistry: SkillRegistry,
    private domainGroups: Map<string, SkillGroup>
  ) {}

  /**
   * Detect intent and return routing info
   */
  async detect(message: string, context: any): Promise<any | null> {
    const skill = this.sharedRegistry.getSkill("intent");
    if (!skill) return null;

    await skill.initialize(context);
    const result = await skill.execute({ message });
    await skill.cleanup(context);

    return result.success ? result.data : null;
  }

  /**
   * Check if domain and skill exist
   */
  canRoute(domain: string, intent: string): boolean {
    const group = this.domainGroups.get(domain);
    return !!group?.getSkill(`workflow:${intent}`);
  }

  /**
   * Execute domain skill
   */
  async executeWorkflow(
    domain: string,
    intent: string,
    context: any
  ): Promise<any> {
    const group = this.domainGroups.get(domain);
    if (!group) return { success: false, error: "Domain not found" };

    return group.execute(`workflow:${intent}`, { action: "start" }, context);
  }
}
