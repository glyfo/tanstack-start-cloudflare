/**
 * Contact Workflow - Entity Handlers
 *
 * Handles contact validation and database persistence.
 * Provides the bridge between workflows and database.
 *
 * USED BY: skill.ts
 */

import {
  Contact,
  ContactEntity,
  validateContact,
  validateField,
} from "./schemas";

export interface PersistenceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

/**
 * Field metadata for UI generation
 */
export interface FieldMetadata {
  name: keyof Contact;
  type: "text" | "email" | "phone" | "textarea" | "select" | "date";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

/**
 * Get all field definitions from schema
 */
export function getFieldDefinitions(): FieldMetadata[] {
  return [
    {
      name: "firstName",
      type: "text",
      label: "First Name",
      required: true,
      placeholder: "John",
      validation: { minLength: 1, maxLength: 100 },
    },
    {
      name: "lastName",
      type: "text",
      label: "Last Name",
      required: true,
      placeholder: "Doe",
      validation: { minLength: 1, maxLength: 100 },
    },
    {
      name: "email",
      type: "email",
      label: "Email Address",
      required: true,
      placeholder: "john@example.com",
    },
    {
      name: "phone",
      type: "phone",
      label: "Phone Number",
      required: true,
      placeholder: "555-123-4567",
      validation: { pattern: "[\\d\\-\\+\\s()]{10,}" },
    },
    {
      name: "company",
      type: "text",
      label: "Company Name",
      required: false,
      placeholder: "Acme Inc",
      validation: { maxLength: 100 },
    },
    {
      name: "jobTitle",
      type: "text",
      label: "Job Title",
      required: false,
      placeholder: "Marketing Manager",
      validation: { maxLength: 100 },
    },
    {
      name: "address",
      type: "textarea",
      label: "Address",
      required: false,
      placeholder: "123 Main St, New York, NY 10001",
      validation: { maxLength: 200 },
    },
    {
      name: "birthday",
      type: "date",
      label: "Birthday",
      required: false,
    },
    {
      name: "relationship",
      type: "select",
      label: "Relationship",
      required: false,
      options: [
        { value: "friend", label: "Friend" },
        { value: "colleague", label: "Colleague" },
        { value: "client", label: "Client" },
        { value: "prospect", label: "Prospect" },
        { value: "other", label: "Other" },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      label: "Notes",
      required: false,
      placeholder: "Any additional information...",
      validation: { maxLength: 1000 },
    },
  ];
}

/**
 * Get required fields from schema
 */
export function getRequiredFields(): (keyof Contact)[] {
  return ["firstName", "lastName", "email", "phone"];
}

/**
 * Get optional fields from schema
 */
export function getOptionalFields(): (keyof Contact)[] {
  return [
    "company",
    "jobTitle",
    "address",
    "birthday",
    "relationship",
    "notes",
  ];
}

/**
 * Get field by name
 */
export function getField(name: keyof Contact): FieldMetadata | undefined {
  return getFieldDefinitions().find((f) => f.name === name);
}

/**
 * Validate and create contact
 */
export async function createContact(
  data: unknown,
  userId: string,
  _env: any
): Promise<PersistenceResult<ContactEntity>> {
  try {
    // Validate against schema
    const validation = validateContact(data);
    if (!validation.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validation.errors,
      };
    }

    const validatedData = validation.data!;

    // Create entity with system fields
    const contact: ContactEntity = {
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...validatedData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Persist to database
    const result = await persistContact(contact, _env);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Persist contact to database
 */
async function persistContact(
  contact: ContactEntity,
  _env: any
): Promise<ContactEntity> {
  try {
    // TODO: Implement actual database persistence
    // Example with D1:
    // const result = await _env.DB.prepare(
    //   contact.firstName,
    //   contact.lastName,
    //   contact.email,
    //   contact.phone,
    //   contact.company,
    //   contact.jobTitle,
    //   contact.address,
    //   contact.birthday,
    //   contact.relationship,
    //   contact.notes,
    //   contact.userId,
    //   contact.createdAt.toISOString(),
    //   contact.updatedAt.toISOString()
    // ).run();

    console.log("[ContactHandler] Persisting contact:", contact);

    // Simulate database delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return contact;
  } catch (error) {
    console.error("[ContactHandler] Persistence error:", error);
    throw error;
  }
}

/**
 * Validate field value
 */
export function validateFieldValue(
  fieldName: keyof Contact,
  value: unknown
): { valid: boolean; error?: string } {
  return validateField(fieldName, value);
}

/**
 * Get next required field from collected data
 */
export function getNextRequiredField(
  collectedData: Record<string, unknown>
): keyof Contact | null {
  const required = getRequiredFields();
  const uncollected = required.filter((field) => !collectedData[field]);
  return uncollected[0] || null;
}

/**
 * Check if all required fields are collected
 */
export function areAllRequiredFieldsCollected(
  collectedData: Record<string, unknown>
): boolean {
  const required = getRequiredFields();
  return required.every((field) => collectedData[field]);
}

/**
 * Format collected data for display (e.g., in confirmation)
 */
export function formatContactForDisplay(data: Record<string, unknown>): string {
  const fields = getFieldDefinitions();
  let formatted = "Please confirm the following information:\n\n";

  for (const field of fields) {
    if (data[field.name]) {
      formatted += `${field.label}: ${data[field.name]}\n`;
    }
  }

  return formatted;
}
