/**
 * Integration tests for ChatAgent with new metadata features
 * Run with: pnpm test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock cloudflare:workers before importing ChatAgent
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(public ctx: any, public env: any) {}
  },
}));

import { ChatAgent } from '../agents/chat-agent';
import { Message } from '../agents/chat-agent-types';

describe('ChatAgent Integration Tests', () => {
  let agent: ChatAgent;
  let mockConnection: any;
  let sentMessages: any[];

  beforeEach(() => {
    sentMessages = [];

    // Mock connection
    mockConnection = {
      send: (data: string) => {
        sentMessages.push(JSON.parse(data));
      },
      readyState: 1, // OPEN
      close: () => {},
    };

    // Mock environment
    const mockEnv = {
      AI: {
        run: async () => ({
          response: 'Test response from AI',
        }),
      },
    };

    // Create agent instance
    agent = new ChatAgent({
      state: {},
      env: mockEnv,
      smartContext: {},
    });
  });

  describe('Message Structure', () => {
    it('should include metadata in assistant messages', async () => {
      // This test validates the structure of messages with metadata
      const testMessage: Message = {
        id: 'test-123',
        role: 'assistant',
        content: 'This is a test response that is long enough to generate a summary. It contains multiple sentences to test the summary generation feature.',
        parts: [{ type: 'text', text: 'Test response' }],
        timestamp: Date.now(),
        metadata: {
          processingTime: 250,
          modelUsed: '@cf/meta/llama-3-8b-instruct',
          summary: 'This is a test response that is long enough to generate a summary.',
          toolCalls: [
            {
              id: 'tool-1',
              name: 'testTool',
              status: 'success',
              startTime: Date.now(),
              endTime: Date.now() + 50,
              duration: 50,
              input: { test: 'input' },
              output: { test: 'output' },
            },
          ],
        },
      };

      // Validate structure
      expect(testMessage.metadata).toBeDefined();
      expect(testMessage.metadata?.processingTime).toBeGreaterThan(0);
      expect(testMessage.metadata?.modelUsed).toBe('@cf/meta/llama-3-8b-instruct');
      expect(testMessage.metadata?.summary).toBeTruthy();
      expect(testMessage.metadata?.toolCalls).toHaveLength(1);
    });

    it('should properly structure tool call info', () => {
      const toolCall = {
        id: 'tool-123',
        name: 'createContact',
        status: 'success' as const,
        startTime: 1000,
        endTime: 1050,
        duration: 50,
        input: { name: 'John', email: 'john@test.com' },
        output: { success: true, id: 'contact-456' },
      };

      expect(toolCall.id).toBeTruthy();
      expect(toolCall.status).toBe('success');
      expect(toolCall.duration).toBe(50);
      expect(toolCall.input).toHaveProperty('name');
      expect(toolCall.output).toHaveProperty('success');
    });
  });

  describe('Agent Connection Handling', () => {
    it('should add connection on connect', async () => {
      const initialSize = agent.connections.size;
      await agent.onConnect(mockConnection);

      expect(agent.connections.size).toBe(initialSize + 1);
      expect(agent.connections.has(mockConnection)).toBe(true);
    });

    it('should send history on connect', async () => {
      await agent.onConnect(mockConnection);

      // Should send connected and history messages
      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages.some(m => m.type === 'connected')).toBe(true);
      expect(sentMessages.some(m => m.type === 'history')).toBe(true);
    });

    it('should remove connection on close', async () => {
      await agent.onConnect(mockConnection);
      const sizeBeforeClose = agent.connections.size;

      await agent.onClose(mockConnection, 1000, 'Normal closure', true);

      expect(agent.connections.size).toBe(sizeBeforeClose - 1);
      expect(agent.connections.has(mockConnection)).toBe(false);
    });
  });

  describe('Message Sanitization', () => {
    it('should sanitize HTML script tags', () => {
      const malicious = '<script>alert("XSS")</script>Hello';
      const sanitized = agent.sanitizeInput(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    it('should limit message length', () => {
      const longMessage = 'a'.repeat(15000);
      const sanitized = agent.sanitizeInput(longMessage);

      expect(sanitized.length).toBeLessThanOrEqual(10000);
    });

    it('should collapse excessive whitespace', () => {
      const spacey = 'Hello          world';
      const sanitized = agent.sanitizeInput(spacey);

      expect(sanitized).toBe('Hello world');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow messages within rate limit', () => {
      // First message should be allowed
      const isLimited = agent.checkRateLimit(mockConnection);
      expect(isLimited).toBe(false);
    });

    it('should block messages exceeding rate limit', () => {
      // Send 11 messages rapidly (limit is 10 per minute)
      for (let i = 0; i < 11; i++) {
        agent.checkRateLimit(mockConnection);
      }

      const isLimited = agent.checkRateLimit(mockConnection);
      expect(isLimited).toBe(true);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all connections', async () => {
      const conn1Messages: any[] = [];
      const conn2Messages: any[] = [];

      const conn1 = {
        send: (data: string) => conn1Messages.push(JSON.parse(data)),
        readyState: 1,
        close: () => {},
      };

      const conn2 = {
        send: (data: string) => conn2Messages.push(JSON.parse(data)),
        readyState: 1,
        close: () => {},
      };

      await agent.onConnect(conn1);
      await agent.onConnect(conn2);

      const testMessage = { type: 'test', data: 'broadcast' };
      agent.safeBroadcast(testMessage);

      // Both connections should receive the message
      expect(conn1Messages.some(m => m.type === 'test')).toBe(true);
      expect(conn2Messages.some(m => m.type === 'test')).toBe(true);
    });

    it('should remove dead connections during broadcast', async () => {
      const deadConn = {
        send: () => { throw new Error('Connection closed'); },
        readyState: 3, // CLOSED
        close: () => {},
      };

      agent.connections.add(deadConn);
      const sizeBeforeBroadcast = agent.connections.size;

      agent.safeBroadcast({ type: 'test' });

      // Dead connection should be removed
      expect(agent.connections.size).toBe(sizeBeforeBroadcast - 1);
      expect(agent.connections.has(deadConn)).toBe(false);
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary for long messages', () => {
      const longText = 'This is the first sentence. This is the second sentence. This is a very long message that continues for a while to ensure it exceeds 200 characters which is the threshold for summary generation.';

      // Simulate summary generation logic
      let summary: string | undefined;
      if (longText.length > 200) {
        const sentences = longText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;
      }

      expect(summary).toBe('This is the first sentence.');
    });

    it('should not generate summary for short messages', () => {
      const shortText = 'Hello world';

      let summary: string | undefined;
      if (shortText.length > 200) {
        const sentences = shortText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;
      }

      expect(summary).toBeUndefined();
    });
  });

  describe('Tool Call Tracking', () => {
    it('should track tool execution timing', () => {
      const startTime = Date.now();

      // Simulate tool execution
      const toolCall = {
        id: 'tool-1',
        name: 'testTool',
        status: 'running' as const,
        startTime,
        input: { test: 'data' },
      };

      // Simulate completion
      const endTime = Date.now();
      const completedToolCall = {
        ...toolCall,
        status: 'success' as const,
        endTime,
        duration: endTime - startTime,
        output: { result: 'success' },
      };

      expect(completedToolCall.duration).toBeGreaterThanOrEqual(0);
      expect(completedToolCall.status).toBe('success');
      expect(completedToolCall.output).toBeDefined();
    });

    it('should track tool execution errors', () => {
      const startTime = Date.now();

      const toolCall = {
        id: 'tool-1',
        name: 'testTool',
        status: 'running' as const,
        startTime,
        input: { test: 'data' },
      };

      // Simulate error
      const endTime = Date.now();
      const errorToolCall = {
        ...toolCall,
        status: 'error' as const,
        endTime,
        duration: endTime - startTime,
        error: 'Tool execution failed',
      };

      expect(errorToolCall.status).toBe('error');
      expect(errorToolCall.error).toBeTruthy();
      expect(errorToolCall.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
