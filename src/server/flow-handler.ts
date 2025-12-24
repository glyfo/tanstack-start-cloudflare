/**
 * Conversational Flow Handler
 * Server-side logic for managing field-by-field conversation
 * Runs on Cloudflare Worker (no client duplication)
 */

import { submitAction } from "./action-submission";

export interface FormField {
  name: string;
  type: "text" | "email" | "phone" | "select" | "textarea" | "number";
  label: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  options?: Array<{ value: string; label: string }>;
}

export interface ActionSchema {
  id: string;
  name: string;
  description: string;
  type: "create" | "update" | "delete" | "read";
  fields: FormField[];
  metadata?: Record<string, unknown>;
  keywords?: string[];
}

// Server-side only action schemas
const ACTION_SCHEMAS: Record<string, ActionSchema> = {};

export interface FlowSession {
  sessionId: string;
  actionId: string;
  schema: ActionSchema;
  collectedData: Record<string, unknown>;
  currentFieldIndex: number;
  errors: Record<string, string>;
  isComplete: boolean;
  startedAt: number;
}

export interface ClientMessage {
  type: "intent" | "field_value" | "cancel";
  actionId?: string;
  fieldName?: string;
  value?: unknown;
  message?: string;
  reason?: string;
}

export interface ServerMessage {
  type:
    | "field_question"
    | "field_error"
    | "field_valid"
    | "progress"
    | "success"
    | "error"
    | "complete";
  fieldName?: string;
  prompt?: string;
  error?: string;
  current?: number;
  total?: number;
  action?: string;
  data?: Record<string, unknown>;
  message?: string;
  options?: string[];
}

/**
 * Initialize a flow session for an action
 */
export function initializeFlowSession(
  sessionId: string,
  actionId: string
): FlowSession | null {
  const schema = ACTION_SCHEMAS[actionId];
  if (!schema) return null;

  return {
    sessionId,
    actionId,
    schema,
    collectedData: {},
    currentFieldIndex: 0,
    errors: {},
    isComplete: false,
    startedAt: Date.now(),
  };
}

/**
 * Detect action intent from user message
 */
export function detectIntent(userMessage: string): string | null {
  return null;
}

/**
 * Get next required field to ask for
 */
export function getNextField(session: FlowSession): FormField | null {
  const requiredFields = session.schema.fields.filter((f) => f.required);
  const uncollectedRequired = requiredFields.filter(
    (f) => !session.collectedData.hasOwnProperty(f.name)
  );
  return uncollectedRequired[0] || null;
}

/**
 * Validate field value against schema
 */
export function validateField(field: FormField, value: unknown): string | null {
  // Check required
  if (
    field.required &&
    (value === null || value === undefined || value === "")
  ) {
    return `${field.label} is required`;
  }

  // Skip validation for empty optional fields
  if (
    !field.required &&
    (value === null || value === undefined || value === "")
  ) {
    return null;
  }

  const strValue = String(value).trim();

  // Length validation
  if (
    field.validation?.minLength &&
    strValue.length < field.validation.minLength
  ) {
    return `${field.label} must be at least ${field.validation.minLength} characters`;
  }

  if (
    field.validation?.maxLength &&
    strValue.length > field.validation.maxLength
  ) {
    return `${field.label} must be at most ${field.validation.maxLength} characters`;
  }

  // Email validation
  if (field.type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(strValue)) {
      return "Please enter a valid email address";
    }
  }

  // Phone validation
  if (field.type === "phone") {
    const phoneRegex = /[\d\-\+\s()]{10,}/;
    if (!phoneRegex.test(strValue)) {
      return "Please enter a valid phone number";
    }
  }

  // Pattern validation
  if (field.validation?.pattern) {
    const regex = new RegExp(field.validation.pattern);
    if (!regex.test(strValue)) {
      return `${field.label} format is invalid`;
    }
  }

  // Select validation
  if (field.type === "select" && field.options) {
    const validValues = field.options.map((o) => o.value);
    if (!validValues.includes(strValue)) {
      return `Please select a valid option for ${field.label}`;
    }
  }

  return null;
}

/**
 * Generate conversational prompt for a field
 */
export function generateFieldPrompt(
  field: FormField,
  session: FlowSession
): { prompt: string; options?: string[] } {
  const requiredCount = session.schema.fields.filter((f) => f.required).length;
  const answeredCount = Object.keys(session.collectedData).length + 1;
  const progress = `(${answeredCount}/${requiredCount})`;

  let prompt = `${field.label}?`;

  if (field.description) {
    prompt += ` ${field.description}`;
  }

  if (field.placeholder && field.type !== "select") {
    prompt += ` E.g., "${field.placeholder}"`;
  }

  prompt += ` ${progress}`;

  let options: string[] | undefined;
  if (field.type === "select" && field.options) {
    options = field.options.map((o) => o.value);
    prompt = `What would you like for ${field.label}? ${progress}\n${field.options
      .map((o, i) => `${i + 1}. ${o.label}`)
      .join("\n")}`;
  }

  return { prompt, options };
}

/**
 * Process incoming client message and return server response(s)
 */
export function processMessage(
  message: ClientMessage,
  session: FlowSession | null
): ServerMessage[] {
  const responses: ServerMessage[] = [];

  // Handle intent detection (start of flow)
  if (message.type === "intent" && message.message) {
    const detectedAction = detectIntent(message.message);
    if (!detectedAction) {
      responses.push({
        type: "error",
        message:
          'I did not understand what action you want to perform. Try: "create contact", "add video", or "place order"',
      });
      return responses;
    }

    // Initialize new session
    const newSession = initializeFlowSession(
      session?.sessionId || crypto.randomUUID(),
      detectedAction
    );

    if (!newSession) {
      responses.push({
        type: "error",
        message: "Action not found",
      });
      return responses;
    }

    // Send first field question
    const firstField = newSession.schema.fields[0];
    const { prompt, options } = generateFieldPrompt(firstField, newSession);

    responses.push({
      type: "field_question",
      fieldName: firstField.name,
      prompt,
      options,
    });

    return responses;
  }

  // Handle field value submission
  if (
    message.type === "field_value" &&
    session &&
    message.fieldName &&
    message.value !== undefined
  ) {
    const field = session.schema.fields.find(
      (f) => f.name === message.fieldName
    );

    if (!field) {
      responses.push({
        type: "error",
        message: "Field not found",
      });
      return responses;
    }

    // Validate
    const error = validateField(field, message.value);
    if (error) {
      responses.push({
        type: "field_error",
        fieldName: field.name,
        error,
      });
      return responses;
    }

    // Store value
    session.collectedData[field.name] = String(message.value).trim();
    responses.push({
      type: "field_valid",
      fieldName: field.name,
    });

    // Get next field
    const nextField = getNextField(session);

    if (nextField) {
      const requiredCount = session.schema.fields.filter(
        (f) => f.required
      ).length;
      const answeredCount = Object.keys(session.collectedData).length;

      responses.push({
        type: "progress",
        current: answeredCount,
        total: requiredCount,
      });

      const { prompt, options } = generateFieldPrompt(nextField, session);
      responses.push({
        type: "field_question",
        fieldName: nextField.name,
        prompt,
        options,
      });
    } else {
      // All required fields collected - submit to database
      session.isComplete = true;

      // Submit action (async, but we'll return immediately)
      submitAction(session)
        .then((result) => {
          console.log("[FlowHandler] Action submitted:", result);
        })
        .catch((err) => {
          console.error("[FlowHandler] Action submission error:", err);
        });

      responses.push({
        type: "success",
        action: session.actionId,
        data: session.collectedData,
        message: `✅ ${session.schema.name} completed!`,
      });
    }

    return responses;
  }

  // Handle cancel
  if (message.type === "cancel") {
    responses.push({
      type: "complete",
      message: "Operation cancelled",
    });
    return responses;
  }

  responses.push({
    type: "error",
    message: "Invalid message type",
  });
  return responses;
}
