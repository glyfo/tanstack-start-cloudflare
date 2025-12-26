/**
 * [REQUIRED] Intent Detection Skill
 *
 * Detects user intent from natural language messages.
 * Uses pattern-based detection with regex to classify user input.
 * Routes to appropriate domain workflows based on detected intent.
 *
 * CATEGORY: intent
 * EXTENDS: BaseSkill
 * USED BY: IntentRouter, SkillManager
 */

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base/base-skill";

export class IntentSkill extends BaseSkill {
  metadata: SkillMetadata = {
    id: "intent",
    name: "Intent Detection",
    description: "Detect user intent from natural language messages",
    version: "1.0.0",
    category: "intent",
    tags: ["nlp", "routing", "classification"],
  };

  /**
   * Define intent patterns for each domain
   * Maps intent name to array of regex patterns
   */
  private intentPatterns: Record<string, RegExp[]> = {
    // Sales domain intents
    create_contact: [
      /create.*contact/i,
      /add.*contact/i,
      /new.*contact/i,
      /add to crm/i,
    ],
    view_contacts: [
      /view.*contact/i,
      /list.*contact/i,
      /show.*contact/i,
      /all contact/i,
    ],
    qualify_lead: [
      /interested/i,
      /interested.*demo/i,
      /interested.*pricing/i,
      /want.*demo/i,
      /schedule.*demo/i,
      /qualify.*lead/i,
    ],

    // Customer service intents
    process_refund: [
      /refund/i,
      /money back/i,
      /return.*money/i,
      /refund request/i,
    ],
    create_return: [
      /return/i,
      /send back/i,
      /want to return/i,
      /return.*product/i,
    ],

    // Support intents
    create_ticket: [
      /ticket/i,
      /support/i,
      /help/i,
      /issue/i,
      /problem/i,
      /bug/i,
    ],
    lookup_docs: [
      /documentation/i,
      /docs/i,
      /how to/i,
      /help/i,
      /guide/i,
      /tutorial/i,
    ],
  };

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
  }

  async execute(input: any): Promise<SkillResult> {
    if (!input.message || typeof input.message !== "string") {
      return {
        success: false,
        error: "Invalid input: message (string) required",
      };
    }

    const intent = this.detectIntent(input.message);

    if (!intent) {
      return {
        success: true,
        data: {
          intent: null,
          confidence: 0,
          message: input.message,
          fallback: "conversation",
        },
        nextSkill: "conversation",
      };
    }

    return {
      success: true,
      data: {
        intent,
        confidence: 0.95,
        message: input.message,
        domain: this.getDomainForIntent(intent),
      },
      nextSkill: `workflow:${intent}`,
    };
  }

  canHandle(input: any): boolean {
    return input && typeof input.message === "string";
  }

  /**
   * Detect intent from message
   */
  private detectIntent(message: string): string | null {
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return intent;
        }
      }
    }
    return null;
  }

  /**
   * Get domain for detected intent
   */
  private getDomainForIntent(intent: string): string {
    const domainMap: Record<string, string> = {
      create_contact: "sales",
      view_contacts: "sales",
      qualify_lead: "sales",
      process_refund: "customer-service",
      create_return: "customer-service",
      create_ticket: "support",
      lookup_docs: "support",
    };

    return domainMap[intent] || "general";
  }

  async cleanup(_context: SkillContext): Promise<void> {
    // No cleanup needed
  }
}
