import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { SkillGroup } from "@/server/skills/base/skill-group";

export class IntentRouter {
  constructor(
    private registry: SkillRegistry,
    private domainGroups: Map<string, SkillGroup>
  ) {}

  async detect(message: string, context: any): Promise<any | null> {
    const skill = this.registry.getSkill("intent");
    if (!skill) return null;

    await skill.initialize(context);
    const result = await skill.execute({ message });
    await skill.cleanup(context);

    return result.success ? result.data : null;
  }

  canRoute(domain: string, intent: string): boolean {
    return !!this.domainGroups.get(domain)?.getSkill(`workflow:${intent}`);
  }

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
