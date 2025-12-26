/**
 * Skill Manager - Extracts repetitive skill initialization/execution patterns
 * Reduces 100+ lines from agent-chat.ts
 */

import { BaseSkill } from "@/server/skills/base/base-skill";
import { SkillRegistry } from "@/server/skills/base/skill-registry";
import { SkillGroup } from "@/server/skills/base/skill-group";
import { SkillContext } from "@/server/skills/base/skill-context";
import { SkillExecutionOptions } from "@/types/skill-execution-types";
import { WsResponseFormatter } from "@/server/utils/ws-response-formatter";

/**
 * Manages skill discovery, initialization, execution, and cleanup
 * Eliminates repeated try-catch-cleanup patterns
 */
export class SkillManager {
  constructor(
    private sharedRegistry: SkillRegistry,
    private domainGroups: Map<string, SkillGroup>
  ) {}

  /**
   * Find skill by ID in shared registry or domain groups
   */
  findSkill(skillId: string): { skill: BaseSkill | null; domain: string } {
    // Try shared registry first
    const shared = this.sharedRegistry.getSkill(skillId);
    if (shared) return { skill: shared, domain: "shared" };

    // Then search domain groups
    for (const [domain, group] of this.domainGroups) {
      const skill = group.getSkill(skillId);
      if (skill) return { skill, domain };
    }

    return { skill: null, domain: "" };
  }

  /**
   * Execute skill with automatic initialization and cleanup
   * Returns true if successful, false otherwise
   */
  async executeSkill(
    ws: any,
    options: SkillExecutionOptions,
    onSuccess?: (result: any, domain: string) => void,
    onError?: (error: string) => void
  ): Promise<boolean> {
    const skillId = options.skillId;
    const startTime = Date.now();

    console.log(`[SkillManager] 🔍 FINDING SKILL: ${skillId}`);
    const { skill, domain } = this.findSkill(skillId);
    console.log(`[SkillManager] 📍 SKILL LOOKUP RESULT:`, {
      skillId,
      found: !!skill,
      domain,
      skillName: skill?.metadata?.name,
    });

    if (!skill) {
      const error = `Skill not found: ${skillId}`;
      console.error(`[SkillManager] ❌ ${error}`);
      onError?.(error) ?? WsResponseFormatter.sendError(ws, error);
      return false;
    }

    try {
      console.log(`[SkillManager] 🚀 INITIALIZING SKILL: ${skillId}`);
      await skill.initialize(options.context);
      console.log(`[SkillManager] ✅ SKILL INITIALIZED: ${skillId}`);

      console.log(`[SkillManager] ⚙️ EXECUTING SKILL: ${skillId}`, {
        inputKeys: options.input ? Object.keys(options.input) : [],
      });
      const result = await skill.execute(options.input);
      console.log(`[SkillManager] 📊 SKILL EXECUTION RESULT: ${skillId}`, {
        success: result.success,
        hasData: !!result.data,
        hasError: !!result.error,
        duration: Date.now() - startTime,
      });

      console.log(`[SkillManager] 🧹 CLEANING UP SKILL: ${skillId}`);
      await skill.cleanup(options.context);
      console.log(`[SkillManager] ✨ CLEANUP COMPLETE: ${skillId}`);

      if (result.success) {
        console.log(
          `[SkillManager] ✅ CALLING SUCCESS CALLBACK for ${skillId}`
        );
        onSuccess?.(result, domain);
        return true;
      } else {
        const error = result.error || "Skill execution failed";
        console.error(`[SkillManager] ❌ SKILL FAILED: ${skillId}`, { error });
        onError?.(error) ?? WsResponseFormatter.sendError(ws, error);
        return false;
      }
    } catch (error: any) {
      const errorMsg = error.message || "Skill execution error";
      console.error(`[SkillManager] 💥 EXCEPTION in ${skillId}:`, {
        error: errorMsg,
        stack: error.stack?.substring(0, 300),
        duration: Date.now() - startTime,
      });
      onError?.(errorMsg) ?? WsResponseFormatter.sendError(ws, errorMsg);
      return false;
    }
  }

  /**
   * Execute skill in a domain group
   */
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
