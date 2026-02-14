/**
 * BANT Extractor Service
 *
 * Uses LLM to extract Budget, Authority, Need, and Timeline information
 * from conversation messages.
 */

import { BANTData } from '../types/conversation-types';
import { createLogger } from '../utils/logger';

const logger = createLogger('BANTExtractor');

export interface BANTExtractionResult {
  bant: Partial<BANTData>;
  confidence: number;
  extractedFields: string[];
}

/**
 * Extract BANT data from conversation message
 */
export async function extractBANTFromMessage(
  content: string,
  conversationHistory: Array<{ role: string; content: string }>,
  AI: any
): Promise<BANTExtractionResult> {
  try {
    // Build context from recent conversation
    const context = conversationHistory
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `You are a sales qualification assistant. Analyze the following conversation and extract BANT information (Budget, Authority, Need, Timeline).

Recent conversation:
${context}

Latest message: ${content}

Extract any BANT information present and respond in JSON format:
{
  "budget": {
    "range": "10k-50k" | "50k-100k" | "100k-500k" | "500k+" | null,
    "qualified": true | false,
    "confidence": 0.0-1.0
  },
  "authority": {
    "role": "decision_maker" | "influencer" | "gatekeeper" | null,
    "canApprove": true | false,
    "confidence": 0.0-1.0
  },
  "need": {
    "description": "brief description" | null,
    "urgency": "high" | "medium" | "low" | "unknown",
    "painPoints": ["point1", "point2"] | [],
    "confidence": 0.0-1.0
  },
  "timeline": {
    "range": "immediate" | "1-3 months" | "3-6 months" | "6-12 months" | "12+ months" | null,
    "confidence": 0.0-1.0
  }
}

Only include fields where you found explicit information. If no BANT data found, return empty objects.`;

    const response = await AI.run('@cf/zai-org/glm-4.7-flash', {
      prompt,
      max_tokens: 500
    });

    const text = response.response || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logger.warn('[BANTExtractor] No JSON found in LLM response');
      return {
        bant: {},
        confidence: 0,
        extractedFields: []
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build BANT data
    const bant: Partial<BANTData> = {};
    const extractedFields: string[] = [];
    let totalConfidence = 0;
    let fieldCount = 0;

    // Budget
    if (parsed.budget && (parsed.budget.range || parsed.budget.qualified !== undefined)) {
      bant.budget = {
        range: parsed.budget.range,
        qualified: parsed.budget.qualified || false,
        confidence: parsed.budget.confidence || 0.5,
        extractedAt: Date.now()
      };
      extractedFields.push('budget');
      totalConfidence += parsed.budget.confidence || 0.5;
      fieldCount++;
    }

    // Authority
    if (parsed.authority && (parsed.authority.role || parsed.authority.canApprove !== undefined)) {
      bant.authority = {
        role: parsed.authority.role,
        canApprove: parsed.authority.canApprove || false,
        confidence: parsed.authority.confidence || 0.5,
        extractedAt: Date.now()
      };
      extractedFields.push('authority');
      totalConfidence += parsed.authority.confidence || 0.5;
      fieldCount++;
    }

    // Need
    if (parsed.need && (parsed.need.description || parsed.need.urgency || (parsed.need.painPoints && parsed.need.painPoints.length > 0))) {
      bant.need = {
        description: parsed.need.description,
        urgency: parsed.need.urgency || 'unknown',
        painPoints: parsed.need.painPoints || [],
        confidence: parsed.need.confidence || 0.5,
        extractedAt: Date.now()
      };
      extractedFields.push('need');
      totalConfidence += parsed.need.confidence || 0.5;
      fieldCount++;
    }

    // Timeline
    if (parsed.timeline && parsed.timeline.range) {
      bant.timeline = {
        range: parsed.timeline.range,
        confidence: parsed.timeline.confidence || 0.5,
        extractedAt: Date.now()
      };
      extractedFields.push('timeline');
      totalConfidence += parsed.timeline.confidence || 0.5;
      fieldCount++;
    }

    const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    logger.info('[BANTExtractor] Extraction complete', {
      extractedFields,
      confidence: overallConfidence
    });

    return {
      bant,
      confidence: overallConfidence,
      extractedFields
    };

  } catch (error) {
    logger.error('[BANTExtractor] Extraction failed', error);
    return {
      bant: {},
      confidence: 0,
      extractedFields: []
    };
  }
}

/**
 * Generate qualification prompt for missing BANT fields
 */
export function generateQualificationPrompt(missingFields: string[]): string {
  const prompts: Record<string, string> = {
    budget: "To help me understand if we're a good fit, could you share your budget range for this project?",
    authority: "Who else would be involved in the decision-making process for this?",
    need: "What challenges are you currently facing that you're looking to solve?",
    timeline: "When are you hoping to have a solution in place?"
  };

  if (missingFields.length === 0) {
    return "Thank you for sharing that information. Let me help you find the right solution.";
  }

  if (missingFields.length === 1) {
    return prompts[missingFields[0]] || "Could you tell me a bit more about your situation?";
  }

  // Multiple fields missing - ask about most critical first
  const priority = ['need', 'timeline', 'budget', 'authority'];
  const nextField = priority.find(field => missingFields.includes(field)) || missingFields[0];

  return prompts[nextField] || "Could you tell me a bit more about your requirements?";
}

/**
 * Check if lead is ready for qualification
 */
export function isReadyForQualification(
  messageCount: number,
  engagementScore: number
): boolean {
  // Need at least 2 messages and some engagement
  return messageCount >= 2 && engagementScore > 15;
}

/**
 * Generate system prompt with BANT context
 */
export function generateSystemPromptWithBANT(
  basePrompt: string,
  qualificationScore: number,
  missingFields: string[],
  phase: string
): string {
  let prompt = basePrompt;

  // Add qualification context
  if (phase === 'qualifying' || phase === 'initial_contact') {
    prompt += `\n\nCurrent Qualification:
- Score: ${qualificationScore}/100
- Missing information: ${missingFields.length > 0 ? missingFields.join(', ') : 'none'}

Your goal is to naturally extract this information through conversation while being helpful and not pushy. Ask one qualifying question at a time.`;
  }

  // Add phase-specific guidance
  const phaseGuidance: Record<string, string> = {
    'initial_contact': 'Focus on building rapport and understanding their initial needs.',
    'qualifying': 'Gather Budget, Authority, Need, and Timeline information naturally.',
    'needs_assessment': 'Deep dive into their specific requirements and pain points.',
    'presenting_solution': 'Present how your solution addresses their needs.',
    'handling_objections': 'Address concerns and objections professionally.',
    'proposal': 'Discuss proposal details and answer questions.',
    'negotiation': 'Work on terms and find win-win solutions.',
    'closing': 'Guide them through final steps to close the deal.'
  };

  if (phaseGuidance[phase]) {
    prompt += `\n\nCurrent Phase: ${phase}
Guidance: ${phaseGuidance[phase]}`;
  }

  return prompt;
}
