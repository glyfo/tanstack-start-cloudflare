/**
 * Qualification Integration Service
 *
 * Bridges ChatAgent with LeadQualificationDO and EnhancedConversationDO
 */

import { extractBANTFromMessage, generateQualificationPrompt, generateSystemPromptWithBANT } from './bant-extractor';
import { createLogger } from '../utils/logger';

const logger = createLogger('QualificationIntegration');

export interface QualificationContext {
  conversationDO: any;  // EnhancedConversationDO instance
  qualificationDO: any; // LeadQualificationDO instance
  sessionId: string;
  leadId: string;
}

/**
 * Initialize qualification DOs for a session
 */
export async function initializeQualificationContext(
  env: any,
  sessionId: string
): Promise<QualificationContext> {
  try {
    // Get EnhancedConversationDO stub
    const conversationId = env.ENHANCED_CONVERSATION.idFromName(sessionId);
    const conversationDO = env.ENHANCED_CONVERSATION.get(conversationId);

    // Get LeadQualificationDO stub (use same session ID as lead ID for now)
    const leadId = env.LEAD_QUALIFICATION.idFromName(sessionId);
    const qualificationDO = env.LEAD_QUALIFICATION.get(leadId);

    logger.info('[QualificationIntegration] Context initialized', {
      sessionId,
      leadId: sessionId
    });

    return {
      conversationDO,
      qualificationDO,
      sessionId,
      leadId: sessionId
    };
  } catch (error) {
    logger.error('[QualificationIntegration] Failed to initialize context', error);
    throw error;
  }
}

/**
 * Process user message through qualification system
 */
export async function processUserMessage(
  context: QualificationContext,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  AI: any
): Promise<{
  shouldQualify: boolean;
  qualificationPrompt?: string;
  systemPrompt: string;
  phase: string;
  qualificationScore: number;
}> {
  try {
    // Update conversation DO
    await context.conversationDO.processMessage('user', userMessage, {});

    // Get current conversation state
    const conversationState = await context.conversationDO.getState();

    // Extract BANT data if in qualifying phase
    let bantExtracted = false;
    if (
      conversationState.phase === 'qualifying' ||
      conversationState.phase === 'initial_contact'
    ) {
      const extraction = await extractBANTFromMessage(
        userMessage,
        conversationHistory,
        AI
      );

      if (extraction.extractedFields.length > 0) {
        // Update qualification DO with extracted BANT
        await context.qualificationDO.updateBANT(extraction.bant);
        bantExtracted = true;

        logger.info('[QualificationIntegration] BANT extracted', {
          fields: extraction.extractedFields,
          confidence: extraction.confidence
        });
      }
    }

    // Get qualification state
    const qualificationState = await context.qualificationDO.getState();

    // Sync qualification score back to conversation
    await context.conversationDO.updateQualificationScore(
      qualificationState.score.total,
      qualificationState.classification === 'qualified'
    );

    // Check if we should ask qualification questions
    const missingFields = await context.qualificationDO.getMissingFields();
    const shouldQualify =
      conversationState.phase === 'qualifying' &&
      missingFields.length > 0 &&
      conversationState.messageCount >= 2;

    // Generate appropriate prompts
    let qualificationPrompt: string | undefined;
    if (shouldQualify && !bantExtracted) {
      qualificationPrompt = generateQualificationPrompt(missingFields);
    }

    // Generate system prompt with context
    const basePrompt = "You are an intelligent CRM assistant helping to qualify leads and move them through the sales pipeline.";
    const systemPrompt = generateSystemPromptWithBANT(
      basePrompt,
      qualificationState.score.total,
      missingFields,
      conversationState.phase
    );

    return {
      shouldQualify,
      qualificationPrompt,
      systemPrompt,
      phase: conversationState.phase,
      qualificationScore: qualificationState.score.total
    };

  } catch (error) {
    logger.error('[QualificationIntegration] Failed to process message', error);

    // Return safe defaults on error
    return {
      shouldQualify: false,
      systemPrompt: "You are an intelligent CRM assistant.",
      phase: 'initial_contact',
      qualificationScore: 0
    };
  }
}

/**
 * Process assistant response through qualification system
 */
export async function processAssistantResponse(
  context: QualificationContext,
  responseText: string
): Promise<void> {
  try {
    // Update conversation DO with assistant message
    await context.conversationDO.processMessage('assistant', responseText, {});

    logger.info('[QualificationIntegration] Assistant response processed');
  } catch (error) {
    logger.error('[QualificationIntegration] Failed to process response', error);
  }
}

/**
 * Get qualification summary for display
 */
export async function getQualificationSummary(
  context: QualificationContext
): Promise<{
  score: number;
  classification: string;
  phase: string;
  missingFields: string[];
  progress: number;
  needsEscalation: boolean;
}> {
  try {
    const [qualificationState, conversationState] = await Promise.all([
      context.qualificationDO.getState(),
      context.conversationDO.getState()
    ]);

    const missingFields = await context.qualificationDO.getMissingFields();
    const progress = await context.qualificationDO.getProgress();

    return {
      score: qualificationState.score.total,
      classification: qualificationState.classification,
      phase: conversationState.phase,
      missingFields,
      progress,
      needsEscalation: conversationState.needsHumanEscalation
    };
  } catch (error) {
    logger.error('[QualificationIntegration] Failed to get summary', error);
    return {
      score: 0,
      classification: 'cold',
      phase: 'initial_contact',
      missingFields: ['budget', 'authority', 'need', 'timeline'],
      progress: 0,
      needsEscalation: false
    };
  }
}

/**
 * Check if conversation needs human escalation
 */
export async function checkEscalation(
  context: QualificationContext
): Promise<{
  needsEscalation: boolean;
  reason?: string;
}> {
  try {
    const conversationState = await context.conversationDO.getState();

    return {
      needsEscalation: conversationState.needsHumanEscalation,
      reason: conversationState.escalationReason
    };
  } catch (error) {
    logger.error('[QualificationIntegration] Failed to check escalation', error);
    return {
      needsEscalation: false
    };
  }
}

/**
 * Update contact information from conversation
 */
export async function updateContactInfo(
  context: QualificationContext,
  contactData: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
  }
): Promise<void> {
  try {
    await context.qualificationDO.updateContact(contactData);

    logger.info('[QualificationIntegration] Contact info updated', {
      fields: Object.keys(contactData)
    });
  } catch (error) {
    logger.error('[QualificationIntegration] Failed to update contact', error);
  }
}
