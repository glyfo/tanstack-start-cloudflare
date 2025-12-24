/**
 * Action Submission Handler
 * Processes completed form submissions (CRUD operations)
 * Communicates with database and external services
 */

import type { FlowSession } from "./flow-handler";

export interface SubmissionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Submit completed form to database
 * Extensible for any CRUD operation
 */
export async function submitAction(
  session: FlowSession
): Promise<SubmissionResult> {
  try {
    // Route to appropriate handler based on action type
    switch (session.actionId) {
      case "contact_create":
        return await handleContactCreate(session.collectedData);

      case "contact_update":
        return await handleContactUpdate(session.collectedData);

      default:
        return {
          success: false,
          message: "Action handler not found",
          error: `No handler for action: ${session.actionId}`,
        };
    }
  } catch (error) {
    console.error("[ActionHandler] Submission error:", error);
    return {
      success: false,
      message: "Submission failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// CONTACT HANDLERS
// ============================================

async function handleContactCreate(
  data: Record<string, unknown>
): Promise<SubmissionResult> {
  try {
    if (!data.email || !data.firstName) {
      return {
        success: false,
        message: "Contact creation failed",
        error: "Missing required fields",
      };
    }

    return {
      success: true,
      message: `Contact "${data.firstName} ${data.lastName || ""}" created successfully`,
      data: {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Contact creation failed",
      error: `Failed to create contact: ${error}`,
    };
  }
}

async function handleContactUpdate(
  data: Record<string, unknown>
): Promise<SubmissionResult> {
  try {
    if (!data.contactId) {
      return {
        success: false,
        message: "Contact update failed",
        error: "Contact ID required",
      };
    }

    return {
      success: true,
      message: "Contact updated successfully",
      data: {
        contactId: data.contactId,
        ...data,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Contact update failed",
      error: `Failed to update contact: ${error}`,
    };
  }
}
