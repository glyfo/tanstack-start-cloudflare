/**
 * Tool Result Wrapper - OpenClaw Security Pattern
 *
 * Wraps tool results in structured format that clearly differentiates
 * them from user input, preventing prompt injection attacks.
 *
 * Based on OpenClaw's approach: "Tool results are wrapped in structured
 * formats that differentiate them from user input"
 */

/**
 * Wrap tool result in structured format
 * Prevents LLM from confusing tool output with user instructions
 */
export function wrapToolResult(
  toolName: string,
  result: any,
  metadata?: {
    executionTime?: number;
    success?: boolean;
    error?: string;
  },
): string {
  const timestamp = new Date().toISOString();
  const success = metadata?.success ?? true;

  // Use clear delimiters that can't be easily injected
  const wrapper = {
    _type: 'TOOL_RESULT', // Clear type marker
    _timestamp: timestamp,
    _tool: toolName,
    _success: success,
    _executionTime: metadata?.executionTime,
    _error: metadata?.error,
    data: result,
  };

  // Format as JSON with clear boundaries
  return `<<<TOOL_RESULT_START>>>\n${JSON.stringify(wrapper, null, 2)}\n<<<TOOL_RESULT_END>>>`;
}

/**
 * Unwrap tool result (for debugging/processing)
 */
export function unwrapToolResult(wrapped: string): any {
  const match = wrapped.match(/<<<TOOL_RESULT_START>>>\n([\s\S]*?)\n<<<TOOL_RESULT_END>>>/);
  if (!match) {
    throw new Error('Invalid tool result format');
  }

  const parsed = JSON.parse(match[1]);
  if (parsed._type !== 'TOOL_RESULT') {
    throw new Error('Not a tool result');
  }

  return parsed;
}

/**
 * Format tool result for LLM context
 * Creates a clear, structured representation
 */
export function formatToolResultForLLM(
  toolName: string,
  params: Record<string, any>,
  result: any,
  metadata?: {
    executionTime?: number;
    success?: boolean;
    error?: string;
  },
): string {
  const success = metadata?.success ?? true;
  const executionTime = metadata?.executionTime;

  let formatted = `[TOOL EXECUTION]\n`;
  formatted += `Tool: ${toolName}\n`;
  formatted += `Status: ${success ? '✓ SUCCESS' : '✗ FAILED'}\n`;

  if (executionTime) {
    formatted += `Execution Time: ${executionTime}ms\n`;
  }

  if (Object.keys(params).length > 0) {
    formatted += `\nParameters:\n${JSON.stringify(params, null, 2)}\n`;
  }

  if (metadata?.error) {
    formatted += `\nError: ${metadata.error}\n`;
  } else {
    formatted += `\nResult:\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}\n`;
  }

  formatted += `[/TOOL EXECUTION]`;

  return formatted;
}

/**
 * Sanitize user input to prevent tool result injection
 * Escapes special markers used in tool results
 */
export function sanitizeUserInput(input: string): string {
  return input
    .replace(/<<<TOOL_RESULT_START>>>/g, '&lt;&lt;&lt;TOOL_RESULT_START&gt;&gt;&gt;')
    .replace(/<<<TOOL_RESULT_END>>>/g, '&lt;&lt;&lt;TOOL_RESULT_END&gt;&gt;&gt;')
    .replace(/\[TOOL EXECUTION\]/g, '[TOOL_EXECUTION]')
    .replace(/\[\/TOOL EXECUTION\]/g, '[/TOOL_EXECUTION]');
}

/**
 * Wrap error as tool result
 */
export function wrapToolError(
  toolName: string,
  error: Error | string,
  executionTime?: number,
): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  return wrapToolResult(
    toolName,
    {
      error: errorMessage,
      stack: errorStack,
    },
    {
      success: false,
      error: errorMessage,
      executionTime,
    },
  );
}

/**
 * Session trust tier (OpenClaw security model)
 */
export enum SessionTrustTier {
  OPERATOR = 'operator',   // Full access (local/admin sessions)
  DM = 'dm',              // Sandboxed (direct messages)
  GROUP = 'group',        // Sandboxed (group chats)
}

/**
 * Get trust tier from session key
 * Format: agent:<id>:main (operator) or agent:<id>:<channel>:dm:<id> (dm)
 */
export function getSessionTrustTier(sessionKey: string): SessionTrustTier {
  const parts = sessionKey.split(':');

  // agent:<id>:main -> OPERATOR
  if (parts.length === 3 && parts[2] === 'main') {
    return SessionTrustTier.OPERATOR;
  }

  // agent:<id>:<channel>:group:<id> -> GROUP
  if (parts.length >= 5 && parts[3] === 'group') {
    return SessionTrustTier.GROUP;
  }

  // agent:<id>:<channel>:dm:<id> -> DM (default for most cases)
  return SessionTrustTier.DM;
}

/**
 * Check if tool is allowed for session trust tier
 * Implements OpenClaw's security model
 */
export function isToolAllowedForTier(
  toolName: string,
  tier: SessionTrustTier,
  toolPolicies?: {
    operatorOnly?: string[];
    dmAllowed?: string[];
    groupAllowed?: string[];
  },
): boolean {
  // Operator has access to everything
  if (tier === SessionTrustTier.OPERATOR) {
    return true;
  }

  // Check if tool is operator-only
  if (toolPolicies?.operatorOnly?.includes(toolName)) {
    return false;
  }

  // Check tier-specific allowlists
  if (tier === SessionTrustTier.DM) {
    return !toolPolicies?.dmAllowed || toolPolicies.dmAllowed.includes(toolName);
  }

  if (tier === SessionTrustTier.GROUP) {
    return !toolPolicies?.groupAllowed || toolPolicies.groupAllowed.includes(toolName);
  }

  return false;
}
