/**
 * Verification Agent
 * Validates data quality, results, and ensures accuracy
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
  type StreamTextOnFinishCallback,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

export class VerificationAgent extends AIChatAgent<any> {
  async onChatMessage(
    onFinish?: StreamTextOnFinishCallback<any>
  ): Promise<Response> {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const model = this.getModel();

        const result = streamText({
          model,
          messages: await convertToModelMessages(this.messages),
          system: this.getSystemPrompt(),
          tools: this.getTools(),
          temperature: 0.1, // Very low temp for accurate validation
          onFinish,
        });

        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  private getModel() {
    const env = (this as any).env;
    const workersai = createWorkersAI({ binding: env.AI });
    return workersai("@cf/meta/llama-3-8b-instruct");
  }

  private getSystemPrompt(): string {
    return `You are a Verification Agent specialized in quality assurance for CRM operations.

Your responsibilities:
1. **Validate data quality** - Check for completeness, accuracy, format
2. **Detect duplicates** - Identify potential duplicate records
3. **Verify operations** - Ensure actions completed successfully
4. **Data integrity** - Check relationships and consistency
5. **Quality scoring** - Rate data quality and suggest improvements

Validation rules:
- Email formats must be valid
- Phone numbers properly formatted
- Required fields present
- No duplicate contacts (same email)
- Proper data types
- Logical consistency (e.g., close dates in future)

Quality checks:
- Missing information flagged
- Outdated data identified
- Incomplete profiles noted
- Relationship integrity verified

Provide clear, actionable feedback with severity levels:
- 🔴 CRITICAL: Must fix (blocks operations)
- 🟡 WARNING: Should fix (reduces quality)
- 🟢 PASSED: All checks passed

Be thorough and precise in your assessments.`;
  }

  private getTools() {
    return {
      validateContact: tool({
        description: "Validate a contact's data quality",
        parameters: z.object({
          contact: z.object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            email: z.string().optional(),
            phone: z.string().optional(),
          }),
        }),
        execute: async ({ contact }) => {
          const issues: ValidationIssue[] = [];

          // Required field checks
          if (!contact.firstName) {
            issues.push({
              severity: "CRITICAL",
              field: "firstName",
              message: "First name is required",
            });
          }
          if (!contact.lastName) {
            issues.push({
              severity: "CRITICAL",
              field: "lastName",
              message: "Last name is required",
            });
          }
          if (!contact.email) {
            issues.push({
              severity: "CRITICAL",
              field: "email",
              message: "Email is required",
            });
          }

          // Format checks
          if (contact.email && !this.isValidEmail(contact.email)) {
            issues.push({
              severity: "CRITICAL",
              field: "email",
              message: "Invalid email format",
            });
          }

          if (contact.phone && !this.isValidPhone(contact.phone)) {
            issues.push({
              severity: "WARNING",
              field: "phone",
              message: "Phone number format may be invalid",
            });
          }

          return {
            valid: issues.filter((i) => i.severity === "CRITICAL").length === 0,
            issues,
            score: this.calculateQualityScore(contact, issues),
          };
        },
      }),

      checkDuplicates: tool({
        description: "Check for duplicate contacts",
        parameters: z.object({
          email: z.string().email(),
        }),
        execute: async ({ email }) => {
          const state = (this as any).state;
          const contacts = (await state.storage.get("contacts")) || [];

          const duplicates = contacts.filter(
            (c: any) => c.email.toLowerCase() === email.toLowerCase()
          );

          return {
            hasDuplicates: duplicates.length > 0,
            count: duplicates.length,
            duplicates,
          };
        },
      }),

      auditDataQuality: tool({
        description: "Perform comprehensive data quality audit",
        parameters: z.object({}),
        execute: async () => {
          const state = (this as any).state;
          const contacts = (await state.storage.get("contacts")) || [];

          let totalScore = 0;
          const issues: any[] = [];

          for (const contact of contacts) {
            const validation = await this.getTools().validateContact.execute({
              contact,
            });
            totalScore += validation.score;
            issues.push(...validation.issues);
          }

          const avgScore =
            contacts.length > 0 ? totalScore / contacts.length : 0;

          return {
            totalContacts: contacts.length,
            averageQualityScore: avgScore.toFixed(2),
            criticalIssues: issues.filter((i) => i.severity === "CRITICAL")
              .length,
            warnings: issues.filter((i) => i.severity === "WARNING").length,
            recommendations: this.generateRecommendations(avgScore, issues),
          };
        },
      }),
    };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    return (
      /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, "").length >= 10
    );
  }

  private calculateQualityScore(
    contact: any,
    issues: ValidationIssue[]
  ): number {
    let score = 100;

    issues.forEach((issue) => {
      if (issue.severity === "CRITICAL") score -= 20;
      if (issue.severity === "WARNING") score -= 5;
    });

    // Bonus points for additional info
    if (contact.phone) score += 5;
    if (contact.company) score += 5;
    if (contact.title) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(avgScore: number, issues: any[]): string[] {
    const recommendations: string[] = [];

    if (avgScore < 50) {
      recommendations.push(
        "🔴 Data quality is critically low. Immediate cleanup recommended."
      );
    } else if (avgScore < 75) {
      recommendations.push(
        "🟡 Data quality needs improvement. Schedule data enrichment."
      );
    } else {
      recommendations.push(
        "🟢 Data quality is good. Maintain current standards."
      );
    }

    const criticalCount = issues.filter(
      (i) => i.severity === "CRITICAL"
    ).length;
    if (criticalCount > 0) {
      recommendations.push(
        `Fix ${criticalCount} critical data issues before proceeding.`
      );
    }

    return recommendations;
  }
}

interface ValidationIssue {
  severity: "CRITICAL" | "WARNING" | "INFO";
  field: string;
  message: string;
}
