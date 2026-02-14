/**
 * Conversational Flow System
 * Defines multi-step conversational workflows for entity creation with dependencies
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FlowStage {
  id: number;
  name: string;
  description: string;
  /** Question to ask the user at this stage */
  question?: string;
  /** UI component to render (maps to card type in ChatEngine) */
  formComponent?: string;
  /** Tools that can be used at this stage */
  allowedTools?: string[];
  /** Data fields collected at this stage */
  collects?: string[];
  /** Condition to auto-advance (if data already available) */
  canSkipIf?: (context: FlowContext) => boolean;
}

export interface ConversationalFlow {
  id: string;
  name: string;
  description: string;
  /** Entity type being created */
  targetEntity: string;
  /** Ordered list of stages */
  stages: FlowStage[];
  /** Field dependencies from other stages */
  dependencies?: Record<string, { fromStage: number; field: string }>;
  /** Final tool to invoke when flow completes */
  completionTool: string;
}

export interface FlowContext {
  flowId: string;
  stage: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
  startedAt: number;
  updatedAt: number;
  /** Accumulated data from all stages */
  collectedData: Record<string, any>;
  /** History of stage transitions */
  history: Array<{
    stage: number;
    action: string;
    timestamp: number;
    data?: Record<string, any>;
  }>;
  /** Error message if status is 'error' */
  error?: string;
}

// ============================================================================
// FLOW DEFINITIONS
// ============================================================================

export const createOpportunityFlow: ConversationalFlow = {
  id: 'create-opportunity',
  name: 'Create Opportunity',
  description: 'Single-step flow with embedded contact selection',
  targetEntity: 'opportunity',
  stages: [
    {
      id: 0,
      name: 'create-with-contact',
      description: 'Create opportunity with integrated contact selection',
      formComponent: 'create-opportunity-form',
      allowedTools: ['server.createOpportunity', 'server.searchContacts', 'server.createContact'],
      collects: ['contactId', 'contactName', 'title', 'dealValue', 'stage', 'probability', 'expectedCloseDate', 'description'],
    },
  ],
  completionTool: 'server.createOpportunity',
};

export const createContactFlow: ConversationalFlow = {
  id: 'create-contact',
  name: 'Create Contact',
  description: 'Single-step flow to create a contact',
  targetEntity: 'contact',
  stages: [
    {
      id: 0,
      name: 'contact-details',
      description: 'Collect contact information',
      question: 'Let\'s create a new contact. Please fill in the details.',
      formComponent: 'create-contact-form',
      allowedTools: ['server.createContact'],
      collects: ['name', 'email', 'company', 'phone', 'source', 'tags'],
    },
  ],
  completionTool: 'server.createContact',
};

// ============================================================================
// FLOW REGISTRY
// ============================================================================

export const flowRegistry: Record<string, ConversationalFlow> = {
  'create-opportunity': createOpportunityFlow,
  'create-contact': createContactFlow,
};

// ============================================================================
// FLOW DETECTION
// ============================================================================

export interface FlowTrigger {
  flowId: string;
  patterns: RegExp[];
  /** Extract initial data from user message */
  extractInitialData?: (message: string) => Record<string, any>;
}

export const flowTriggers: FlowTrigger[] = [
  {
    flowId: 'create-opportunity',
    patterns: [
      /create\s+(an?\s+)?opportunit(y|ies)/i,
      /new\s+opportunit(y|ies)/i,
      /add\s+(an?\s+)?opportunit(y|ies)/i,
      /create\s+(an?\s+)?deal/i,
      /new\s+deal/i,
    ],
    extractInitialData: (message: string) => {
      const data: Record<string, any> = {};
      // Extract deal value if mentioned
      const valueMatch = message.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:k|K|m|M)?/);
      if (valueMatch) {
        let value = parseFloat(valueMatch[1].replace(/,/g, ''));
        if (message.toLowerCase().includes('k')) value *= 1000;
        if (message.toLowerCase().includes('m')) value *= 1000000;
        data.dealValue = value;
      }
      // Extract title if quoted
      const titleMatch = message.match(/["']([^"']+)["']/);
      if (titleMatch) {
        data.title = titleMatch[1];
      }
      return data;
    },
  },
  {
    flowId: 'create-contact',
    patterns: [
      /create\s+(an?\s+)?contact/i,
      /new\s+contact/i,
      /add\s+(an?\s+)?contact/i,
    ],
    extractInitialData: (message: string) => {
      const data: Record<string, any> = {};
      // Extract email if present
      const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        data.email = emailMatch[0];
      }
      // Extract name if "named X" or "called X" pattern
      const nameMatch = message.match(/(?:named?|called?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      if (nameMatch) {
        data.name = nameMatch[1];
      }
      return data;
    },
  },
];

// ============================================================================
// FLOW MANAGER FUNCTIONS
// ============================================================================

/**
 * Detect if a message should trigger a conversational flow
 */
export function detectFlowTrigger(message: string): { flowId: string; initialData: Record<string, any> } | null {
  for (const trigger of flowTriggers) {
    for (const pattern of trigger.patterns) {
      if (pattern.test(message)) {
        const initialData = trigger.extractInitialData?.(message) ?? {};
        return { flowId: trigger.flowId, initialData };
      }
    }
  }
  return null;
}

/**
 * Get a flow definition by ID
 */
export function getFlow(flowId: string): ConversationalFlow | undefined {
  return flowRegistry[flowId];
}

/**
 * Create a new flow context
 */
export function createFlowContext(flowId: string, initialData: Record<string, any> = {}): FlowContext {
  const now = Date.now();
  return {
    flowId,
    stage: 0,
    status: 'active',
    startedAt: now,
    updatedAt: now,
    collectedData: initialData,
    history: [
      {
        stage: 0,
        action: 'started',
        timestamp: now,
        data: initialData,
      },
    ],
  };
}

/**
 * Advance to the next stage in the flow
 */
export function advanceFlowStage(
  context: FlowContext,
  stageData: Record<string, any> = {}
): FlowContext {
  const flow = getFlow(context.flowId);
  if (!flow) {
    return { ...context, status: 'error', error: `Flow not found: ${context.flowId}` };
  }

  const nextStage = context.stage + 1;
  const now = Date.now();

  // Merge new data into collected data
  const collectedData = { ...context.collectedData, ...stageData };

  // Check if flow is complete
  if (nextStage >= flow.stages.length) {
    return {
      ...context,
      stage: nextStage,
      status: 'completed',
      updatedAt: now,
      collectedData,
      history: [
        ...context.history,
        { stage: nextStage, action: 'completed', timestamp: now, data: stageData },
      ],
    };
  }

  return {
    ...context,
    stage: nextStage,
    status: 'active',
    updatedAt: now,
    collectedData,
    history: [
      ...context.history,
      { stage: nextStage, action: 'advanced', timestamp: now, data: stageData },
    ],
  };
}

/**
 * Get the current stage definition
 */
export function getCurrentStage(context: FlowContext): FlowStage | undefined {
  const flow = getFlow(context.flowId);
  if (!flow) return undefined;
  return flow.stages[context.stage];
}

/**
 * Get form initial data for current stage (includes dependencies from previous stages)
 */
export function getStageFormData(context: FlowContext): Record<string, any> {
  const flow = getFlow(context.flowId);
  if (!flow) return context.collectedData;

  const formData = { ...context.collectedData };

  // Apply dependencies
  if (flow.dependencies) {
    for (const [targetField, source] of Object.entries(flow.dependencies)) {
      if (source.fromStage < context.stage && context.collectedData[source.field]) {
        formData[targetField] = context.collectedData[source.field];
      }
    }
  }

  return formData;
}

/**
 * Cancel an active flow
 */
export function cancelFlow(context: FlowContext): FlowContext {
  return {
    ...context,
    status: 'cancelled',
    updatedAt: Date.now(),
    history: [
      ...context.history,
      { stage: context.stage, action: 'cancelled', timestamp: Date.now() },
    ],
  };
}

/**
 * Check if a tool is allowed at the current stage
 */
export function isToolAllowedInStage(context: FlowContext, toolId: string): boolean {
  const stage = getCurrentStage(context);
  if (!stage) return true; // No restrictions if stage not found
  if (!stage.allowedTools) return true; // No restrictions defined
  return stage.allowedTools.includes(toolId);
}
