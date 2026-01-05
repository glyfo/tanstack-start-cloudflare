/**
 * Contact Workflows - Execute CRM operations
 * Pure business logic separated from agent concerns
 */

import type { Workflow } from "../agents/chat-agent";

export interface WorkflowResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Get all available contact workflows
 */
export function getContactWorkflows(): Workflow[] {
  return [
    {
      name: "create_contact",
      description: "Add new contact (needs: firstName, lastName, email)",
      handler: async (intent, state) => {
        const { firstName, lastName, email } = intent.entities;
        const contacts = (await state.storage.get("contacts")) || [];
        const newContact = {
          id: crypto.randomUUID(),
          firstName,
          lastName,
          email,
          createdAt: new Date().toISOString(),
        };
        contacts.push(newContact);
        await state.storage.put("contacts", contacts);
        return `✅ Created contact: ${firstName} ${lastName} (${email})`;
      },
    },
    {
      name: "list_contacts",
      description: "Show all contacts",
      handler: async (intent, state) => {
        const contacts = (await state.storage.get("contacts")) || [];
        if (contacts.length === 0) {
          return "No contacts found. Try creating one!";
        }
        return `📋 ${contacts.length} contacts:\n${contacts
          .map(
            (c: any, i: number) =>
              `${i + 1}. ${c.firstName} ${c.lastName} (${c.email})`
          )
          .join("\n")}`;
      },
    },
    {
      name: "search_contacts",
      description: "Find contacts (needs: query)",
      handler: async (intent, state) => {
        const contacts = (await state.storage.get("contacts")) || [];
        const query = intent.entities.query.toLowerCase();
        const results = contacts.filter(
          (c: any) =>
            c.firstName?.toLowerCase().includes(query) ||
            c.lastName?.toLowerCase().includes(query) ||
            c.email?.toLowerCase().includes(query)
        );
        if (results.length === 0) {
          return `No contacts found matching "${intent.entities.query}"`;
        }
        return `🔍 Found ${results.length} contacts:\n${results
          .map(
            (c: any, i: number) =>
              `${i + 1}. ${c.firstName} ${c.lastName} (${c.email})`
          )
          .join("\n")}`;
      },
    },
  ];
}
