/**
 * LeadQualificationDO - BANT-based lead qualification system
 *
 * Responsibilities:
 * - Extract BANT data from conversations
 * - Calculate lead scores (0-100)
 * - Classify leads: Cold → Warm → Hot → Qualified
 * - Track qualification progress
 */

import { BANTData, ContactData } from "../types/conversation-types";
import { createLogger } from "../utils/logger";

const logger = createLogger("LeadQualificationDO");

export type LeadClassification = "cold" | "warm" | "hot" | "qualified" | "disqualified";

export interface LeadScore {
  total: number;              // 0-100
  budget: number;             // 0-30
  authority: number;          // 0-25
  need: number;               // 0-25
  timeline: number;           // 0-20
}

export interface QualificationState {
  leadId: string;
  classification: LeadClassification;
  score: LeadScore;
  bant: BANTData;
  contact: ContactData;
  qualifiedAt?: number;
  disqualifiedAt?: number;
  disqualificationReason?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * LeadQualificationDO - Manages lead qualification state
 */
export class LeadQualificationDO {
  private sql: SqlStorage;
  private leadId: string;

  constructor(ctx: any) {
    this.sql = ctx.storage.sql;
    this.leadId = ctx.id.toString();
    this.initializeSchema();
    logger.info(`[LeadQualificationDO] Initialized: ${this.leadId}`);
  }

  private initializeSchema(): void {
    // Qualification state table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS qualification_state (
        id TEXT PRIMARY KEY DEFAULT 'current',
        lead_id TEXT NOT NULL,
        classification TEXT NOT NULL DEFAULT 'cold',
        score_total INTEGER DEFAULT 0,
        score_budget INTEGER DEFAULT 0,
        score_authority INTEGER DEFAULT 0,
        score_need INTEGER DEFAULT 0,
        score_timeline INTEGER DEFAULT 0,
        bant_data TEXT DEFAULT '{}',
        contact_data TEXT DEFAULT '{}',
        qualified_at INTEGER,
        disqualified_at INTEGER,
        disqualification_reason TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Initialize if not exists
    const existing = this.sql.exec(`
      SELECT id FROM qualification_state WHERE id = 'current'
    `).toArray();

    if (existing.length === 0) {
      this.sql.exec(`
        INSERT INTO qualification_state (id, lead_id)
        VALUES ('current', ?)
      `, this.leadId);
    }

    logger.info(`[LeadQualificationDO] Schema initialized`);
  }

  /**
   * Update BANT data from conversation
   */
  async updateBANT(bant: Partial<BANTData>): Promise<QualificationState> {
    const current = await this.getState();
    const updatedBANT = { ...current.bant, ...bant };

    // Recalculate scores
    const score = this.calculateScore(updatedBANT);
    const classification = this.classifyLead(score.total);

    // Update database
    this.sql.exec(`
      UPDATE qualification_state
      SET
        bant_data = ?,
        score_total = ?,
        score_budget = ?,
        score_authority = ?,
        score_need = ?,
        score_timeline = ?,
        classification = ?,
        qualified_at = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `,
      JSON.stringify(updatedBANT),
      score.total,
      score.budget,
      score.authority,
      score.need,
      score.timeline,
      classification,
      classification === 'qualified' ? Date.now() : current.qualifiedAt
    );

    logger.info(`[LeadQualificationDO] BANT updated`, {
      leadId: this.leadId,
      score: score.total,
      classification
    });

    return this.getState();
  }

  /**
   * Update contact information
   */
  async updateContact(contact: Partial<ContactData>): Promise<QualificationState> {
    const current = await this.getState();
    const updatedContact = { ...current.contact, ...contact };

    this.sql.exec(`
      UPDATE qualification_state
      SET contact_data = ?, updated_at = unixepoch()
      WHERE id = 'current'
    `, JSON.stringify(updatedContact));

    logger.info(`[LeadQualificationDO] Contact updated`, {
      leadId: this.leadId,
      fields: Object.keys(contact)
    });

    return this.getState();
  }

  /**
   * Calculate lead score based on BANT data
   *
   * Scoring formula:
   * - Budget: 30 points (do they have budget?)
   * - Authority: 25 points (can they approve?)
   * - Need: 25 points (do they have urgent need?)
   * - Timeline: 20 points (when do they need it?)
   */
  private calculateScore(bant: BANTData): LeadScore {
    const score: LeadScore = {
      total: 0,
      budget: 0,
      authority: 0,
      need: 0,
      timeline: 0
    };

    // Budget score (0-30)
    if (bant.budget) {
      if (bant.budget.qualified) {
        score.budget = 30 * bant.budget.confidence;
      } else {
        score.budget = 5; // At least mentioned budget
      }
    }

    // Authority score (0-25)
    if (bant.authority) {
      if (bant.authority.canApprove) {
        score.authority = 25 * bant.authority.confidence;
      } else if (bant.authority.role === 'influencer') {
        score.authority = 15 * bant.authority.confidence;
      } else {
        score.authority = 5 * bant.authority.confidence;
      }
    }

    // Need score (0-25)
    if (bant.need) {
      const urgencyMultiplier = {
        high: 1.0,
        medium: 0.7,
        low: 0.4,
        unknown: 0.2
      }[bant.need.urgency];

      const painPointBonus = Math.min(bant.need.painPoints?.length || 0, 3) * 2;
      score.need = (20 * bant.need.confidence * urgencyMultiplier) + painPointBonus;
    }

    // Timeline score (0-20)
    if (bant.timeline) {
      const timelineScore = {
        'immediate': 20,
        '1-3 months': 16,
        '3-6 months': 12,
        '6-12 months': 8,
        '12+ months': 4
      }[bant.timeline.range || ''] || 0;

      score.timeline = timelineScore * bant.timeline.confidence;
    }

    // Calculate total (round to nearest integer)
    score.total = Math.round(
      score.budget + score.authority + score.need + score.timeline
    );

    // Ensure total is between 0-100
    score.total = Math.max(0, Math.min(100, score.total));

    return score;
  }

  /**
   * Classify lead based on score
   */
  private classifyLead(score: number): LeadClassification {
    if (score >= 75) return 'qualified';
    if (score >= 55) return 'hot';
    if (score >= 35) return 'warm';
    return 'cold';
  }

  /**
   * Mark lead as disqualified
   */
  async disqualify(reason: string): Promise<QualificationState> {
    this.sql.exec(`
      UPDATE qualification_state
      SET
        classification = 'disqualified',
        disqualified_at = ?,
        disqualification_reason = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `, Date.now(), reason);

    logger.info(`[LeadQualificationDO] Lead disqualified`, {
      leadId: this.leadId,
      reason
    });

    return this.getState();
  }

  /**
   * Get current qualification state
   */
  async getState(): Promise<QualificationState> {
    const row = this.sql.exec(`
      SELECT * FROM qualification_state WHERE id = 'current'
    `).toArray()[0] as any;

    return {
      leadId: row.lead_id,
      classification: row.classification as LeadClassification,
      score: {
        total: row.score_total,
        budget: row.score_budget,
        authority: row.score_authority,
        need: row.score_need,
        timeline: row.score_timeline
      },
      bant: JSON.parse(row.bant_data),
      contact: JSON.parse(row.contact_data),
      qualifiedAt: row.qualified_at,
      disqualifiedAt: row.disqualified_at,
      disqualificationReason: row.disqualification_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get missing BANT fields
   */
  async getMissingFields(): Promise<string[]> {
    const state = await this.getState();
    const missing: string[] = [];

    if (!state.bant.budget || !state.bant.budget.qualified) {
      missing.push('budget');
    }

    if (!state.bant.authority || !state.bant.authority.canApprove) {
      missing.push('authority');
    }

    if (!state.bant.need || state.bant.need.urgency === 'unknown') {
      missing.push('need');
    }

    if (!state.bant.timeline || !state.bant.timeline.range) {
      missing.push('timeline');
    }

    return missing;
  }

  /**
   * Check if lead is qualified
   */
  async isQualified(): Promise<boolean> {
    const state = await this.getState();
    return state.classification === 'qualified';
  }

  /**
   * Get qualification progress (0-100%)
   */
  async getProgress(): Promise<number> {
    const missing = await this.getMissingFields();
    const totalFields = 4; // B, A, N, T
    const collectedFields = totalFields - missing.length;
    return Math.round((collectedFields / totalFields) * 100);
  }
}
