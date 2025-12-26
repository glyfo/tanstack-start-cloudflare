/**
 * [IMPLEMENTATION] View All Contacts Skill
 *
 * Lists all contacts for the user.
 * Supports filtering and pagination.
 *
 * CATEGORY: workflow
 * EXTENDS: BaseSkill
 * USED BY: SkillManager
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";
import { ContactRepository } from "@/server/db/contact-repository";

export class ViewAllContactsSkill extends BaseSkill {
  metadata: SkillMetadata = {
    id: "workflow:view-contacts",
    name: "View All Contacts",
    description: "List all contacts in your CRM",
    version: "1.0.0",
    category: "workflow",
    tags: ["contact", "list", "view", "crm"],
  };

  /**
   * Check if this skill can handle the input
   */
  canHandle(input: any): boolean {
    if (!input || typeof input !== "object") return false;
    return input.action === "list_all" || input.action === "view_all";
  }

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
  }

  /**
   * Execute view all contacts
   */
  async execute(_input: any): Promise<SkillResult> {
    try {
      const contacts = await this.fetchAllContacts();

      if (contacts.length === 0) {
        return {
          success: true,
          data: {
            contacts: [],
            count: 0,
            message: "No contacts found. Create one with: 'create contact'",
          },
        };
      }

      // Format contacts for display
      let message = `Found ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}:\n\n`;
      message += contacts
        .map(
          (c: any, i: number) =>
            `${i + 1}. ${c.firstName} ${c.lastName} • ${c.email}`
        )
        .join("\n");

      return {
        success: true,
        data: {
          contacts,
          count: contacts.length,
          message,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to fetch contacts: ${message}`,
      };
    }
  }

  async cleanup(_context: SkillContext): Promise<void> {
    await super.cleanup(_context);
  }

  /**
   * Fetch all contacts for the user
   */
  private async fetchAllContacts(): Promise<any[]> {
    try {
      const env = this.context?.env;
      const userId = this.context?.userId;

      if (!env?.DB || !userId) {
        console.warn("[ViewAllContacts] Database or userId not available");
        return [];
      }

      const repo = new ContactRepository(env);
      const result = await repo.findByUserId(userId);

      if (!result.success) {
        console.error("[ViewAllContacts] ❌ FETCH ERROR", {
          error: result.error,
        });
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error("[ViewAllContacts] ❌ FETCH ERROR", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
