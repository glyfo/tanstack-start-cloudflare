import { BaseSkill } from "@/server/skills/base/base-skill";
import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { SkillGroup } from "@/server/skills/base/skill-group";
import { SkillContext } from "@/server/skills/base/skill-context";
import { SkillExecutionOptions } from "@/types/skill-execution-types";
import { WsResponseFormatter } from "@/server/utils/ws-response-formatter";

export class SkillManager {
  constructor(
    private registry: SkillRegistry,
    private domainGroups: Map<string, SkillGroup>
  ) {}

  findSkill(skillId: string): { skill: BaseSkill | null; domain: string } {
    const shared = this.registry.getSkill(skillId);
    if (shared) return { skill: shared, domain: "shared" };

    for (const [domain, group] of this.domainGroups) {
      const skill = group.getSkill(skillId);
      if (skill) return { skill, domain };
    }

    return { skill: null, domain: "" };
  }

  async executeSkill(
    ws: any,
    options: SkillExecutionOptions,
    onSuccess?: (result: any, domain: string) => void,
    onError?: (error: string) => void
  ): Promise<boolean> {
    const { skillId, input, context } = options;
    const { skill, domain } = this.findSkill(skillId);

    if (!skill) {
      const error = `Skill not found: ${skillId}`;
      onError?.(error) ?? WsResponseFormatter.sendError(ws, error);
      return false;
    }

    try {
      await skill.initialize(context);
      const result = await skill.execute(input);
      await skill.cleanup(context);

      if (result.success) {
        onSuccess?.(result, domain);
        return true;
      }

      const error = result.error || "Skill execution failed";
      onError?.(error) ?? WsResponseFormatter.sendError(ws, error);
      return false;
    } catch (error: any) {
      const errorMsg = error.message || "Skill execution error";
      onError?.(errorMsg) ?? WsResponseFormatter.sendError(ws, errorMsg);
      return false;
    }
  }

  async executeInDomain(
    domain: string,
    skillId: string,
    input: any,
    context: SkillContext
  ): Promise<any> {
    const group = this.domainGroups.get(domain);
    if (!group) return { success: false, error: `Domain not found: ${domain}` };
    return await group.execute(skillId, input, context);
  }
}
