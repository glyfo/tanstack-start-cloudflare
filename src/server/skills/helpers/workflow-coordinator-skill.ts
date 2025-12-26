/**
 * [HELPER] Workflow Coordinator Skill
 *
 * Orchestrates multi-step workflows and coordinates submission.
 * Acts as the bridge between form collection and persistence.
 *
 * CATEGORY: coordinator
 * EXTENDS: BaseSkill
 * USED BY: ChatAgent (manages workflow execution)
 *
 * This skill:
 * - Manages form collection state
 * - Routes completed workflows to persistence layer
 * - Handles workflow lifecycle (start, collect, submit, complete)
 *
 * NOTE: This skill USES workflow-specific helpers:
 * - /skills/workflows/contact/ - Contact form utilities & persistence
 * - Future: /skills/workflows/support/ - Support form utilities & persistence
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";
import { createContact } from "@/server/skills/workflows/contact/handlers";

export class WorkflowCoordinatorSkill extends BaseSkill {
  metadata: SkillMetadata = {
    id: "coordinator:workflow",
    name: "Workflow Coordinator",
    description:
      "Orchestrate workflows and coordinate submission to persistence layer",
    version: "1.0.0",
    category: "tool",
    tags: ["orchestration", "workflow", "submission"],
  };

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
  }

  /**
   * Execute workflow coordination
   * Handles different phases: start, collect_field, submit
   */
  async execute(input: any): Promise<SkillResult> {
    const { action, session, data } = input;

    if (!action) {
      return { success: false, error: "Missing action" };
    }

    switch (action) {
      case "submit_workflow":
        return await this.submitWorkflow(session);

      case "collect_field":
        return await this.collectField(session, data);

      default:
        return {
          success: false,
          error: `Unknown coordinator action: ${action}`,
        };
    }
  }

  /**
   * Handle workflow submission
   * Routes to appropriate workflow's persistence layer
   */
  private async submitWorkflow(session: any): Promise<SkillResult> {
    if (!session) {
      return { success: false, error: "No session provided" };
    }

    try {
      // Route to appropriate workflow's persistence handler
      let result: any;

      if (session.actionId.includes("contact")) {
        // Use contact workflow's persistence layer
        result = await createContact(session.data);
      } else {
        return {
          success: false,
          error: `No persistence handler for workflow: ${session.actionId}`,
        };
      }

      if (result.success) {
        return {
          success: true,
          data: {
            message: result.message,
            submissionData: result.data,
          },
        };
      } else {
        return {
          success: false,
          error: result.error || "Submission failed",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Workflow submission error: ${error.message}`,
      };
    }
  }

  /**
   * Handle field collection
   * Coordinates with form-handler infrastructure
   */
  private async collectField(session: any, data: any): Promise<SkillResult> {
    if (!session || !data) {
      return { success: false, error: "Missing session or data" };
    }

    try {
      // This would coordinate with form collection logic
      return {
        success: true,
        data: {
          status: "Field collected",
          session,
          fieldData: data,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Field collection error: ${error.message}`,
      };
    }
  }

  canHandle(input: any): boolean {
    return (
      input &&
      input.action &&
      (input.action === "submit_workflow" || input.action === "collect_field")
    );
  }

  async cleanup(_context: SkillContext): Promise<void> {
    // Cleanup if needed
  }
}
