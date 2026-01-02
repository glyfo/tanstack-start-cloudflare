/**
 * Knowledge Agent
 * Retrieves, searches, and provides context from CRM data
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

export class KnowledgeAgent extends AIChatAgent<any> {
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
          temperature: 0.2, // Lower temp for factual retrieval
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
    return `You are a Knowledge Agent specialized in retrieving and analyzing CRM data.

Your responsibilities:
1. **Search CRM data** - Find contacts, accounts, deals, activities
2. **Provide context** - Enrich requests with relevant historical data
3. **Generate insights** - Analyze patterns and trends
4. **Answer questions** - Provide accurate information about records
5. **Summarize data** - Present information clearly and concisely

Available data sources:
- Contacts database
- Accounts/Companies
- Opportunities/Deals
- Activities (calls, emails, meetings)
- Notes and interactions

When retrieving data:
- Always verify the source
- Provide the most recent information
- Flag any data quality issues
- Suggest related information that might be helpful

Be accurate, thorough, and cite your sources.`;
  }

  private getTools() {
    return {
      searchContacts: tool({
        description:
          "Search for contacts in the CRM by name, email, or company",
        parameters: z.object({
          query: z.string().describe("Search query"),
          limit: z.number().optional().describe("Max results to return"),
        }),
        execute: async ({ query, limit = 10 }) => {
          // This will be connected to D1 database in future
          const state = (this as any).state;
          const contacts = (await state.storage.get("contacts")) || [];

          return {
            query,
            results: contacts.slice(0, limit),
            total: contacts.length,
          };
        },
      }),

      getContactDetails: tool({
        description: "Get detailed information about a specific contact",
        parameters: z.object({
          contactId: z.string().describe("Contact ID"),
        }),
        execute: async ({ contactId }) => {
          const state = (this as any).state;
          const contacts = (await state.storage.get("contacts")) || [];
          const contact = contacts.find((c: any) => c.id === contactId);

          return contact || { error: "Contact not found" };
        },
      }),

      getRecentActivity: tool({
        description: "Get recent CRM activity (last interactions, updates)",
        parameters: z.object({
          limit: z
            .number()
            .optional()
            .describe("Number of activities to retrieve"),
        }),
        execute: async ({ limit = 5 }) => {
          const state = (this as any).state;
          const activities = (await state.storage.get("activities")) || [];

          return {
            activities: activities.slice(0, limit),
            total: activities.length,
          };
        },
      }),
    };
  }
}
