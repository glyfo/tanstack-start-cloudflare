/**
 * Contact Workflow - Entity Schemas
 *
 * Central definition for all contact-related schemas using Zod.
 * Single source of truth for:
 * - Data validation
 * - TypeScript type inference
 * - Database persistence
 * - Form structure
 *
 * USED BY: handlers.ts, skill.ts
 */

import { z } from "zod";

// Base validation rules (reusable)
const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or less")
  .trim();

const emailSchema = z
  .string()
  .email("Invalid email address")
  .trim()
  .toLowerCase();

const phoneSchema = z
  .string()
  .regex(/[\d\-\+\s()]{10,}/, "Phone number must be at least 10 digits");

// Contact entity schema - core fields only
export const ContactSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: z
    .string()
    .max(100, "Company name must be 100 characters or less")
    .optional(),
  jobTitle: z
    .string()
    .max(100, "Job title must be 100 characters or less")
    .optional(),
  address: z
    .string()
    .max(200, "Address must be 200 characters or less")
    .optional(),
  birthday: z.string().optional(),
  relationship: z
    .enum(["friend", "colleague", "client", "prospect", "other"])
    .optional(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or less")
    .optional(),
});

// Infer TypeScript type from schema
export type Contact = z.infer<typeof ContactSchema>;

// For database - add system fields
export const ContactEntitySchema = ContactSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
});

export type ContactEntity = z.infer<typeof ContactEntitySchema>;

// Partial contact for step-by-step collection
export const PartialContactSchema = ContactSchema.partial();
export type PartialContact = z.infer<typeof PartialContactSchema>;

// Workflow state schema
export const WorkflowStateSchema = z.object({
  id: z.string(),
  type: z.literal("create_contact"),
  status: z.enum(["active", "pending_confirmation", "complete", "cancelled"]),
  collectedData: PartialContactSchema,
  currentStep: z.number(),
  totalSteps: z.number(),
  startedAt: z.date(),
  confirmedAt: z.date().optional(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

/**
 * Safe parse wrapper with error handling
 */
export function validateContact(data: unknown): {
  success: boolean;
  data?: Contact;
  errors?: Record<string, string>;
} {
  const result = ContactSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors).reduce(
      (acc, [key, msgs]) => ({
        ...acc,
        [key]: msgs?.[0] || "Invalid field",
      }),
      {}
    );

    return {
      success: false,
      errors: formatted,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate partial contact (for step collection)
 */
export function validatePartialContact(data: unknown): {
  success: boolean;
  data?: PartialContact;
  errors?: Record<string, string>;
} {
  const result = PartialContactSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors).reduce(
      (acc, [key, msgs]) => ({
        ...acc,
        [key]: msgs?.[0] || "Invalid field",
      }),
      {}
    );

    return {
      success: false,
      errors: formatted,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate specific field
 */
export function validateField(
  fieldName: keyof Contact,
  value: unknown
): { valid: boolean; error?: string } {
  try {
    const fieldSchema = ContactSchema.pick({
      [fieldName]: true,
    } as Record<keyof Contact, true>);
    fieldSchema.parse({ [fieldName]: value });
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.flatten().fieldErrors;
      const errorMsg =
        errors[fieldName as keyof typeof errors]?.[0] || "Invalid field";
      return {
        valid: false,
        error: errorMsg,
      };
    }
    return { valid: false, error: "Validation error" };
  }
}
