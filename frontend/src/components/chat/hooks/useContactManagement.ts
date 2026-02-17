import { useCallback } from 'react';
import type { Connection } from 'agents';

/**
 * useContactManagement Hook
 *
 * Manages contact-related operations: creation, search, and selection
 */

export interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

interface ContactSearchResult {
  id: string;
  name: string;
  email: string;
  company?: string;
}

export function useContactManagement(
  connection: Connection | null,
  connectionRef: React.RefObject<Connection | null>,
  callAgentMethod: (method: string, params: unknown[]) => Promise<unknown>,
  setStatusPhase: (phase: string | null) => void,
  setStatusTool: (tool: string | null) => void,
  addMessage: (message: any) => void
) {
  /**
   * Create a new contact via RPC
   */
  const handleContactCreate = useCallback(async (data: ContactFormData) => {
    console.log("[useContactManagement] ✅ handleContactCreate called with data:", data);

    setStatusPhase("creating");
    setStatusTool("createContact");

    try {
      console.log("[useContactManagement] Calling createContact RPC method");
      const result = await callAgentMethod('createContact', [{
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        source: data.source,
        tags: data.tags,
      }]);
      console.log("[useContactManagement] Contact creation result:", result);
    } catch (error) {
      console.error("[useContactManagement] Contact creation error:", error);
      setStatusPhase(null);
      setStatusTool(null);

      const errorMsg = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: `Failed to create contact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        parts: [{ type: "text" as const, text: `Failed to create contact: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        timestamp: Date.now(),
      };
      addMessage(errorMsg);
    }
  }, [callAgentMethod, setStatusPhase, setStatusTool, addMessage]);

  /**
   * Search contacts via RPC
   */
  const searchContactsRPC = useCallback(async (query: string): Promise<ContactSearchResult[]> => {
    try {
      const result = await callAgentMethod('searchContacts', [{ query, limit: 10 }]) as {
        data?: { contacts?: ContactSearchResult[] }
      };
      return result?.data?.contacts || [];
    } catch (error) {
      console.error('[useContactManagement] Search contacts error:', error);
      return [];
    }
  }, [callAgentMethod]);

  /**
   * Handle async contact search (for search boxes)
   */
  const handleSearchContacts = useCallback(async (query: string): Promise<ContactSearchResult[]> => {
    return searchContactsRPC(query);
  }, [searchContactsRPC]);

  /**
   * Handle contact selection from state-driven card
   */
  const handleContactSelectedFromState = useCallback((contact: {
    contactId: string;
    contactName: string;
    contactEmail: string;
    company?: string
  }) => {
    console.log('[useContactManagement] Contact selected from state card:', contact);
    connectionRef.current?.send(JSON.stringify({
      type: "context-update",
      context: {
        type: "flow-update",
        flowId: "create-opportunity",
        stage: 1,
        status: "active",
        action: "contact-selected",
        collectedData: {
          contactId: contact.contactId,
          contactName: contact.contactName,
          contactEmail: contact.contactEmail,
          company: contact.company,
        },
      },
    }));
  }, [connectionRef]);

  /**
   * Handle contact selection (generic)
   */
  const handleContactSelected = useCallback(async (contact: {
    contactId: string;
    contactName: string;
    contactEmail: string;
    company?: string;
  }) => {
    console.log('[useContactManagement] Contact selected:', contact);
    handleContactSelectedFromState(contact);
  }, [handleContactSelectedFromState]);

  /**
   * Handle contact form cancel
   */
  const handleContactCancel = useCallback(() => {
    console.log('[useContactManagement] Contact form cancelled');
    setStatusPhase(null);
    setStatusTool(null);
  }, [setStatusPhase, setStatusTool]);

  return {
    handleContactCreate,
    searchContactsRPC,
    handleSearchContacts,
    handleContactSelectedFromState,
    handleContactSelected,
    handleContactCancel,
  };
}
