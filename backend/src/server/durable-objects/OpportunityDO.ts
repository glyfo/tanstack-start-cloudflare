/**
 * OpportunityDO - Sales opportunity pipeline management
 *
 * Manages opportunities through sales stages:
 * Lead → Qualified → Proposal → Negotiation → Closed Won/Lost
 *
 * Architecture: One DO per organization (like ContactDO)
 * This allows listing, searching, and managing all opportunities for an org
 *
 * Features:
 * - CRUD operations for opportunities
 * - Stage management and transitions
 * - Deal value tracking
 * - Win/loss probability calculation
 * - Activity tracking
 * - Pipeline analytics
 */

import { DurableObject } from "cloudflare:workers";
import { createLogger } from '../utils/logger';

const logger = createLogger('OpportunityDO');

export type OpportunityStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface OpportunityData {
  id: string;
  title: string;
  contactId?: string;
  createdBy: string;

  // Stage tracking
  stage: OpportunityStage;
  previousStage?: OpportunityStage;
  stageEnteredAt: number;

  // Deal details
  dealValue?: number;
  currency: string;
  probability: number;  // 0-100 win probability
  expectedCloseDate?: number;
  actualCloseDate?: number;

  // Source tracking
  source: string;  // 'chat', 'tiktok', 'website', 'referral', etc.

  // Qualification
  qualificationScore: number;
  isQualified: boolean;

  // Activity
  lastActivityAt: number;
  isStalled: boolean;

  // Close reason
  closeReason?: string;
  competitor?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface StageTransition {
  id: string;
  opportunityId: string;
  fromStage: OpportunityStage;
  toStage: OpportunityStage;
  timestamp: number;
  reason?: string;
  durationInStage: number;
}

export interface OpportunityActivity {
  id: string;
  opportunityId: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

/**
 * OpportunityDO - Organization-scoped opportunity management
 *
 * Keyed by: organizationId
 * Each organization gets its own isolated OpportunityDO instance
 */
export class OpportunityDO extends DurableObject {
  private sql: SqlStorage;
  private orgId: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.orgId = ctx.id.toString();
    this.initializeSchema();
    logger.info(`[OpportunityDO] Initialized for org: ${this.orgId}`);
  }

  /**
   * Initialize SQL schema
   */
  private initializeSchema(): void {
    // Opportunities table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL CHECK(length(title) >= 2),
        contact_id TEXT,
        created_by TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'lead' CHECK(stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
        previous_stage TEXT,
        stage_entered_at INTEGER DEFAULT (unixepoch()),
        deal_value REAL,
        currency TEXT DEFAULT 'USD',
        probability INTEGER DEFAULT 10 CHECK(probability BETWEEN 0 AND 100),
        expected_close_date INTEGER,
        actual_close_date INTEGER,
        source TEXT DEFAULT 'chat',
        qualification_score INTEGER DEFAULT 0 CHECK(qualification_score BETWEEN 0 AND 100),
        is_qualified BOOLEAN DEFAULT 0,
        last_activity_at INTEGER DEFAULT (unixepoch()),
        is_stalled BOOLEAN DEFAULT 0,
        close_reason TEXT,
        competitor TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Performance indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_opportunities_stage
      ON opportunities(stage, created_at DESC)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_opportunities_contact
      ON opportunities(contact_id)
      WHERE contact_id IS NOT NULL
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_opportunities_value
      ON opportunities(deal_value DESC)
      WHERE deal_value IS NOT NULL
    `);

    // Stage transition history
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS stage_transitions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        opportunity_id TEXT NOT NULL,
        from_stage TEXT NOT NULL,
        to_stage TEXT NOT NULL,
        timestamp INTEGER DEFAULT (unixepoch()),
        reason TEXT,
        duration_in_stage INTEGER,
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_transitions_opportunity
      ON stage_transitions(opportunity_id, timestamp DESC)
    `);

    // Activity log
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        opportunity_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_opportunity
      ON activities(opportunity_id, created_at DESC)
    `);

    logger.info(`[OpportunityDO] Schema initialized for org: ${this.orgId}`);
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new opportunity
   */
  async createOpportunity(data: {
    title: string;
    contactId?: string;
    dealValue?: number;
    stage?: OpportunityStage;
    source?: string;
    expectedCloseDate?: number;
    createdBy: string;
  }): Promise<OpportunityData> {
    logger.info(`[OpportunityDO] Creating opportunity: ${data.title}`, {
      orgId: this.orgId,
    });

    // Validate required fields
    if (!data.title || data.title.trim().length < 2) {
      throw new Error("Title must be at least 2 characters");
    }

    if (!data.createdBy) {
      throw new Error("createdBy is required");
    }

    const id = crypto.randomUUID();
    const stage = data.stage || 'lead';
    const probability = this.calculateProbability(stage, 0);

    this.sql.exec(`
      INSERT INTO opportunities (
        id, title, contact_id, created_by, stage, deal_value,
        probability, source, expected_close_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      data.title.trim(),
      data.contactId || null,
      data.createdBy,
      stage,
      data.dealValue || null,
      probability,
      data.source || 'chat',
      data.expectedCloseDate || null
    );

    // Log creation activity
    await this.logActivity(id, 'created', `Opportunity created: ${data.title}`, {
      stage,
      dealValue: data.dealValue,
      contactId: data.contactId,
    });

    logger.info(`[OpportunityDO] Opportunity created: ${id}`, {
      orgId: this.orgId,
      title: data.title,
    });

    const opportunity = await this.getOpportunity(id);
    if (!opportunity) {
      throw new Error("Failed to retrieve created opportunity");
    }

    return opportunity;
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunity(opportunityId: string): Promise<OpportunityData | null> {
    const row = this.sql.exec(`
      SELECT * FROM opportunities WHERE id = ?
    `, opportunityId).toArray()[0] as any;

    if (!row) {
      return null;
    }

    return this.mapToOpportunity(row);
  }

  /**
   * List opportunities with filtering and pagination
   */
  async listOpportunities(params: {
    stage?: OpportunityStage;
    contactId?: string;
    limit?: number;
    offset?: number;
    excludeClosed?: boolean;
  } = {}): Promise<{
    opportunities: OpportunityData[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    let sql = `SELECT * FROM opportunities WHERE 1=1`;
    const countSql = `SELECT COUNT(*) as count FROM opportunities WHERE 1=1`;
    const bindings: any[] = [];
    let whereClause = '';

    if (params.stage) {
      whereClause += ` AND stage = ?`;
      bindings.push(params.stage);
    }

    if (params.contactId) {
      whereClause += ` AND contact_id = ?`;
      bindings.push(params.contactId);
    }

    if (params.excludeClosed) {
      whereClause += ` AND stage NOT IN ('closed_won', 'closed_lost')`;
    }

    // Get total count
    const countRow = this.sql.exec(countSql + whereClause, ...bindings).toArray()[0] as any;
    const total = countRow?.count || 0;

    // Get paginated results
    sql += whereClause + ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const rows = this.sql.exec(sql, ...bindings).toArray() as any[];
    const opportunities = rows.map(row => this.mapToOpportunity(row));

    return {
      opportunities,
      total,
      hasMore: offset + opportunities.length < total,
    };
  }

  /**
   * Update opportunity stage
   */
  async updateStage(
    opportunityId: string,
    newStage: OpportunityStage,
    reason?: string
  ): Promise<OpportunityData> {
    const current = await this.getOpportunity(opportunityId);
    if (!current) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    const now = Date.now();
    const durationInStage = now - (current.stageEnteredAt * 1000);

    // Record transition
    this.sql.exec(`
      INSERT INTO stage_transitions (opportunity_id, from_stage, to_stage, timestamp, reason, duration_in_stage)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      opportunityId,
      current.stage,
      newStage,
      Math.floor(now / 1000),
      reason || null,
      durationInStage
    );

    // Update opportunity
    const probability = this.calculateProbability(newStage, current.qualificationScore);
    const actualCloseDate = (newStage === 'closed_won' || newStage === 'closed_lost')
      ? Math.floor(now / 1000)
      : null;

    this.sql.exec(`
      UPDATE opportunities
      SET
        previous_stage = stage,
        stage = ?,
        stage_entered_at = unixepoch(),
        probability = ?,
        actual_close_date = COALESCE(?, actual_close_date),
        last_activity_at = unixepoch(),
        updated_at = unixepoch()
      WHERE id = ?
    `,
      newStage,
      probability,
      actualCloseDate,
      opportunityId
    );

    // Log activity
    await this.logActivity(
      opportunityId,
      'stage_changed',
      `Stage changed: ${current.stage} → ${newStage}`,
      { reason, previousStage: current.stage }
    );

    logger.info(`[OpportunityDO] Stage transition`, {
      opportunityId,
      from: current.stage,
      to: newStage,
      reason
    });

    const updated = await this.getOpportunity(opportunityId);
    if (!updated) {
      throw new Error("Failed to retrieve updated opportunity");
    }

    return updated;
  }

  /**
   * Update opportunity details
   */
  async updateOpportunity(
    opportunityId: string,
    data: Partial<{
      title: string;
      contactId: string;
      dealValue: number;
      expectedCloseDate: number;
      qualificationScore: number;
    }>,
    updatedBy: string
  ): Promise<OpportunityData> {
    const existing = await this.getOpportunity(opportunityId);
    if (!existing) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    const updates: string[] = [];
    const bindings: any[] = [];
    const changes: string[] = [];

    if (data.title !== undefined && data.title !== existing.title) {
      if (data.title.length < 2) {
        throw new Error("Title must be at least 2 characters");
      }
      updates.push("title = ?");
      bindings.push(data.title);
      changes.push(`title: ${existing.title} → ${data.title}`);
    }

    if (data.contactId !== undefined && data.contactId !== existing.contactId) {
      updates.push("contact_id = ?");
      bindings.push(data.contactId || null);
      changes.push(`contactId updated`);
    }

    if (data.dealValue !== undefined && data.dealValue !== existing.dealValue) {
      updates.push("deal_value = ?");
      bindings.push(data.dealValue);
      changes.push(`dealValue: ${existing.dealValue} → ${data.dealValue}`);
    }

    if (data.expectedCloseDate !== undefined && data.expectedCloseDate !== existing.expectedCloseDate) {
      updates.push("expected_close_date = ?");
      bindings.push(data.expectedCloseDate);
      changes.push(`expectedCloseDate updated`);
    }

    if (data.qualificationScore !== undefined && data.qualificationScore !== existing.qualificationScore) {
      const newProbability = this.calculateProbability(existing.stage, data.qualificationScore);
      updates.push("qualification_score = ?");
      updates.push("probability = ?");
      updates.push("is_qualified = ?");
      bindings.push(data.qualificationScore, newProbability, data.qualificationScore >= 60 ? 1 : 0);
      changes.push(`qualificationScore: ${existing.qualificationScore} → ${data.qualificationScore}`);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("last_activity_at = unixepoch()");
    updates.push("updated_at = unixepoch()");
    bindings.push(opportunityId);

    this.sql.exec(
      `UPDATE opportunities SET ${updates.join(", ")} WHERE id = ?`,
      ...bindings
    );

    // Log activity
    await this.logActivity(opportunityId, 'updated', `Opportunity updated: ${changes.join(", ")}`, {
      changes,
      updatedBy,
    });

    logger.info(`[OpportunityDO] Opportunity updated: ${opportunityId}`, { orgId: this.orgId });

    const updated = await this.getOpportunity(opportunityId);
    if (!updated) {
      throw new Error("Failed to retrieve updated opportunity");
    }

    return updated;
  }

  /**
   * Close opportunity as won
   */
  async closeWon(opportunityId: string, reason?: string): Promise<OpportunityData> {
    const opp = await this.updateStage(opportunityId, 'closed_won', reason || 'Deal won');

    if (reason) {
      this.sql.exec(`
        UPDATE opportunities SET close_reason = ? WHERE id = ?
      `, reason, opportunityId);
    }

    return this.getOpportunity(opportunityId) as Promise<OpportunityData>;
  }

  /**
   * Close opportunity as lost
   */
  async closeLost(
    opportunityId: string,
    reason: string,
    competitor?: string
  ): Promise<OpportunityData> {
    await this.updateStage(opportunityId, 'closed_lost', reason);

    this.sql.exec(`
      UPDATE opportunities
      SET close_reason = ?, competitor = ?
      WHERE id = ?
    `, reason, competitor || null, opportunityId);

    return this.getOpportunity(opportunityId) as Promise<OpportunityData>;
  }

  /**
   * Delete opportunity (soft delete - mark as closed_lost)
   */
  async deleteOpportunity(opportunityId: string, deletedBy: string): Promise<{ success: boolean }> {
    const existing = await this.getOpportunity(opportunityId);
    if (!existing) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    await this.closeLost(opportunityId, `Deleted by ${deletedBy}`);

    logger.info(`[OpportunityDO] Opportunity deleted: ${opportunityId}`, { orgId: this.orgId });

    return { success: true };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get pipeline summary
   */
  async getPipelineSummary(): Promise<{
    byStage: Record<OpportunityStage, { count: number; totalValue: number }>;
    totalOpen: number;
    totalValue: number;
    avgDealSize: number;
  }> {
    const rows = this.sql.exec(`
      SELECT
        stage,
        COUNT(*) as count,
        COALESCE(SUM(deal_value), 0) as total_value
      FROM opportunities
      WHERE stage NOT IN ('closed_won', 'closed_lost')
      GROUP BY stage
    `).toArray() as any[];

    const byStage: Record<OpportunityStage, { count: number; totalValue: number }> = {
      lead: { count: 0, totalValue: 0 },
      qualified: { count: 0, totalValue: 0 },
      proposal: { count: 0, totalValue: 0 },
      negotiation: { count: 0, totalValue: 0 },
      closed_won: { count: 0, totalValue: 0 },
      closed_lost: { count: 0, totalValue: 0 },
    };

    let totalOpen = 0;
    let totalValue = 0;

    for (const row of rows) {
      byStage[row.stage as OpportunityStage] = {
        count: row.count,
        totalValue: row.total_value,
      };
      totalOpen += row.count;
      totalValue += row.total_value;
    }

    return {
      byStage,
      totalOpen,
      totalValue,
      avgDealSize: totalOpen > 0 ? Math.round(totalValue / totalOpen) : 0,
    };
  }

  /**
   * Get win/loss stats
   */
  async getWinLossStats(): Promise<{
    won: number;
    lost: number;
    winRate: number;
    totalWonValue: number;
  }> {
    const stats = this.sql.exec(`
      SELECT
        SUM(CASE WHEN stage = 'closed_won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN stage = 'closed_lost' THEN 1 ELSE 0 END) as lost,
        COALESCE(SUM(CASE WHEN stage = 'closed_won' THEN deal_value ELSE 0 END), 0) as won_value
      FROM opportunities
    `).toArray()[0] as any;

    const won = stats.won || 0;
    const lost = stats.lost || 0;
    const total = won + lost;

    return {
      won,
      lost,
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
      totalWonValue: stats.won_value || 0,
    };
  }

  // ============================================
  // ACTIVITY TRACKING
  // ============================================

  /**
   * Log activity for an opportunity
   */
  async logActivity(
    opportunityId: string,
    type: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO activities (id, opportunity_id, activity_type, description, metadata)
      VALUES (?, ?, ?, ?, ?)
    `,
      id,
      opportunityId,
      type,
      description,
      metadata ? JSON.stringify(metadata) : null
    );
  }

  /**
   * Get activity history for an opportunity
   */
  async getActivities(
    opportunityId: string,
    limit: number = 50
  ): Promise<OpportunityActivity[]> {
    const rows = this.sql.exec(`
      SELECT * FROM activities
      WHERE opportunity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, opportunityId, limit).toArray() as any[];

    return rows.map(row => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      type: row.activity_type,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get stage transition history
   */
  async getStageHistory(opportunityId: string): Promise<StageTransition[]> {
    const rows = this.sql.exec(`
      SELECT * FROM stage_transitions
      WHERE opportunity_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `, opportunityId).toArray() as any[];

    return rows.map(row => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      fromStage: row.from_stage,
      toStage: row.to_stage,
      timestamp: row.timestamp,
      reason: row.reason,
      durationInStage: row.duration_in_stage,
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Calculate win probability based on stage and qualification
   */
  private calculateProbability(
    stage: OpportunityStage,
    qualificationScore: number
  ): number {
    const stageProbabilities: Record<OpportunityStage, number> = {
      lead: 10,
      qualified: 25,
      proposal: 50,
      negotiation: 75,
      closed_won: 100,
      closed_lost: 0
    };

    let baseProbability = stageProbabilities[stage];

    // Adjust by qualification score (0.7 to 1.0 multiplier)
    const qualificationMultiplier = qualificationScore / 100;
    baseProbability = baseProbability * (0.7 + (0.3 * qualificationMultiplier));

    return Math.min(100, Math.max(0, Math.round(baseProbability)));
  }

  /**
   * Map database row to OpportunityData
   */
  private mapToOpportunity(row: any): OpportunityData {
    return {
      id: row.id,
      title: row.title,
      contactId: row.contact_id,
      createdBy: row.created_by,
      stage: row.stage as OpportunityStage,
      previousStage: row.previous_stage as OpportunityStage | undefined,
      stageEnteredAt: row.stage_entered_at,
      dealValue: row.deal_value,
      currency: row.currency,
      probability: row.probability,
      expectedCloseDate: row.expected_close_date,
      actualCloseDate: row.actual_close_date,
      source: row.source || 'chat',
      qualificationScore: row.qualification_score,
      isQualified: Boolean(row.is_qualified),
      lastActivityAt: row.last_activity_at,
      isStalled: Boolean(row.is_stalled),
      closeReason: row.close_reason,
      competitor: row.competitor,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
