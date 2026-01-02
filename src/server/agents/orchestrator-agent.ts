/**
 * Orchestrator Agent - Central Coordinator
 * Routes user requests to specialized agents based on intent
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

export class OrchestratorAgent extends AIChatAgent<any> {
  async onChatMessage(
    onFinish?: StreamTextOnFinishCallback<any>
  ): Promise<Response> {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const model = this.getModel();

        // Orchestrator with execution tools
        const result = streamText({
          model,
          messages: await convertToModelMessages(this.messages),
          system: this.getSystemPrompt(),
          tools: this.getTools(),
          temperature: 0.3,
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
    return `You are an intelligent CRM assistant that helps users manage contacts, accounts, and opportunities.

**Your capabilities**:
1. **Create contacts** - Add new contacts with their information
2. **List contacts** - View all contacts in the system
3. **Search contacts** - Find contacts by name, email, or company

**Contact Information**:
- **Required**: First Name, Last Name, Email
- **Optional**: Phone, Company, Title

**How to help users**:
1. When they ask to create a contact, use the createContact tool with the provided information
2. If information is missing, ask for the required fields (firstName, lastName, email)
3. When they want to view contacts, use the listContacts tool
4. To find specific contacts, use the searchContacts tool

Be conversational, helpful, and proactive in using the available tools.`;
  }

  private getTools() {
    // Capture Durable Object state for tool closures
    const state = (this as any).state;

    // AI SDK v6: Tools are plain objects with description, parameters, and execute
    return {
      createContact: {
        description: "Create a new contact in the CRM with their information",
        parameters: z.object({
          firstName: z.string().describe("Contact's first name"),
          lastName: z.string().describe("Contact's last name"),
          email: z.string().email().describe("Contact's email address"),
          phone: z.string().optional().describe("Contact's phone number"),
          company: z.string().optional().describe("Contact's company name"),
          title: z.string().optional().describe("Contact's job title"),
        }),
        execute: async (args: any) => {
          try {
            const contacts = (await state.storage.get("contacts")) || [];

            const newContact = {
              id: crypto.randomUUID(),
              ...args,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            contacts.push(newContact);
            await state.storage.put("contacts", contacts);

            // Log activity
            const activities = (await state.storage.get("activities")) || [];
            activities.unshift({
              id: crypto.randomUUID(),
              action: "contact_created",
              recordId: newContact.id,
              timestamp: new Date().toISOString(),
            });
            await state.storage.put("activities", activities.slice(0, 100));

            return {
              success: true,
              contact: newContact,
              message: `✅ Contact created successfully!\n\nName: ${args.firstName} ${args.lastName}\nEmail: ${args.email}\nID: ${newContact.id}`,
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create contact",
            };
          }
        },
      },

      listContacts: {
        description: "List all contacts in the CRM",
        parameters: z.object({
          limit: z
            .number()
            .optional()
            .describe("Maximum number of contacts to return"),
        }),
        execute: async (args: any) => {
          try {
            const { limit = 10 } = args;
            const contacts = (await state.storage.get("contacts")) || [];

            return {
              success: true,
              contacts: contacts.slice(0, limit),
              total: contacts.length,
              message: `Found ${contacts.length} contacts in the system.`,
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to list contacts",
            };
          }
        },
      },

      searchContacts: {
        description: "Search for contacts by name, email, or company",
        parameters: z.object({
          query: z.string().describe("Search query to find contacts"),
        }),
        execute: async (args: any) => {
          try {
            const { query } = args;
            const contacts = (await state.storage.get("contacts")) || [];

            const lowerQuery = query.toLowerCase();
            const results = contacts.filter(
              (c: any) =>
                c.firstName?.toLowerCase().includes(lowerQuery) ||
                c.lastName?.toLowerCase().includes(lowerQuery) ||
                c.email?.toLowerCase().includes(lowerQuery) ||
                c.company?.toLowerCase().includes(lowerQuery)
            );

            return {
              success: true,
              results,
              count: results.length,
              message: `Found ${results.length} contacts matching "${query}".`,
            };
          } catch (error) {
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to search contacts",
            };
          }
        },
      },
    };
  }
}
