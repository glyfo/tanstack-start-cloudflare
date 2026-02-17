/**
 * Tool Policy System - OpenClaw Pattern
 *
 * Implements layered tool access control with precedence:
 * Global → Provider → Agent → Group → Session
 *
 * Based on OpenClaw's approach: "Tool policy precedence (later overrides earlier):
 * Tool Profile → Provider Profile → Global Policy → Provider Policy →
 * Agent Policy → Group Policy → Sandbox Policy"
 */

/**
 * Tool access level
 */
export enum ToolAccessLevel {
  ALLOWED = 'allowed',
  DENIED = 'denied',
  INHERIT = 'inherit',
}

/**
 * Tool policy layer
 */
export interface ToolPolicy {
  // Explicit allows (highest priority)
  allow?: string[];

  // Explicit denies (second priority)
  deny?: string[];

  // Default for tools not in allow/deny
  defaultAccess?: ToolAccessLevel;

  // Trust tier requirements
  requireOperator?: string[];   // Tools that require operator tier
  requireDM?: string[];          // Tools that require at least DM tier

  // Rate limits
  rateLimits?: Record<string, {
    maxCallsPerMinute: number;
    maxCallsPerHour: number;
  }>;
}

/**
 * Policy layers (in precedence order, lowest to highest)
 */
export interface ToolPolicyLayers {
  global?: ToolPolicy;      // System-wide defaults
  provider?: ToolPolicy;    // LLM provider-specific
  agent?: ToolPolicy;       // Agent-specific
  group?: ToolPolicy;       // Group/channel-specific
  session?: ToolPolicy;     // Session-specific (highest priority)
}

/**
 * Resolve tool access by merging policy layers
 * Later policies override earlier ones
 */
export function resolveToolAccess(
  toolName: string,
  layers: ToolPolicyLayers,
): ToolAccessLevel {
  // Start with global default
  let access = layers.global?.defaultAccess || ToolAccessLevel.INHERIT;

  // Process layers in order (global → provider → agent → group → session)
  const orderedLayers = [
    layers.global,
    layers.provider,
    layers.agent,
    layers.group,
    layers.session,
  ];

  for (const policy of orderedLayers) {
    if (!policy) continue;

    // Explicit allow overrides everything
    if (policy.allow?.includes(toolName)) {
      access = ToolAccessLevel.ALLOWED;
      continue;
    }

    // Explicit deny blocks
    if (policy.deny?.includes(toolName)) {
      access = ToolAccessLevel.DENIED;
      continue;
    }

    // Apply layer's default if set
    if (policy.defaultAccess && policy.defaultAccess !== ToolAccessLevel.INHERIT) {
      access = policy.defaultAccess;
    }
  }

  // Final resolution: INHERIT becomes DENIED (fail-safe)
  if (access === ToolAccessLevel.INHERIT) {
    return ToolAccessLevel.DENIED;
  }

  return access;
}

/**
 * Check if tool requires specific trust tier
 */
export function checkTrustTierRequirement(
  toolName: string,
  sessionTier: 'operator' | 'dm' | 'group',
  layers: ToolPolicyLayers,
): boolean {
  // Merge all requireOperator lists
  const operatorOnly = new Set<string>();
  const dmRequired = new Set<string>();

  for (const policy of [
    layers.global,
    layers.provider,
    layers.agent,
    layers.group,
    layers.session,
  ]) {
    policy?.requireOperator?.forEach(t => operatorOnly.add(t));
    policy?.requireDM?.forEach(t => dmRequired.add(t));
  }

  // Check operator requirement
  if (operatorOnly.has(toolName)) {
    return sessionTier === 'operator';
  }

  // Check DM requirement (DM or operator)
  if (dmRequired.has(toolName)) {
    return sessionTier === 'operator' || sessionTier === 'dm';
  }

  // No specific requirement
  return true;
}

/**
 * Get default tool policies (safe defaults)
 */
export function getDefaultGlobalPolicy(): ToolPolicy {
  return {
    // Dangerous tools - operator only
    requireOperator: [
      'server.executeCommand',
      'server.deleteData',
      'server.adminAccess',
      'server.configUpdate',
    ],

    // Safe read-only tools - DM minimum
    requireDM: [
      'server.searchContacts',
      'server.getContact',
      'server.listOpportunities',
    ],

    // Most tools allowed by default (OpenClaw philosophy: enable, then restrict)
    defaultAccess: ToolAccessLevel.ALLOWED,

    // Rate limits for expensive tools
    rateLimits: {
      'server.searchContacts': {
        maxCallsPerMinute: 10,
        maxCallsPerHour: 100,
      },
      'server.createContact': {
        maxCallsPerMinute: 5,
        maxCallsPerHour: 50,
      },
    },
  };
}

/**
 * Example: Restrictive group policy
 */
export function getRestrictiveGroupPolicy(): ToolPolicy {
  return {
    // Only allow safe read operations in groups
    allow: [
      'client.getTime',
      'server.searchContacts',
      'server.getContact',
    ],

    // Deny all writes
    deny: [
      'server.createContact',
      'server.updateContact',
      'server.deleteContact',
      'server.createOpportunity',
    ],

    defaultAccess: ToolAccessLevel.DENIED,
  };
}

/**
 * Tool invocation result with policy check
 */
export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  tier?: 'operator' | 'dm' | 'group';
  policy?: ToolAccessLevel;
}

/**
 * Check if tool invocation is allowed
 * Complete policy check including access level and trust tier
 */
export function checkToolInvocation(
  toolName: string,
  sessionTier: 'operator' | 'dm' | 'group',
  layers: ToolPolicyLayers,
): PolicyCheckResult {
  // Check access level
  const access = resolveToolAccess(toolName, layers);

  if (access === ToolAccessLevel.DENIED) {
    return {
      allowed: false,
      reason: 'Tool access denied by policy',
      policy: access,
      tier: sessionTier,
    };
  }

  // Check trust tier requirements
  const tierOk = checkTrustTierRequirement(toolName, sessionTier, layers);

  if (!tierOk) {
    return {
      allowed: false,
      reason: `Tool requires higher trust tier (current: ${sessionTier})`,
      policy: access,
      tier: sessionTier,
    };
  }

  return {
    allowed: true,
    policy: access,
    tier: sessionTier,
  };
}

/**
 * Rate limiter for tool calls
 */
export class ToolRateLimiter {
  private calls: Map<string, number[]> = new Map();

  /**
   * Check if tool call is within rate limits
   */
  checkLimit(
    toolName: string,
    limits: { maxCallsPerMinute: number; maxCallsPerHour: number },
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const key = toolName;

    // Get call history
    let history = this.calls.get(key) || [];

    // Remove calls older than 1 hour
    history = history.filter(t => now - t < 60 * 60 * 1000);

    // Check hour limit
    if (history.length >= limits.maxCallsPerHour) {
      const oldestCall = Math.min(...history);
      const retryAfter = Math.ceil((oldestCall + 60 * 60 * 1000 - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Check minute limit
    const recentCalls = history.filter(t => now - t < 60 * 1000);
    if (recentCalls.length >= limits.maxCallsPerMinute) {
      const oldestRecentCall = Math.min(...recentCalls);
      const retryAfter = Math.ceil((oldestRecentCall + 60 * 1000 - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Record this call
    history.push(now);
    this.calls.set(key, history);

    return { allowed: true };
  }

  /**
   * Clear rate limit history for a tool
   */
  clear(toolName: string): void {
    this.calls.delete(toolName);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.calls.clear();
  }
}
