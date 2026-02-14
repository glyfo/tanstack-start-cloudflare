/**
 * Opportunity Workflows
 *
 * Manages the lifecycle of opportunities from lead capture to close
 */

import { createLogger } from '../utils/logger';
import type { OpportunityStage } from '../durable-objects/OpportunityDO';

const logger = createLogger('OpportunityWorkflows');

export interface CreateOpportunityParams {
  leadId: string;
  orgId?: string;
  source: string;
  sourceMetadata?: Record<string, any>;
  contactId?: string;
  dealValue?: number;
  currency?: string;
}

export interface OpportunityTransitionRules {
  // Minimum qualification score to transition
  minQualificationScore: {
    lead_to_qualified: number;        // 55 (warm)
    qualified_to_proposal: number;    // 65 (hot)
    proposal_to_negotiation: number;  // 70 (hot+)
    negotiation_to_closed: number;    // 75 (qualified)
  };
  // Minimum days in stage before auto-transition
  minDaysInStage: {
    lead: number;          // 2 days
    qualified: number;     // 3 days
    proposal: number;      // 5 days
    negotiation: number;   // 7 days
  };
  // Maximum days before marking as stalled
  stalledThreshold: number;  // 7 days
}

const DEFAULT_TRANSITION_RULES: OpportunityTransitionRules = {
  minQualificationScore: {
    lead_to_qualified: 55,
    qualified_to_proposal: 65,
    proposal_to_negotiation: 70,
    negotiation_to_closed: 75
  },
  minDaysInStage: {
    lead: 2,
    qualified: 3,
    proposal: 5,
    negotiation: 7
  },
  stalledThreshold: 7
};

/**
 * Create new opportunity from TikTok lead
 */
export async function createOpportunityFromLead(
  env: any,
  params: CreateOpportunityParams
): Promise<{
  opportunityId: string;
  success: boolean;
  error?: string;
}> {
  try {
    logger.info('[createOpportunityFromLead] Creating opportunity', {
      leadId: params.leadId,
      source: params.source
    });

    // Generate opportunity ID
    const opportunityId = `opp-${params.leadId}`;

    // Get or create OpportunityDO
    const oppId = env.OPPORTUNITY_DO.idFromName(opportunityId);
    const oppDO = env.OPPORTUNITY_DO.get(oppId);

    // Initialize opportunity
    await oppDO.getState();

    // Update source metadata
    await oppDO.sql.exec(`
      UPDATE opportunity
      SET
        source = ?,
        source_metadata = ?,
        contact_id = ?,
        deal_value = ?,
        currency = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `,
      params.source,
      params.sourceMetadata ? JSON.stringify(params.sourceMetadata) : null,
      params.contactId || null,
      params.dealValue || null,
      params.currency || 'USD'
    );

    // Log initial activity
    await oppDO.logActivity(
      'opportunity_created',
      `Opportunity created from ${params.source} lead`,
      { leadId: params.leadId, source: params.source }
    );

    logger.info('[createOpportunityFromLead] Opportunity created', {
      opportunityId,
      leadId: params.leadId
    });

    return {
      opportunityId,
      success: true
    };

  } catch (error: any) {
    logger.error('[createOpportunityFromLead] Error', {
      error: error.message,
      leadId: params.leadId
    });

    return {
      opportunityId: '',
      success: false,
      error: error.message
    };
  }
}

/**
 * Sync qualification score from LeadQualificationDO to OpportunityDO
 */
export async function syncQualificationScore(
  env: any,
  opportunityId: string,
  qualificationScore: number,
  isQualified: boolean
): Promise<void> {
  try {
    const oppId = env.OPPORTUNITY_DO.idFromName(opportunityId);
    const oppDO = env.OPPORTUNITY_DO.get(oppId);

    await oppDO.updateQualificationScore(qualificationScore, isQualified);

    logger.info('[syncQualificationScore] Score synced', {
      opportunityId,
      score: qualificationScore,
      isQualified
    });

  } catch (error: any) {
    logger.error('[syncQualificationScore] Error', {
      error: error.message,
      opportunityId
    });
  }
}

/**
 * Check if opportunity should auto-transition to next stage
 */
export async function checkAutoTransition(
  env: any,
  opportunityId: string,
  rules: OpportunityTransitionRules = DEFAULT_TRANSITION_RULES
): Promise<{
  shouldTransition: boolean;
  newStage?: OpportunityStage;
  reason?: string;
}> {
  try {
    const oppId = env.OPPORTUNITY_DO.idFromName(opportunityId);
    const oppDO = env.OPPORTUNITY_DO.get(oppId);

    const state = await oppDO.getState();
    const now = Date.now();
    const daysInStage = (now - (state.stageEnteredAt * 1000)) / (1000 * 60 * 60 * 24);

    logger.info('[checkAutoTransition] Checking transition', {
      opportunityId,
      currentStage: state.stage,
      qualificationScore: state.qualificationScore,
      daysInStage: daysInStage.toFixed(1)
    });

    // Don't auto-transition closed opportunities
    if (state.stage === 'closed_won' || state.stage === 'closed_lost') {
      return { shouldTransition: false };
    }

    // Check for auto-advancement
    switch (state.stage) {
      case 'lead':
        if (
          state.qualificationScore >= rules.minQualificationScore.lead_to_qualified &&
          daysInStage >= rules.minDaysInStage.lead
        ) {
          return {
            shouldTransition: true,
            newStage: 'qualified',
            reason: `Qualification score ${state.qualificationScore} met threshold ${rules.minQualificationScore.lead_to_qualified}`
          };
        }
        break;

      case 'qualified':
        if (
          state.qualificationScore >= rules.minQualificationScore.qualified_to_proposal &&
          daysInStage >= rules.minDaysInStage.qualified
        ) {
          return {
            shouldTransition: true,
            newStage: 'proposal',
            reason: `Strong qualification score ${state.qualificationScore}, ready for proposal`
          };
        }
        break;

      case 'proposal':
        if (
          state.qualificationScore >= rules.minQualificationScore.proposal_to_negotiation &&
          daysInStage >= rules.minDaysInStage.proposal
        ) {
          return {
            shouldTransition: true,
            newStage: 'negotiation',
            reason: `Proposal sent, moving to negotiation`
          };
        }
        break;

      case 'negotiation':
        if (
          state.qualificationScore >= rules.minQualificationScore.negotiation_to_closed &&
          daysInStage >= rules.minDaysInStage.negotiation
        ) {
          // Don't auto-close, but flag for review
          await oppDO.logActivity(
            'review_required',
            'Opportunity ready to close - manual review required',
            { qualificationScore: state.qualificationScore }
          );
        }
        break;
    }

    return { shouldTransition: false };

  } catch (error: any) {
    logger.error('[checkAutoTransition] Error', {
      error: error.message,
      opportunityId
    });

    return { shouldTransition: false };
  }
}

/**
 * Execute auto-transition if conditions are met
 */
export async function executeAutoTransition(
  env: any,
  opportunityId: string,
  rules: OpportunityTransitionRules = DEFAULT_TRANSITION_RULES
): Promise<{
  transitioned: boolean;
  newStage?: OpportunityStage;
  reason?: string;
}> {
  try {
    const check = await checkAutoTransition(env, opportunityId, rules);

    if (check.shouldTransition && check.newStage) {
      const oppId = env.OPPORTUNITY_DO.idFromName(opportunityId);
      const oppDO = env.OPPORTUNITY_DO.get(oppId);

      await oppDO.transitionStage(check.newStage, check.reason);

      logger.info('[executeAutoTransition] Transitioned', {
        opportunityId,
        newStage: check.newStage,
        reason: check.reason
      });

      return {
        transitioned: true,
        newStage: check.newStage,
        reason: check.reason
      };
    }

    return { transitioned: false };

  } catch (error: any) {
    logger.error('[executeAutoTransition] Error', {
      error: error.message,
      opportunityId
    });

    return { transitioned: false };
  }
}

/**
 * Check all opportunities for auto-transitions (run periodically)
 */
export async function processAutoTransitions(
  env: any,
  opportunityIds: string[],
  rules: OpportunityTransitionRules = DEFAULT_TRANSITION_RULES
): Promise<{
  processed: number;
  transitioned: number;
  errors: number;
}> {
  const results = {
    processed: 0,
    transitioned: 0,
    errors: 0
  };

  for (const opportunityId of opportunityIds) {
    try {
      const result = await executeAutoTransition(env, opportunityId, rules);
      results.processed++;

      if (result.transitioned) {
        results.transitioned++;
      }
    } catch (error) {
      results.errors++;
      logger.error('[processAutoTransitions] Error processing opportunity', {
        opportunityId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  logger.info('[processAutoTransitions] Batch complete', results);

  return results;
}

/**
 * Get opportunities by stage
 */
export async function getOpportunitiesByStage(
  _env: any,
  _stage: OpportunityStage,
  _limit: number = 100
): Promise<string[]> {
  // TODO: Implement global search across all OpportunityDOs
  // Options:
  // 1. Use D1 to store opportunity index
  // 2. Use KV with stage prefix keys
  // 3. Use Vectorize for similarity search

  // For now, return empty array
  // This will be implemented when we add D1 analytics layer
  return [];
}

/**
 * Calculate opportunity health score
 */
export function calculateOpportunityHealth(
  stage: OpportunityStage,
  qualificationScore: number,
  daysInStage: number,
  daysSinceLastActivity: number
): {
  score: number;  // 0-100
  status: 'healthy' | 'at_risk' | 'stalled';
  reasons: string[];
} {
  let score = 100;
  const reasons: string[] = [];

  // Deduct points for low qualification
  if (qualificationScore < 50) {
    score -= 30;
    reasons.push('Low qualification score');
  } else if (qualificationScore < 70) {
    score -= 15;
    reasons.push('Moderate qualification score');
  }

  // Deduct points for too long in stage
  const maxDaysInStage: Record<OpportunityStage, number> = {
    lead: 7,
    qualified: 14,
    proposal: 21,
    negotiation: 30,
    closed_won: 0,
    closed_lost: 0
  };

  if (stage !== 'closed_won' && stage !== 'closed_lost') {
    const max = maxDaysInStage[stage];
    if (daysInStage > max) {
      const overage = daysInStage - max;
      const penalty = Math.min(40, overage * 5);
      score -= penalty;
      reasons.push(`${overage.toFixed(0)} days over expected stage duration`);
    }
  }

  // Deduct points for inactivity
  if (daysSinceLastActivity > 7) {
    score -= 30;
    reasons.push(`No activity in ${daysSinceLastActivity} days`);
  } else if (daysSinceLastActivity > 3) {
    score -= 15;
    reasons.push(`${daysSinceLastActivity} days since last activity`);
  }

  score = Math.max(0, Math.min(100, score));

  let status: 'healthy' | 'at_risk' | 'stalled';
  if (score >= 70) {
    status = 'healthy';
  } else if (score >= 40) {
    status = 'at_risk';
  } else {
    status = 'stalled';
  }

  return { score, status, reasons };
}
