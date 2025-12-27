/**
 * ⚠️ DEPRECATED - Use handlers.ts and @prisma/client instead
 *
 * This file maintained for backwards compatibility only.
 */

import { Contact } from "@prisma/client";

export type { Contact };

/**
 * Partial contact type
 * @deprecated Use Partial<Contact> from @prisma/client
 */
export type PartialContact = Partial<Contact>;

/**
 * Workflow state type
 * @deprecated Not used - simplify workflow state management
 */
export interface ContactWorkflowState {
  id: string;
  type: "create_contact";
  status: "active" | "pending_confirmation" | "complete" | "cancelled";
  collectedData: PartialContact;
  currentStep: number;
  totalSteps: number;
  startedAt: Date;
  confirmedAt?: Date;
}
