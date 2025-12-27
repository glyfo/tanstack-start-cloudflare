/**
 * Response Builder Utility
 *
 * Unified response structure builder for all skills
 * Ensures consistent response format across all entities
 *
 * FEATURES:
 * - Success responses with data
 * - Error responses with reasons
 * - Workflow step responses (for multi-step forms)
 * - Confirmation responses (for user confirmation)
 * - List responses (for paginated lists)
 *
 * USAGE:
 * import { ResponseBuilder } from '@/server/utils/response-builder';
 * ResponseBuilder.success('Created account successfully', account, 'create');
 * ResponseBuilder.error('Email already exists', 'email_duplicate');
 * ResponseBuilder.confirmationStep('Update account', { name, email });
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  nextStep?: string;
}

export interface ListResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  count: number;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  timestamp: string;
}

export interface ConfirmationResponse {
  success: boolean;
  message: string;
  action: string;
  entity: string;
  details: Record<string, any>;
  requiresConfirmation: boolean;
  timestamp: string;
}

export interface WorkflowStepResponse {
  success: boolean;
  message: string;
  step: number;
  totalSteps: number;
  currentField: string;
  fieldType: string;
  fieldDescription: string;
  collectedData: Record<string, any>;
  timestamp: string;
}

export class ResponseBuilder {
  /**
   * Build success response
   */
  static success<T>(
    message: string,
    data?: T,
    code?: string,
    nextStep?: string
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      code,
      nextStep,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build error response
   */
  static error(message: string, error?: string, code?: string): ApiResponse {
    return {
      success: false,
      message,
      error: error || message,
      code,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build workflow step response (for multi-step forms)
   */
  static workflowStep(
    message: string,
    step: number,
    totalSteps: number,
    currentField: string,
    fieldType: string,
    fieldDescription: string,
    collectedData: Record<string, any> = {}
  ): WorkflowStepResponse {
    return {
      success: true,
      message,
      step,
      totalSteps,
      currentField,
      fieldType,
      fieldDescription,
      collectedData,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build confirmation response (ask user to confirm action)
   */
  static confirmation(
    message: string,
    action: string,
    entity: string,
    details: Record<string, any>
  ): ConfirmationResponse {
    return {
      success: true,
      message,
      action,
      entity,
      details,
      requiresConfirmation: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build list response with pagination
   */
  static list<T>(
    message: string,
    data: T[],
    page: number = 1,
    pageSize: number = 20,
    total?: number
  ): ListResponse<T> {
    const actualTotal = total || data.length;
    return {
      success: true,
      message,
      data,
      count: data.length,
      total: actualTotal,
      page,
      pageSize,
      hasMore: page * pageSize < actualTotal,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build workflow completion response
   */
  static workflowComplete<T>(
    message: string,
    action: string,
    data?: T,
    nextAction?: string
  ): ApiResponse<T> {
    return {
      success: true,
      message: `${message} (${action} complete)`,
      data,
      nextStep: nextAction,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build validation error response with field errors
   */
  static validationError(
    message: string,
    fieldErrors: Record<string, string>
  ): ApiResponse {
    return {
      success: false,
      message,
      error: `Validation failed: ${Object.values(fieldErrors).join("; ")}`,
      data: fieldErrors as any,
      code: "validation_error",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build not found response
   */
  static notFound(entity: string, id?: string): ApiResponse {
    const message = id
      ? `${entity} with ID ${id} not found`
      : `${entity} not found`;
    return {
      success: false,
      message,
      error: message,
      code: "not_found",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build unauthorized response
   */
  static unauthorized(message: string = "Unauthorized"): ApiResponse {
    return {
      success: false,
      message,
      error: message,
      code: "unauthorized",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build conflict response (e.g., duplicate)
   */
  static conflict(message: string, conflictField?: string): ApiResponse {
    return {
      success: false,
      message,
      error: conflictField ? `${conflictField} already exists` : message,
      code: "conflict",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build search results response
   */
  static searchResults<T>(
    _message: string,
    results: T[],
    query: string,
    count: number,
    page: number = 1,
    pageSize: number = 20
  ): ListResponse<T> {
    return {
      success: true,
      message: `Found ${count} result(s) for "${query}"`,
      data: results,
      count: results.length,
      total: count,
      page,
      pageSize,
      hasMore: page * pageSize < count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Flatten response for chat UI (simple format)
   */
  static toChat(response: ApiResponse): {
    text: string;
    data?: any;
    action?: string;
  } {
    const text = response.message;

    if (response.nextStep) {
      const textWithNext = `${text}\n\nNext: ${response.nextStep}`;
      return {
        text: textWithNext,
        data: response.data,
        action: response.nextStep,
      };
    }

    return {
      text,
      data: response.data,
      action: response.nextStep,
    };
  }
}
