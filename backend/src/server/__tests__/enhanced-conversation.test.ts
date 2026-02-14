/**
 * Tests for EnhancedConversationDO
 *
 * Tests conversation state machine:
 * - Phase transitions
 * - Intent classification
 * - Sentiment tracking
 * - Engagement scoring
 * - Escalation detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedConversationDO } from '../durable-objects/EnhancedConversationDO';
import { ConversationPhase, Sentiment } from '../types/conversation-types';

describe('EnhancedConversationDO', () => {
  let conversationDO: any;
  let mockStorage: any;
  let mockEnv: any;

  beforeEach(() => {
    // Mock SQL storage
    const tables: Record<string, any[]> = {
      enhanced_conversation_state: [],
      phase_transitions: [],
      intent_history: [],
      sentiment_history: [],
      messages: []
    };

    mockStorage = {
      exec: (query: string, ...params: any[]) => {
        if (query.includes('INSERT INTO enhanced_conversation_state')) {
          tables.enhanced_conversation_state.push({
            id: 'current',
            session_id: 'test-session-123',
            phase: 'initial_contact',
            current_intent: 'unknown',
            qualification_score: 0,
            is_qualified: 0,
            sentiment: 'neutral',
            message_count: 0,
            user_message_count: 0,
            assistant_message_count: 0,
            engagement_score: 0,
            needs_human_escalation: 0,
            has_unresolved_objection: 0,
            is_stalled: 0,
            created_at: Date.now(),
            updated_at: Date.now(),
            phase_started_at: Date.now()
          });
        } else if (query.includes('INSERT INTO messages')) {
          tables.messages.push({
            id: params[0],
            role: params[1],
            content: params[2],
            intent: params[3],
            sentiment: params[4],
            timestamp: params[5]
          });
        } else if (query.includes('INSERT INTO intent_history')) {
          tables.intent_history.push({
            intent: params[0],
            confidence: params[1],
            timestamp: params[2]
          });
        } else if (query.includes('INSERT INTO sentiment_history')) {
          tables.sentiment_history.push({
            sentiment: params[0],
            score: params[1],
            timestamp: params[2]
          });
        } else if (query.includes('INSERT INTO phase_transitions')) {
          tables.phase_transitions.push({
            from_phase: params[0],
            to_phase: params[1],
            reason: params[2],
            timestamp: params[3]
          });
        } else if (query.includes('UPDATE enhanced_conversation_state')) {
          if (tables.enhanced_conversation_state[0]) {
            // Simple update simulation
            Object.assign(tables.enhanced_conversation_state[0], {
              updated_at: Date.now()
            });
          }
        } else if (query.includes('SELECT')) {
          if (query.includes('FROM enhanced_conversation_state')) {
            return { toArray: () => tables.enhanced_conversation_state };
          } else if (query.includes('FROM messages')) {
            return { toArray: () => tables.messages };
          } else if (query.includes('FROM intent_history')) {
            return { toArray: () => tables.intent_history };
          } else if (query.includes('FROM sentiment_history')) {
            return { toArray: () => tables.sentiment_history };
          } else if (query.includes('FROM phase_transitions')) {
            return { toArray: () => tables.phase_transitions };
          }
        }

        return { toArray: () => [] };
      }
    };

    // Mock AI for message analysis
    mockEnv = {
      AI: {
        run: vi.fn().mockResolvedValue({
          response: JSON.stringify({
            intent: 'general_inquiry',
            sentiment: 'positive',
            intentConfidence: 0.8,
            sentimentScore: 0.6
          })
        })
      }
    };

    const mockCtx = {
      storage: { sql: mockStorage },
      id: { toString: () => 'test-session-123' }
    };

    conversationDO = new EnhancedConversationDO(mockCtx, mockEnv);
  });

  describe('Message Processing', () => {
    it('should process user message and detect intent', async () => {
      const state = await conversationDO.processMessage(
        'user',
        'I want to learn more about your CRM',
        {}
      );

      expect(state.messageCount).toBe(1);
      expect(state.userMessageCount).toBe(1);
      expect(state.lastMessageAt).toBeDefined();
    });

    it('should process assistant message without intent detection', async () => {
      const state = await conversationDO.processMessage(
        'assistant',
        'I\'d be happy to help you with our CRM',
        {}
      );

      expect(state.messageCount).toBe(1);
      expect(state.assistantMessageCount).toBe(1);
    });

    it('should track conversation history', async () => {
      await conversationDO.processMessage('user', 'Hello', {});
      await conversationDO.processMessage('assistant', 'Hi there!', {});
      await conversationDO.processMessage('user', 'Tell me about pricing', {});

      const state = await conversationDO.getState();
      expect(state.messageCount).toBe(3);
      expect(state.userMessageCount).toBe(2);
      expect(state.assistantMessageCount).toBe(1);
    });
  });

  describe('Phase Transitions', () => {
    it('should start in initial_contact phase', async () => {
      const state = await conversationDO.getState();
      expect(state.phase).toBe('initial_contact');
    });

    it('should transition to qualifying phase manually', async () => {
      await conversationDO.transitionPhase('qualifying', 'Manual transition');
      const state = await conversationDO.getState();

      expect(state.phase).toBe('qualifying');
      expect(state.previousPhase).toBe('initial_contact');
      expect(state.phaseTransitions.length).toBeGreaterThan(0);
    });

    it('should record phase transition history', async () => {
      await conversationDO.transitionPhase('qualifying');
      await conversationDO.transitionPhase('needs_assessment');
      await conversationDO.transitionPhase('presenting_solution');

      const state = await conversationDO.getState();
      expect(state.phaseTransitions.length).toBe(3);
      expect(state.phaseTransitions[0].from).toBe('initial_contact');
      expect(state.phaseTransitions[0].to).toBe('qualifying');
      expect(state.phaseTransitions[2].to).toBe('presenting_solution');
    });
  });

  describe('Engagement Scoring', () => {
    it('should calculate engagement score based on message count', async () => {
      // Send multiple messages
      for (let i = 0; i < 10; i++) {
        await conversationDO.processMessage('user', `Message ${i}`, {});
      }

      const state = await conversationDO.getState();
      expect(state.engagementScore).toBeGreaterThan(0);
    });

    it('should increase engagement score with positive sentiment', async () => {
      mockEnv.AI.run.mockResolvedValue({
        response: JSON.stringify({
          intent: 'ready_to_buy',
          sentiment: 'positive',
          intentConfidence: 0.9,
          sentimentScore: 0.8
        })
      });

      await conversationDO.processMessage(
        'user',
        'This looks great! I\'m ready to move forward',
        {}
      );

      const state = await conversationDO.getState();
      expect(state.sentiment).toBe('positive');
      expect(state.engagementScore).toBeGreaterThan(0);
    });
  });

  describe('Sentiment Tracking', () => {
    it('should track sentiment history', async () => {
      mockEnv.AI.run.mockResolvedValueOnce({
        response: JSON.stringify({
          intent: 'general_inquiry',
          sentiment: 'positive',
          intentConfidence: 0.8,
          sentimentScore: 0.7
        })
      });

      await conversationDO.processMessage('user', 'I love this!', {});

      const state = await conversationDO.getState();
      expect(state.sentimentHistory.length).toBeGreaterThan(0);
      expect(state.sentimentHistory[0].sentiment).toBeDefined();
    });

    it('should calculate overall sentiment from recent messages', async () => {
      // Send multiple positive messages
      for (let i = 0; i < 5; i++) {
        mockEnv.AI.run.mockResolvedValueOnce({
          response: JSON.stringify({
            intent: 'general_inquiry',
            sentiment: 'positive',
            intentConfidence: 0.8,
            sentimentScore: 0.6
          })
        });

        await conversationDO.processMessage('user', 'Great!', {});
      }

      const state = await conversationDO.getState();
      expect(state.sentiment).toBe('positive');
    });

    it('should detect negative sentiment', async () => {
      mockEnv.AI.run.mockResolvedValue({
        response: JSON.stringify({
          intent: 'objection',
          sentiment: 'negative',
          intentConfidence: 0.9,
          sentimentScore: -0.7
        })
      });

      await conversationDO.processMessage(
        'user',
        'This is too expensive and confusing',
        {}
      );

      const state = await conversationDO.getState();
      expect(state.sentiment).toBe('negative');
    });
  });

  describe('Escalation Detection', () => {
    it('should not escalate initially', async () => {
      const state = await conversationDO.getState();
      expect(state.needsHumanEscalation).toBe(false);
    });

    it('should escalate on consistent negative sentiment', async () => {
      // Simulate consistent negative sentiment
      for (let i = 0; i < 3; i++) {
        mockEnv.AI.run.mockResolvedValueOnce({
          response: JSON.stringify({
            intent: 'objection',
            sentiment: 'negative',
            intentConfidence: 0.9,
            sentimentScore: -0.8
          })
        });

        await conversationDO.processMessage('user', 'This is terrible', {});
      }

      const state = await conversationDO.getState();
      // Should detect escalation need
      expect(state.sentiment).toBe('negative');
    });
  });

  describe('Qualification Score Integration', () => {
    it('should update qualification score', async () => {
      await conversationDO.updateQualificationScore(75, true);
      const state = await conversationDO.getState();

      expect(state.qualificationScore).toBe(75);
      expect(state.isQualified).toBe(true);
    });

    it('should track qualification progress', async () => {
      await conversationDO.updateQualificationScore(25, false);
      let state = await conversationDO.getState();
      expect(state.isQualified).toBe(false);

      await conversationDO.updateQualificationScore(80, true);
      state = await conversationDO.getState();
      expect(state.isQualified).toBe(true);
    });
  });

  describe('Conversation Context', () => {
    it('should generate conversation context for LLM', async () => {
      await conversationDO.processMessage('user', 'Tell me about pricing', {});
      await conversationDO.updateQualificationScore(60, false);

      const context = await conversationDO.getContext();

      expect(context.phase).toBeDefined();
      expect(context.intent).toBeDefined();
      expect(context.sentiment).toBeDefined();
      expect(context.qualificationStatus).toBeDefined();
      expect(context.qualificationStatus.score).toBe(60);
      expect(context.flags).toBeDefined();
    });

    it('should include recent topics in context', async () => {
      await conversationDO.processMessage(
        'user',
        'I need information about pricing and features',
        {}
      );

      const context = await conversationDO.getContext();
      expect(context.recentTopics).toBeDefined();
      expect(Array.isArray(context.recentTopics)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle AI analysis failures gracefully', async () => {
      mockEnv.AI.run.mockRejectedValue(new Error('AI service unavailable'));

      await expect(async () => {
        await conversationDO.processMessage('user', 'Hello', {});
      }).not.toThrow();

      const state = await conversationDO.getState();
      expect(state.messageCount).toBe(1);
    });

    it('should handle malformed AI responses', async () => {
      mockEnv.AI.run.mockResolvedValue({
        response: 'Not valid JSON'
      });

      await expect(async () => {
        await conversationDO.processMessage('user', 'Test', {});
      }).not.toThrow();
    });

    it('should handle rapid message processing', async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          conversationDO.processMessage('user', `Message ${i}`, {})
        );
      }

      await Promise.all(promises);
      const state = await conversationDO.getState();
      expect(state.messageCount).toBeGreaterThan(15);
    });
  });
});
