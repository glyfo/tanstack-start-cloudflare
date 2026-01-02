/**
 * Execution Agent
 * Performs CRM actions: create, update, delete records
 */

import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type StreamTextOnFinishCallback,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

export class ExecutionAgent extends AIChatAgent<any> {
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
          temperature: 0.1, // Very low temp for precise execution
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
    return `You are an Execution Agent specialized in performing CRM actions safely and accurately.

Your responsibilities:
1. **Execute CRM operations** - Create, update, delete records
2. **Validate inputs** - Ensure data quality before operations
3. **Handle errors gracefully** - Provide clear feedback on failures
4. **Confirm actions** - Always confirm what was done
5. **Log activities** - Record all operations for audit trail

Available operations:
- Create contacts, accounts, opportunities
- Update existing records
- Delete records (with confirmation)
- Batch operations
- Data imports

Safety protocols:
- Validate all required fields
- Confirm destructive operations
- Check for duplicates before creating
- Maintain data integrity
- Provide rollback information when possible

Always confirm the action taken and provide the record ID.`;
  }

  private getTools() {
    const state = (this as any).state;

    // AI SDK v6: Tools are plain objects without tool() wrapper
    return {
      createContact: {
        description: "Create a new contact in the CRM",
        parameters: z.object({
          firstName: z.string(),
          lastName: z.string(),
          email: z.string().email(),
          phone: z.string().optional(),
          company: z.string().optional(),
          title: z.string().optional(),
        }),
        execute: async (contact: any) => {
          const contacts = (await state.storage.get("contacts")) || [];

          const newContact = {
            id: crypto.randomUUID(),
            ...contact,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          contacts.push(newContact);
          await state.storage.put("contacts", contacts);

          // Log activity
          await this.logActivity("contact_created", newContact.id);

          return {
            success: true,
            contact: newContact,
            message: `Contact created: ${contact.firstName} ${contact.lastName}`,
          };
        },
      },

      updateContact: {
        description: "Update an existing contact",
        parameters: z.object({
          contactId: z.string(),
          updates: z.object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            company: z.string().optional(),
            title: z.string().optional(),
          }),
        }),
        execute: async (args: any) => {
          const { contactId, updates } = args;
          const contacts = (await state.storage.get("contacts")) || [];

          const index = contacts.findIndex((c: any) => c.id === contactId);
          if (index === -1) {
            return { success: false, error: "Contact not found" };
          }

          contacts[index] = {
            ...contacts[index],
            ...updates,
            updatedAt: new Date().toISOString(),
          };

          await state.storage.put("contacts", contacts);
          await this.logActivity("contact_updated", contactId);

          return {
            success: true,
            contact: contacts[index],
            message: "Contact updated successfully",
          };
        },
      },

      createOpportunity: {
        description: "Create a new sales opportunity",
        parameters: z.object({
          name: z.string(),
          contactId: z.string(),
          amount: z.number(),
          stage: z.string(),
          closeDate: z.string().optional(),
        }),
        execute: async (opportunity: any) => {
          const opportunities =
            (await state.storage.get("opportunities")) || [];

          const newOpp = {
            id: crypto.randomUUID(),
            ...opportunity,
            createdAt: new Date().toISOString(),
          };

          opportunities.push(newOpp);
          await state.storage.put("opportunities", opportunities);
          await this.logActivity("opportunity_created", newOpp.id);

          return {
            success: true,
            opportunity: newOpp,
            message: `Opportunity created: ${opportunity.name}`,
          };
        },
      },
    };
  }

  private async logActivity(action: string, recordId: string) {
    const state = (this as any).state;
    const activities = (await state.storage.get("activities")) || [];

    activities.unshift({
      id: crypto.randomUUID(),
      action,
      recordId,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 activities
    await state.storage.put("activities", activities.slice(0, 100));
  }
}
