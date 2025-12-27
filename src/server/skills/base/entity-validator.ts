/**
 * Generic Entity Validator
 *
 * Reusable validation logic for all entity types.
 * Works with any entity by accepting field registry and required fields.
 */

import { z } from "zod";
import {
  FieldMetadata,
  ValidationResult,
  CRUDResult,
} from "@/server/skills/workflows/contact/types";

/**
 * Field registry type
 */
export type EntityFieldRegistry = Record<string, FieldMetadata>;

/**
 * Validate a single field value against its metadata
 */
export function validateFieldValue(
  fieldName: string,
  value: unknown,
  fieldRegistry: EntityFieldRegistry
): ValidationResult {
  const field = fieldRegistry[fieldName];

  if (!field) {
    return { valid: false, error: `Unknown field: ${fieldName}` };
  }

  // Basic type checking for required fields
  if (
    field.required &&
    (value === null || value === undefined || value === "")
  ) {
    return { valid: false, error: `${field.label} is required` };
  }

  // Optional empty values are valid
  if (
    !field.required &&
    (value === null || value === undefined || value === "")
  ) {
    return { valid: true, data: null };
  }

  // Type-specific validation
  const validation = validateFieldByType(field, value);
  if (!validation.valid) {
    return validation;
  }

  // Enum validation
  if (field.enum && !field.enum.includes(String(value))) {
    return {
      valid: false,
      error: `${field.label} must be one of: ${field.enum.join(", ")}`,
    };
  }

  // Length validation
  const str = String(value);
  if (field.minLength && str.length < field.minLength) {
    return {
      valid: false,
      error: `${field.label} must be at least ${field.minLength} characters`,
    };
  }

  if (field.maxLength && str.length > field.maxLength) {
    return {
      valid: false,
      error: `${field.label} must be at most ${field.maxLength} characters`,
    };
  }

  // Pattern validation
  if (field.pattern) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(str)) {
      return {
        valid: false,
        error: `${field.label} format is invalid`,
      };
    }
  }

  return { valid: true, data: value };
}

/**
 * Type-specific field validation
 */
function validateFieldByType(
  field: FieldMetadata,
  value: unknown
): ValidationResult {
  const str = String(value).trim();

  switch (field.type) {
    case "email":
      if (!z.string().email().safeParse(str).success) {
        return { valid: false, error: "Invalid email format" };
      }
      break;

    case "phone":
      if (
        !z
          .string()
          .regex(/[\d\-\+\s()]{10,}/)
          .safeParse(str).success
      ) {
        return {
          valid: false,
          error: "Invalid phone format (minimum 10 digits)",
        };
      }
      break;

    case "date":
      if (isNaN(Date.parse(str))) {
        return { valid: false, error: "Invalid date format" };
      }
      break;

    case "number":
      if (isNaN(Number(str))) {
        return { valid: false, error: "Must be a number" };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate complete entity data
 * Works for any entity type via field registry
 */
export function validateEntityData(
  data: unknown,
  fieldRegistry: EntityFieldRegistry,
  requiredFieldNames: string[],
  systemFields: string[] = ["id", "userId", "createdAt", "updatedAt"],
  operation: "create" | "update" = "update"
): CRUDResult<Record<string, any>> {
  if (!data || typeof data !== "object") {
    return {
      success: false,
      error: "Invalid data format",
    };
  }

  const obj = data as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const validated: Record<string, any> = {};

  // Validate each field
  for (const [key, value] of Object.entries(obj)) {
    const field = fieldRegistry[key];

    // Skip system fields
    if (!field || systemFields.includes(key)) {
      continue;
    }

    const validation = validateFieldValue(key, value, fieldRegistry);
    if (!validation.valid) {
      errors[key] = validation.error || "Invalid value";
    } else if (validation.data !== null && validation.data !== undefined) {
      validated[key] = validation.data;
    }
  }

  // Check required fields for create operation
  if (operation === "create") {
    for (const fieldName of requiredFieldNames) {
      if (!validated[fieldName]) {
        const field = fieldRegistry[fieldName];
        errors[fieldName] = `${field?.label || fieldName} is required`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: "Validation failed",
      errors,
    };
  }

  return {
    success: true,
    data: validated,
  };
}

/**
 * Get missing required fields
 */
export function getMissingFields(
  data: Record<string, any>,
  requiredFieldNames: string[],
  fieldRegistry: EntityFieldRegistry
): FieldMetadata[] {
  return requiredFieldNames
    .filter((field) => !data[field] || data[field] === "")
    .map((field) => fieldRegistry[field]);
}

/**
 * Get next required field to collect
 */
export function getNextRequiredField(
  data: Record<string, any>,
  requiredFieldNames: string[],
  fieldRegistry: EntityFieldRegistry
): FieldMetadata | null {
  const missing = getMissingFields(data, requiredFieldNames, fieldRegistry);
  return missing.length > 0 ? missing[0] : null;
}

/**
 * Check if all required fields are collected
 */
export function areAllRequiredFieldsCollected(
  data: Record<string, any>,
  requiredFieldNames: string[]
): boolean {
  return requiredFieldNames.every((field) => {
    const value = data[field];
    return value !== null && value !== undefined && value !== "";
  });
}

/**
 * Validate IDs (generic for all entities)
 */
export function validateEntityIds(
  id?: string,
  userId?: string,
  entityName: string = "entity"
): CRUDResult {
  if (!id) {
    return { success: false, error: `${entityName} ID is required` };
  }
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }
  return { success: true };
}
