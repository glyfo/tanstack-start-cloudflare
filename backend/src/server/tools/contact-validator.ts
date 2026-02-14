/**
 * Contact Validator - Validation and sanitization for contact data
 * Ensures data integrity before persistence
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  formatted?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

export class ContactValidator {
  /**
   * Validate email format
   */
  validateEmail(email: string): ValidationResult {
    if (!email || typeof email !== "string") {
      return { valid: false, error: "Email is required" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = email.trim();

    if (!emailRegex.test(trimmed)) {
      return {
        valid: false,
        error: "Invalid email format. Example: user@domain.com",
      };
    }

    return { valid: true, formatted: trimmed.toLowerCase() };
  }

  /**
   * Validate and format phone number
   */
  validatePhone(phone: string): ValidationResult {
    if (!phone || typeof phone !== "string") {
      return { valid: true }; // Phone is optional
    }

    // Remove non-numeric characters
    const digits = phone.replace(/\D/g, "");

    // Handle 10-digit US phone
    if (digits.length === 10) {
      return {
        valid: true,
        formatted: `(${digits.slice(0, 3)}) ${digits.slice(
          3,
          6
        )}-${digits.slice(6)}`,
      };
    }

    // Handle 11-digit with country code
    if (digits.length === 11 && digits[0] === "1") {
      return {
        valid: true,
        formatted: `+1 (${digits.slice(1, 4)}) ${digits.slice(
          4,
          7
        )}-${digits.slice(7)}`,
      };
    }

    return {
      valid: false,
      error: "Phone must be 10 digits. Example: (555) 123-4567",
    };
  }

  /**
   * Validate contact name
   */
  validateName(name: string): ValidationResult {
    if (!name || typeof name !== "string") {
      return { valid: false, error: "Name is required" };
    }

    const trimmed = name.trim();

    if (trimmed.length < 2) {
      return {
        valid: false,
        error: "Name must be at least 2 characters",
      };
    }

    if (trimmed.length > 100) {
      return {
        valid: false,
        error: "Name must be less than 100 characters",
      };
    }

    return { valid: true, formatted: trimmed };
  }

  /**
   * Extract company name from email domain
   */
  extractCompanyFromEmail(email: string): string | null {
    try {
      const domain = email.split("@")[1];
      if (!domain) return null;

      // Remove common TLDs and format
      const company = domain
        .split(".")[0]
        .replace(/^(www\.)?/, "")
        .replace(/[-_]/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      return company;
    } catch {
      return null;
    }
  }

  /**
   * Sanitize and format contact data
   */
  sanitize(contact: Partial<Contact>): Partial<Contact> {
    const sanitized: Partial<Contact> = {};

    if (contact.id) sanitized.id = contact.id;
    if (contact.name) sanitized.name = contact.name.trim();
    if (contact.email) sanitized.email = contact.email.toLowerCase().trim();
    if (contact.company) sanitized.company = contact.company.trim() || null;
    if (contact.phone) sanitized.phone = contact.phone.trim() || null;
    if (contact.notes) sanitized.notes = contact.notes.trim() || null;
    if (contact.sessionId) sanitized.sessionId = contact.sessionId;

    return sanitized;
  }

  /**
   * Validate complete contact data
   */
  validateContact(data: { name?: string; email?: string; phone?: string }): {
    valid: boolean;
    errors: string[];
    formatted?: any;
  } {
    const errors: string[] = [];
    const formatted: any = {};

    // Validate name
    if (!data.name) {
      errors.push("Name is required");
    } else {
      const nameCheck = this.validateName(data.name);
      if (!nameCheck.valid) {
        errors.push(nameCheck.error!);
      } else {
        formatted.name = nameCheck.formatted;
      }
    }

    // Validate email
    if (!data.email) {
      errors.push("Email is required");
    } else {
      const emailCheck = this.validateEmail(data.email);
      if (!emailCheck.valid) {
        errors.push(emailCheck.error!);
      } else {
        formatted.email = emailCheck.formatted;
      }
    }

    // Validate phone (optional)
    if (data.phone) {
      const phoneCheck = this.validatePhone(data.phone);
      if (!phoneCheck.valid) {
        errors.push(phoneCheck.error!);
      } else {
        formatted.phone = phoneCheck.formatted;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      formatted: errors.length === 0 ? formatted : undefined,
    };
  }
}
