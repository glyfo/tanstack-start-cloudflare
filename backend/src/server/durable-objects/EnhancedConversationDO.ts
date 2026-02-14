/**
 * EnhancedConversationDO - Advanced conversation state machine
 *
 * Features:
 * - Multi-phase conversation tracking
 * - Intent classification
 * - Sentiment analysis
 * - Engagement scoring
 * - Automatic phase transitions
 * - Integration with LeadQualificationDO
 */

import {
  ConversationPhase,
  ConversationIntent,
  Sentiment,
  EnhancedConversationState,
  StateTransitionRule,
  ConversationContext
} from "../types/conversation-types";
import { createLogger } from "../utils/logger";

const logger = createLogger("EnhancedConversationDO");

export class EnhancedConversationDO {
  private sql: SqlStorage;
  private conversationId: string;
  private env: any;

  constructor(ctx: any, env: any) {
    this.sql = ctx.storage.sql;
    this.conversationId = ctx.id.toString();
    this.env = env;
    this.initializeSchema();
    logger.info(`[EnhancedConversationDO] Initialized: ${this.conversationId}`);
  }

  private initializeSchema(): void {
    // Main conversation state table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS enhanced_conversation_state (
        id TEXT PRIMARY KEY DEFAULT 'current',
        session_id TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'initial_contact',
        previous_phase TEXT,
        phase_started_at INTEGER DEFAULT (unixepoch()),
        current_intent TEXT DEFAULT 'unknown',
        qualification_score INTEGER DEFAULT 0,
        is_qualified BOOLEAN DEFAULT 0,
        sentiment TEXT DEFAULT 'neutral',
        message_count INTEGER DEFAULT 0,
        user_message_count INTEGER DEFAULT 0,
        assistant_message_count INTEGER DEFAULT 0,
        avg_response_time INTEGER,
        engagement_score INTEGER DEFAULT 0,
        needs_human_escalation BOOLEAN DEFAULT 0,
        escalation_reason TEXT,
        has_unresolved_objection BOOLEAN DEFAULT 0,
        is_stalled BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        last_message_at INTEGER
      )
    `);

    // Phase transition history
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS phase_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_phase TEXT NOT NULL,
        to_phase TEXT NOT NULL,
        reason TEXT,
        timestamp INTEGER DEFAULT (unixepoch())
      )
    `);

    // Intent history
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS intent_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        timestamp INTEGER DEFAULT (unixepoch())
      )
    `);

    // Sentiment history
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sentiment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sentiment TEXT NOT NULL,
        score REAL DEFAULT 0.0,
        timestamp INTEGER DEFAULT (unixepoch())
      )
    `);

    // Message history
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        intent TEXT,
        sentiment TEXT,
        timestamp INTEGER DEFAULT (unixepoch()),
        metadata TEXT
      )
    `);

    // Initialize state if not exists
    const existing = this.sql.exec(`
      SELECT id FROM enhanced_conversation_state WHERE id = 'current'
    `).toArray();

    if (existing.length === 0) {
      this.sql.exec(`
        INSERT INTO enhanced_conversation_state (id, session_id)
        VALUES ('current', ?)
      `, this.conversationId);
    }

    logger.info(`[EnhancedConversationDO] Schema initialized`);
  }

  /**
   * Process a new message and update state
   */
  async processMessage(
    role: "user" | "assistant",
    content: string,
    metadata?: Record<string, any>
  ): Promise<EnhancedConversationState> {
    const messageId = crypto.randomUUID();
    const timestamp = Date.now();

    // Detect intent and sentiment using LLM
    let intent: ConversationIntent = 'unknown';
    let sentiment: Sentiment = 'neutral';
    let intentConfidence = 0.5;
    let sentimentScore = 0.0;

    if (role === 'user' && this.env.AI) {
      try {
        const analysis = await this.analyzeMessage(content);
        intent = analysis.intent;
        sentiment = analysis.sentiment;
        intentConfidence = analysis.intentConfidence;
        sentimentScore = analysis.sentimentScore;
      } catch (error) {
        logger.error('[EnhancedConversationDO] Message analysis failed', error);
      }
    }

    // Save message
    this.sql.exec(`
      INSERT INTO messages (id, role, content, intent, sentiment, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      messageId,
      role,
      content,
      intent,
      sentiment,
      timestamp,
      metadata ? JSON.stringify(metadata) : null
    );

    // Update message counts
    this.sql.exec(`
      UPDATE enhanced_conversation_state
      SET
        message_count = message_count + 1,
        ${role === 'user' ? 'user_message_count = user_message_count + 1' : 'assistant_message_count = assistant_message_count + 1'},
        last_message_at = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `, timestamp);

    // Track intent if user message
    if (role === 'user') {
      this.sql.exec(`
        INSERT INTO intent_history (intent, confidence, timestamp)
        VALUES (?, ?, ?)
      `, intent, intentConfidence, timestamp);

      // Update current intent
      this.sql.exec(`
        UPDATE enhanced_conversation_state
        SET current_intent = ?
        WHERE id = 'current'
      `, intent);
    }

    // Track sentiment
    this.sql.exec(`
      INSERT INTO sentiment_history (sentiment, score, timestamp)
      VALUES (?, ?, ?)
    `, sentiment, sentimentScore, timestamp);

    // Update overall sentiment (use moving average)
    const recentSentiments = this.sql.exec(`
      SELECT score FROM sentiment_history
      ORDER BY timestamp DESC
      LIMIT 5
    `).toArray() as any[];

    const avgSentimentScore = recentSentiments.length > 0
      ? recentSentiments.reduce((sum: number, row: any) => sum + row.score, 0) / recentSentiments.length
      : 0;

    const overallSentiment: Sentiment =
      avgSentimentScore > 0.3 ? 'positive' :
      avgSentimentScore < -0.3 ? 'negative' : 'neutral';

    this.sql.exec(`
      UPDATE enhanced_conversation_state
      SET sentiment = ?
      WHERE id = 'current'
    `, overallSentiment);

    // Calculate engagement score
    await this.updateEngagementScore();

    // Check for phase transitions
    await this.checkPhaseTransition();

    // Check for escalation needs
    await this.checkEscalation();

    return this.getState();
  }

  /**
   * Analyze message using LLM
   */
  private async analyzeMessage(content: string): Promise<{
    intent: ConversationIntent;
    sentiment: Sentiment;
    intentConfidence: number;
    sentimentScore: number;
  }> {
    // Use Workers AI for analysis
    const prompt = `Analyze this customer message and provide:
1. Intent (general_inquiry, request_demo, pricing_question, feature_question, support_request, objection, ready_to_buy, schedule_meeting, provide_information, unknown)
2. Sentiment (positive, neutral, negative)
3. Intent confidence (0-1)
4. Sentiment score (-1 to 1)

Message: "${content}"

Respond in JSON format:
{
  "intent": "...",
  "sentiment": "...",
  "intentConfidence": 0.8,
  "sentimentScore": 0.5
}`;

    try {
      const response = await this.env.AI.run(this.env.AI_MODEL || '@cf/zai-org/glm-4.7-flash', {
        prompt,
        max_tokens: 200
      });

      const text = response.response || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        intent: parsed.intent || 'unknown',
        sentiment: parsed.sentiment || 'neutral',
        intentConfidence: parsed.intentConfidence || 0.5,
        sentimentScore: parsed.sentimentScore || 0.0
      };
    } catch (error) {
      logger.error('[EnhancedConversationDO] LLM analysis failed', error);
      return {
        intent: 'unknown',
        sentiment: 'neutral',
        intentConfidence: 0.5,
        sentimentScore: 0.0
      };
    }
  }

  /**
   * Transition to a new phase
   */
  async transitionPhase(
    newPhase: ConversationPhase,
    reason?: string
  ): Promise<void> {
    const state = await this.getState();

    // Record transition
    this.sql.exec(`
      INSERT INTO phase_transitions (from_phase, to_phase, reason, timestamp)
      VALUES (?, ?, ?, ?)
    `, state.phase, newPhase, reason, Date.now());

    // Update state
    this.sql.exec(`
      UPDATE enhanced_conversation_state
      SET
        previous_phase = phase,
        phase = ?,
        phase_started_at = unixepoch(),
        updated_at = unixepoch()
      WHERE id = 'current'
    `, newPhase);

    logger.info(`[EnhancedConversationDO] Phase transition`, {
      from: state.phase,
      to: newPhase,
      reason
    });
  }

  /**
   * Check if phase transition should occur
   */
  private async checkPhaseTransition(): Promise<void> {
    const state = await this.getState();
    const rules = this.getTransitionRules();

    for (const rule of rules) {
      if (rule.from !== state.phase) continue;
      if (!rule.autoAdvance) continue;

      const conditions = rule.conditions;
      let shouldTransition = true;

      // Check qualification score
      if (conditions.minQualificationScore !== undefined) {
        if (state.qualificationScore < conditions.minQualificationScore) {
          shouldTransition = false;
        }
      }

      // Check engagement score
      if (conditions.minEngagementScore !== undefined) {
        if (state.engagementScore < conditions.minEngagementScore) {
          shouldTransition = false;
        }
      }

      // Check required signals
      if (conditions.requiredSignals && conditions.requiredSignals.length > 0) {
        const recentMessages = await this.getRecentMessages(5);
        const hasAllSignals = conditions.requiredSignals.every(signal =>
          recentMessages.some(msg =>
            msg.content.toLowerCase().includes(signal.toLowerCase())
          )
        );

        if (!hasAllSignals) {
          shouldTransition = false;
        }
      }

      // Custom check
      if (conditions.customCheck) {
        if (!conditions.customCheck(state)) {
          shouldTransition = false;
        }
      }

      if (shouldTransition) {
        await this.transitionPhase(rule.to, 'Auto-transition based on rules');
        break; // Only one transition at a time
      }
    }
  }

  /**
   * Define state transition rules
   */
  private getTransitionRules(): StateTransitionRule[] {
    return [
      {
        from: 'initial_contact',
        to: 'qualifying',
        conditions: {
          minEngagementScore: 20
        },
        autoAdvance: true
      },
      {
        from: 'qualifying',
        to: 'needs_assessment',
        conditions: {
          minQualificationScore: 50
        },
        autoAdvance: true
      },
      {
        from: 'needs_assessment',
        to: 'presenting_solution',
        conditions: {
          requiredSignals: ['interested', 'tell me more', 'how does it work']
        },
        autoAdvance: true
      },
      {
        from: 'presenting_solution',
        to: 'proposal',
        conditions: {
          requiredSignals: ['send me', 'proposal', 'pricing']
        },
        autoAdvance: true
      },
      {
        from: 'proposal',
        to: 'negotiation',
        conditions: {
          requiredSignals: ['negotiate', 'adjust', 'discount']
        },
        autoAdvance: true
      },
      {
        from: 'negotiation',
        to: 'closing',
        conditions: {
          requiredSignals: ['agree', 'let\'s proceed', 'ready to sign']
        },
        autoAdvance: true
      },
      {
        from: 'closing',
        to: 'closed_won',
        conditions: {
          requiredSignals: ['signed', 'approved', 'confirmed']
        },
        autoAdvance: true
      }
    ];
  }

  /**
   * Update engagement score based on conversation metrics
   */
  private async updateEngagementScore(): Promise<void> {
    const state = await this.getState();

    // Calculate engagement score (0-100)
    let score = 0;

    // Message count contribution (0-30)
    const messageScore = Math.min(state.messageCount * 3, 30);
    score += messageScore;

    // Sentiment contribution (0-30)
    const sentimentMultiplier = {
      positive: 1.0,
      neutral: 0.6,
      negative: 0.2,
      unknown: 0.4
    }[state.sentiment];
    score += 30 * sentimentMultiplier;

    // Response time contribution (0-20)
    if (state.avgResponseTime) {
      const responseScore = state.avgResponseTime < 5000 ? 20 :
                            state.avgResponseTime < 15000 ? 15 :
                            state.avgResponseTime < 30000 ? 10 : 5;
      score += responseScore;
    }

    // Recent activity contribution (0-20)
    const timeSinceLastMessage = state.lastMessageAt ?
      Date.now() - state.lastMessageAt : Infinity;
    const activityScore = timeSinceLastMessage < 3600000 ? 20 :  // < 1 hour
                         timeSinceLastMessage < 86400000 ? 10 :  // < 1 day
                         5;
    score += activityScore;

    // Update
    this.sql.exec(`
      UPDATE enhanced_conversation_state
      SET engagement_score = ?
      WHERE id = 'current'
    `, Math.round(score));
  }

  /**
   * Check if human escalation is needed
   */
  private async checkEscalation(): Promise<void> {
    const state = await this.getState();
    let needsEscalation = false;
    let reason: string | undefined;

    // Check for negative sentiment
    if (state.sentiment === 'negative') {
      const recentSentiments = this.sql.exec(`
        SELECT sentiment FROM sentiment_history
        ORDER BY timestamp DESC
        LIMIT 3
      `).toArray() as any[];

      if (recentSentiments.every(s => s.sentiment === 'negative')) {
        needsEscalation = true;
        reason = 'Consistent negative sentiment detected';
      }
    }

    // Check for unresolved objections
    if (state.hasUnresolvedObjection) {
      needsEscalation = true;
      reason = 'Unresolved objection detected';
    }

    // Check for high-value leads stuck in qualification
    if (state.phase === 'qualifying' && state.qualificationScore > 60) {
      const phaseTime = Date.now() - (state.phaseStartedAt * 1000);
      if (phaseTime > 24 * 60 * 60 * 1000) { // 24 hours
        needsEscalation = true;
        reason = 'High-value lead stuck in qualification';
      }
    }

    if (needsEscalation && !state.needsHumanEscalation) {
      this.sql.exec(`
        UPDATE enhanced_conversation_state
        SET
          needs_human_escalation = 1,
          escalation_reason = ?
        WHERE id = 'current'
      `, reason);

      logger.warn(`[EnhancedConversationDO] Escalation triggered`, {
        conversationId: this.conversationId,
        reason
      });
    }
  }

  /**
   * Update qualification score from LeadQualificationDO
   */
  async updateQualificationScore(score: number, isQualified: boolean): Promise<void> {
    this.sql.exec(`
      UPDATE enhanced_conversation_state
      SET
        qualification_score = ?,
        is_qualified = ?,
        updated_at = unixepoch()
      WHERE id = 'current'
    `, score, isQualified ? 1 : 0);

    logger.info(`[EnhancedConversationDO] Qualification score updated`, {
      conversationId: this.conversationId,
      score,
      isQualified
    });
  }

  /**
   * Get current state
   */
  async getState(): Promise<EnhancedConversationState> {
    const row = this.sql.exec(`
      SELECT * FROM enhanced_conversation_state WHERE id = 'current'
    `).toArray()[0] as any;

    const phaseTransitions = this.sql.exec(`
      SELECT from_phase, to_phase, timestamp, reason
      FROM phase_transitions
      ORDER BY timestamp DESC
      LIMIT 10
    `).toArray() as any[];

    const intentHistory = this.sql.exec(`
      SELECT intent, confidence, timestamp
      FROM intent_history
      ORDER BY timestamp DESC
      LIMIT 10
    `).toArray() as any[];

    const sentimentHistory = this.sql.exec(`
      SELECT sentiment, score, timestamp
      FROM sentiment_history
      ORDER BY timestamp DESC
      LIMIT 10
    `).toArray() as any[];

    return {
      id: row.id,
      sessionId: row.session_id,
      phase: row.phase as ConversationPhase,
      previousPhase: row.previous_phase as ConversationPhase | undefined,
      phaseStartedAt: row.phase_started_at,
      phaseTransitions: phaseTransitions.map(t => ({
        from: t.from_phase,
        to: t.to_phase,
        timestamp: t.timestamp,
        reason: t.reason
      })),
      currentIntent: row.current_intent as ConversationIntent,
      intentHistory: intentHistory.map(i => ({
        intent: i.intent,
        timestamp: i.timestamp,
        confidence: i.confidence
      })),
      bant: {}, // Stored in LeadQualificationDO
      qualificationScore: row.qualification_score,
      isQualified: Boolean(row.is_qualified),
      contact: {}, // Stored in LeadQualificationDO
      sentiment: row.sentiment as Sentiment,
      sentimentHistory: sentimentHistory.map(s => ({
        sentiment: s.sentiment,
        timestamp: s.timestamp,
        score: s.score
      })),
      messageCount: row.message_count,
      userMessageCount: row.user_message_count,
      assistantMessageCount: row.assistant_message_count,
      avgResponseTime: row.avg_response_time,
      engagementScore: row.engagement_score,
      needsHumanEscalation: Boolean(row.needs_human_escalation),
      escalationReason: row.escalation_reason,
      hasUnresolvedObjection: Boolean(row.has_unresolved_objection),
      isStalled: Boolean(row.is_stalled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at
    };
  }

  /**
   * Get conversation context for LLM
   */
  async getContext(): Promise<ConversationContext> {
    const state = await this.getState();

    // Get recent messages
    const recentMessages = await this.getRecentMessages(10);
    const recentTopics = this.extractTopics(recentMessages.map(m => m.content).join(' '));

    return {
      phase: state.phase,
      intent: state.currentIntent,
      qualificationStatus: {
        score: state.qualificationScore,
        isQualified: state.isQualified,
        missingFields: [] // Would be populated from LeadQualificationDO
      },
      contactInfo: {},
      sentiment: state.sentiment,
      recentTopics,
      flags: {
        needsEscalation: state.needsHumanEscalation,
        hasObjection: state.hasUnresolvedObjection,
        isStalled: state.isStalled
      }
    };
  }

  /**
   * Get recent messages
   */
  private async getRecentMessages(limit: number = 10): Promise<Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }>> {
    const rows = this.sql.exec(`
      SELECT id, role, content, timestamp
      FROM messages
      ORDER BY timestamp DESC
      LIMIT ?
    `, limit).toArray() as any[];

    return rows.reverse();
  }

  /**
   * Extract topics from text (simple keyword extraction)
   */
  private extractTopics(text: string): string[] {
    const keywords = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 10);

    return [...new Set(keywords)];
  }
}
