/**
 * Tests for LeadQualificationDO
 *
 * Tests BANT-based lead qualification:
 * - Scoring algorithm
 * - Classification (cold/warm/hot/qualified)
 * - Data extraction and updates
 * - Progress tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LeadQualificationDO } from '../durable-objects/LeadQualificationDO';
import { BANTData } from '../types/conversation-types';

/**
 * Mock SQL Storage that properly persists state
 */
class MockQualificationSqlStorage {
  private state: any = null;

  exec(query: string, ...params: any[]): { toArray: () => any[] } {
    const trimmedQuery = query.trim().toUpperCase();

    // CREATE TABLE - ignore
    if (trimmedQuery.startsWith('CREATE')) {
      return { toArray: () => [] };
    }

    // SELECT id FROM qualification_state WHERE id = 'current' (existence check)
    if (trimmedQuery.includes('SELECT ID FROM QUALIFICATION_STATE')) {
      return { toArray: () => (this.state ? [{ id: 'current' }] : []) };
    }

    // INSERT INTO qualification_state
    if (trimmedQuery.includes('INSERT INTO QUALIFICATION_STATE')) {
      this.state = {
        id: 'current',
        lead_id: params[0] || 'test-lead-123',
        classification: 'cold',
        score_total: 0,
        score_budget: 0,
        score_authority: 0,
        score_need: 0,
        score_timeline: 0,
        bant_data: '{}',
        contact_data: '{}',
        qualified_at: null,
        disqualified_at: null,
        disqualification_reason: null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      return { toArray: () => [] };
    }

    // UPDATE qualification_state SET ... (BANT update)
    if (trimmedQuery.includes('UPDATE QUALIFICATION_STATE') && query.includes('bant_data')) {
      if (this.state) {
        // Parse UPDATE SET fields in order: bant_data, scores, classification, qualified_at
        let paramIndex = 0;
        this.state.bant_data = params[paramIndex++];
        this.state.score_total = params[paramIndex++];
        this.state.score_budget = params[paramIndex++];
        this.state.score_authority = params[paramIndex++];
        this.state.score_need = params[paramIndex++];
        this.state.score_timeline = params[paramIndex++];
        this.state.classification = params[paramIndex++];
        this.state.qualified_at = params[paramIndex++];
        this.state.updated_at = Math.floor(Date.now() / 1000);
      }
      return { toArray: () => [] };
    }

    // UPDATE qualification_state SET contact_data
    if (trimmedQuery.includes('UPDATE QUALIFICATION_STATE') && query.includes('contact_data')) {
      if (this.state) {
        this.state.contact_data = params[0];
        this.state.updated_at = Math.floor(Date.now() / 1000);
      }
      return { toArray: () => [] };
    }

    // UPDATE qualification_state SET classification = 'disqualified'
    if (trimmedQuery.includes('UPDATE QUALIFICATION_STATE') && query.includes('disqualified')) {
      if (this.state) {
        this.state.classification = 'disqualified';
        this.state.disqualified_at = params[0];
        this.state.disqualification_reason = params[1];
        this.state.updated_at = Math.floor(Date.now() / 1000);
      }
      return { toArray: () => [] };
    }

    // SELECT * FROM qualification_state WHERE id = 'current'
    if (trimmedQuery.includes('SELECT * FROM QUALIFICATION_STATE')) {
      return { toArray: () => (this.state ? [this.state] : []) };
    }

    return { toArray: () => [] };
  }
}

describe('LeadQualificationDO', () => {
  let leadQualificationDO: any;
  let mockStorage: MockQualificationSqlStorage;

  beforeEach(() => {
    mockStorage = new MockQualificationSqlStorage();

    const mockCtx = {
      storage: { sql: mockStorage },
      id: { toString: () => 'test-lead-123' }
    };

    leadQualificationDO = new LeadQualificationDO(mockCtx);
  });

  describe('Scoring Algorithm', () => {
    it('should calculate score of 0 for empty BANT data', async () => {
      const state = await leadQualificationDO.getState();
      expect(state.score.total).toBe(0);
      expect(state.classification).toBe('cold');
    });

    it('should score budget correctly (30 points max)', async () => {
      const bant: Partial<BANTData> = {
        budget: {
          range: '50k-100k',
          qualified: true,
          confidence: 1.0,
          extractedAt: Date.now()
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.budget).toBe(30);
    });

    it('should score authority correctly (25 points max)', async () => {
      const bant: Partial<BANTData> = {
        authority: {
          role: 'decision_maker',
          canApprove: true,
          confidence: 1.0,
          extractedAt: Date.now()
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.authority).toBe(25);
    });

    it('should score need correctly (25 base + pain point bonus)', async () => {
      const bant: Partial<BANTData> = {
        need: {
          description: 'Need CRM solution urgently',
          urgency: 'high',
          painPoints: ['manual processes', 'lost leads', 'no tracking'],
          confidence: 1.0,
          extractedAt: Date.now()
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      // 20 * 1.0 (confidence) * 1.0 (high urgency) + 6 (3 pain points * 2) = 26
      expect(state.score.need).toBe(26);
    });

    it('should score timeline correctly (20 points max)', async () => {
      const bant: Partial<BANTData> = {
        timeline: {
          range: 'immediate',
          confidence: 1.0,
          extractedAt: Date.now()
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.timeline).toBe(20);
    });

    it('should calculate total score correctly', async () => {
      const bant: BANTData = {
        budget: {
          range: '50k-100k',
          qualified: true,
          confidence: 1.0,
          extractedAt: Date.now()
        },
        authority: {
          role: 'decision_maker',
          canApprove: true,
          confidence: 1.0,
          extractedAt: Date.now()
        },
        need: {
          description: 'Critical need',
          urgency: 'high',
          painPoints: ['pain1', 'pain2'],
          confidence: 1.0,
          extractedAt: Date.now()
        },
        timeline: {
          range: 'immediate',
          confidence: 1.0,
          extractedAt: Date.now()
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.total).toBeGreaterThan(90);
      expect(state.score.total).toBeLessThanOrEqual(100);
    });
  });

  describe('Lead Classification', () => {
    it('should classify as "cold" for score 0-34', async () => {
      const bant: Partial<BANTData> = {
        budget: {
          range: '10k-50k',
          qualified: false,
          confidence: 0.3
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.classification).toBe('cold');
      expect(state.score.total).toBeLessThan(35);
    });

    it('should classify as "warm" for score 35-54', async () => {
      const bant: Partial<BANTData> = {
        budget: {
          qualified: true,
          confidence: 0.8
        },
        need: {
          urgency: 'medium',
          painPoints: ['pain1'],
          confidence: 0.7
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.classification).toBe('warm');
      expect(state.score.total).toBeGreaterThanOrEqual(35);
      expect(state.score.total).toBeLessThan(55);
    });

    it('should classify as "hot" for score 55-74', async () => {
      const bant: Partial<BANTData> = {
        budget: {
          qualified: true,
          confidence: 0.8  // 30 * 0.8 = 24
        },
        authority: {
          canApprove: true,
          confidence: 0.7  // 25 * 0.7 = 17.5
        },
        need: {
          urgency: 'medium',  // 0.7 multiplier
          painPoints: ['pain1'],  // +2 bonus
          confidence: 0.9  // 20 * 0.9 * 0.7 + 2 = 14.6
        }
      };
      // Total: 24 + 17.5 + 14.6 = 56.1 -> 56 (hot)

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.classification).toBe('hot');
      expect(state.score.total).toBeGreaterThanOrEqual(55);
      expect(state.score.total).toBeLessThan(75);
    });

    it('should classify as "qualified" for score 75+', async () => {
      const bant: BANTData = {
        budget: {
          qualified: true,
          confidence: 1.0
        },
        authority: {
          canApprove: true,
          confidence: 1.0
        },
        need: {
          urgency: 'high',
          painPoints: ['pain1', 'pain2', 'pain3'],
          confidence: 1.0
        },
        timeline: {
          range: 'immediate',
          confidence: 1.0
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.classification).toBe('qualified');
      expect(state.score.total).toBeGreaterThanOrEqual(75);
      expect(state.qualifiedAt).toBeDefined();
    });
  });

  describe('Missing Fields Detection', () => {
    it('should identify all missing fields initially', async () => {
      const missing = await leadQualificationDO.getMissingFields();
      expect(missing).toContain('budget');
      expect(missing).toContain('authority');
      expect(missing).toContain('need');
      expect(missing).toContain('timeline');
      expect(missing.length).toBe(4);
    });

    it('should not show budget as missing when qualified', async () => {
      await leadQualificationDO.updateBANT({
        budget: {
          qualified: true,
          confidence: 1.0
        }
      });

      const missing = await leadQualificationDO.getMissingFields();
      expect(missing).not.toContain('budget');
      expect(missing.length).toBe(3);
    });

    it('should calculate progress correctly', async () => {
      // Initially 0%
      let progress = await leadQualificationDO.getProgress();
      expect(progress).toBe(0);

      // Add budget - 25%
      await leadQualificationDO.updateBANT({
        budget: { qualified: true, confidence: 1.0 }
      });
      progress = await leadQualificationDO.getProgress();
      expect(progress).toBe(25);

      // Add authority - 50%
      await leadQualificationDO.updateBANT({
        authority: { canApprove: true, confidence: 1.0 }
      });
      progress = await leadQualificationDO.getProgress();
      expect(progress).toBe(50);

      // Add need - 75%
      await leadQualificationDO.updateBANT({
        need: { urgency: 'high', painPoints: [], confidence: 1.0 }
      });
      progress = await leadQualificationDO.getProgress();
      expect(progress).toBe(75);

      // Add timeline - 100%
      await leadQualificationDO.updateBANT({
        timeline: { range: 'immediate', confidence: 1.0 }
      });
      progress = await leadQualificationDO.getProgress();
      expect(progress).toBe(100);
    });
  });

  describe('Disqualification', () => {
    it('should disqualify lead with reason', async () => {
      const state = await leadQualificationDO.disqualify('No budget');

      expect(state.classification).toBe('disqualified');
      expect(state.disqualifiedAt).toBeDefined();
      expect(state.disqualificationReason).toBe('No budget');
    });
  });

  describe('Contact Data Management', () => {
    it('should update contact information', async () => {
      const contact = {
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Acme Corp'
      };

      const state = await leadQualificationDO.updateContact(contact);
      expect(state.contact.name).toBe('John Doe');
      expect(state.contact.email).toBe('john@example.com');
      expect(state.contact.company).toBe('Acme Corp');
    });

    it('should merge contact updates', async () => {
      await leadQualificationDO.updateContact({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const state = await leadQualificationDO.updateContact({
        company: 'Acme Corp',
        phone: '+1234567890'
      });

      expect(state.contact.name).toBe('John Doe');
      expect(state.contact.email).toBe('john@example.com');
      expect(state.contact.company).toBe('Acme Corp');
      expect(state.contact.phone).toBe('+1234567890');
    });
  });

  describe('Edge Cases', () => {
    it('should handle partial confidence scores', async () => {
      const bant: Partial<BANTData> = {
        budget: {
          qualified: true,
          confidence: 0.5  // 50% confidence
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.budget).toBe(15);  // 30 * 0.5
    });

    it('should handle influencer authority lower than decision maker', async () => {
      const bant: Partial<BANTData> = {
        authority: {
          role: 'influencer',
          canApprove: false,
          confidence: 1.0
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.authority).toBe(15);  // Lower than 25 for decision maker
    });

    it('should handle low urgency needs', async () => {
      const bant: Partial<BANTData> = {
        need: {
          urgency: 'low',
          painPoints: [],
          confidence: 1.0
        }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.need).toBeLessThan(10);
    });

    it('should cap total score at 100', async () => {
      // Even with max scores, total should not exceed 100
      const bant: BANTData = {
        budget: { qualified: true, confidence: 1.5 },  // Unrealistic high confidence
        authority: { canApprove: true, confidence: 1.5 },
        need: { urgency: 'high', painPoints: ['p1', 'p2', 'p3', 'p4', 'p5'], confidence: 1.5 },
        timeline: { range: 'immediate', confidence: 1.5 }
      };

      const state = await leadQualificationDO.updateBANT(bant);
      expect(state.score.total).toBeLessThanOrEqual(100);
    });
  });
});
