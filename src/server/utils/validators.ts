/**
 * Common Validators Utility
 *
 * Centralized validation functions for all entities
 * Eliminates duplication across repositories
 * 100% reusable across Account, Product, Order, Pipeline, Opportunity, etc.
 *
 * FEATURES:
 * - Email, URL, phone validation
 * - Numeric validations (range, currency)
 * - String validations (length, required)
 * - Date validation
 * - Unique field checking
 *
 * USAGE:
 * import { CommonValidators } from '@/server/utils/validators';
 * CommonValidators.isValidEmail('test@example.com'); // true
 */

export class CommonValidators {
  /**
   * Validate email format
   */
  static isValidEmail(value: string | undefined | null): boolean {
    if (!value) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Validate URL format
   */
  static isValidUrl(value: string | undefined | null): boolean {
    if (!value) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate phone number (basic format)
   * Accepts: +1234567890, (123) 456-7890, 123-456-7890, 1234567890
   */
  static isValidPhone(value: string | undefined | null): boolean {
    if (!value) return false;
    const phoneRegex = /^[\d\s\-().+]+$|^\+[\d\s\-().]+$/;
    return phoneRegex.test(value) && value.replace(/\D/g, "").length >= 10;
  }

  /**
   * Validate currency amount (0-999,999,999.99)
   */
  static isValidCurrency(value: number | undefined | null): boolean {
    if (value === undefined || value === null) return false;
    return value >= 0 && value <= 999999999.99 && !isNaN(value);
  }

  /**
   * Validate string length
   */
  static isValidLength(
    value: string | undefined | null,
    min: number = 1,
    max: number = 1000
  ): boolean {
    if (!value) return false;
    return value.length >= min && value.length <= max;
  }

  /**
   * Validate number is within range
   */
  static isInRange(
    value: number | undefined | null,
    min: number,
    max: number
  ): boolean {
    if (value === undefined || value === null) return false;
    return value >= min && value <= max && !isNaN(value);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  static isValidDate(value: string | undefined | null): boolean {
    if (!value) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Validate field is not empty/null/undefined
   */
  static isRequired(value: any): boolean {
    return value !== null && value !== undefined && value !== "";
  }

  /**
   * Validate field is unique (check against existing values)
   * Pass: fieldName, newValue, existingValues
   */
  static isUnique(newValue: string, existingValues: string[] = []): boolean {
    if (!newValue) return false;
    return !existingValues.some(
      (existing) => existing.toLowerCase() === newValue.toLowerCase()
    );
  }

  /**
   * Validate percentage (0-100)
   */
  static isValidPercentage(value: number | undefined | null): boolean {
    return this.isInRange(value, 0, 100);
  }

  /**
   * Validate number is positive
   */
  static isPositive(value: number | undefined | null): boolean {
    if (value === undefined || value === null) return false;
    return value > 0;
  }

  /**
   * Validate string is not empty after trimming
   */
  static isNotEmpty(value: string | undefined | null): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }

  /**
   * Batch validate multiple fields
   * Usage: CommonValidators.validateBatch({
   *   email: { value: 'test@example.com', validator: 'email' },
   *   amount: { value: 100, validator: 'currency' }
   * })
   */
  static validateBatch(
    fields: Record<
      string,
      { value: any; validator: keyof typeof CommonValidators }
    >
  ): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const [fieldName, { value, validator }] of Object.entries(fields)) {
      const validatorMethod = this[validator] as any;
      if (!validatorMethod || typeof validatorMethod !== "function") {
        errors[fieldName] = `Unknown validator: ${validator}`;
        continue;
      }

      if (!validatorMethod(value)) {
        errors[fieldName] = `Invalid ${fieldName}`;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}
