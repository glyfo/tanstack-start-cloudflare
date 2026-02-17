import { useCallback } from 'react';

/**
 * useOpportunityManagement Hook
 *
 * Manages opportunity-related operations: creation and cancellation
 */

export interface OpportunityFormData {
  title: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  company?: string;
  dealValue?: number;
  stage?: string;
  expectedCloseDate?: number | string;
  description?: string;
  source?: string;
}

export function useOpportunityManagement(
  callAgentMethod: (method: string, params: unknown[]) => Promise<unknown>,
  setStatusPhase: (phase: string | null) => void,
  setStatusTool: (tool: string | null) => void,
  addMessage: (message: any) => void
) {
  /**
   * Create a new opportunity via RPC
   */
  const handleOpportunityCreate = useCallback(async (data: OpportunityFormData) => {
    console.log("[useOpportunityManagement] Opportunity form submitted:", data);
    setStatusPhase("creating");
    setStatusTool("createOpportunity");

    try {
      const result = await callAgentMethod('createOpportunity', [{
        title: data.title,
        contactId: data.contactId,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        company: data.company,
        dealValue: data.dealValue,
        stage: data.stage,
        expectedCloseDate: data.expectedCloseDate,
        description: data.description,
        source: data.source,
      }]);
      console.log("[useOpportunityManagement] Opportunity creation result:", result);
    } catch (error) {
      console.error("[useOpportunityManagement] Opportunity creation error:", error);
      setStatusPhase(null);
      setStatusTool(null);

      const errorMsg = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: `Failed to create opportunity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        parts: [{ type: "text" as const, text: `Failed to create opportunity: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        timestamp: Date.now(),
      };
      addMessage(errorMsg);
    }
  }, [callAgentMethod, setStatusPhase, setStatusTool, addMessage]);

  /**
   * Handle opportunity form cancel
   */
  const handleOpportunityCancel = useCallback(() => {
    console.log('[useOpportunityManagement] Opportunity form cancelled');
    setStatusPhase(null);
    setStatusTool(null);
  }, [setStatusPhase, setStatusTool]);

  return {
    handleOpportunityCreate,
    handleOpportunityCancel,
  };
}
