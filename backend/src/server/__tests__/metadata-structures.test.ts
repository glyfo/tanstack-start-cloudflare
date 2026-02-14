/**
 * Unit tests for metadata structures
 * These tests validate the TypeScript types and data structures
 * without requiring Cloudflare Workers runtime
 */

import { describe, it, expect } from 'vitest';
import type { Message, MessageMetadata, ToolCallInfo } from '../agents/chat-agent-types';

describe('Metadata Structures', () => {
  describe('MessageMetadata', () => {
    it('should have correct structure for complete metadata', () => {
      const metadata: MessageMetadata = {
        toolCalls: [
          {
            id: 'tool-1',
            name: 'createContact',
            status: 'success',
            startTime: 1000,
            endTime: 1050,
            duration: 50,
            input: { name: 'John', email: 'john@test.com' },
            output: { success: true, id: 'contact-123' },
          },
        ],
        summary: 'Created a new contact successfully.',
        processingTime: 250,
        modelUsed: '@cf/meta/llama-3-8b-instruct',
        tokensUsed: 892,
      };

      expect(metadata.toolCalls).toHaveLength(1);
      expect(metadata.summary).toBeTruthy();
      expect(metadata.processingTime).toBeGreaterThan(0);
      expect(metadata.modelUsed).toBeTruthy();
      expect(metadata.tokensUsed).toBeGreaterThan(0);
    });

    it('should allow optional fields', () => {
      const minimalMetadata: MessageMetadata = {
        processingTime: 100,
      };

      expect(minimalMetadata.processingTime).toBe(100);
      expect(minimalMetadata.summary).toBeUndefined();
      expect(minimalMetadata.toolCalls).toBeUndefined();
    });

    it('should handle empty metadata', () => {
      const emptyMetadata: MessageMetadata = {};

      expect(emptyMetadata.summary).toBeUndefined();
      expect(emptyMetadata.toolCalls).toBeUndefined();
      expect(emptyMetadata.processingTime).toBeUndefined();
    });
  });

  describe('ToolCallInfo', () => {
    it('should structure successful tool call', () => {
      const toolCall: ToolCallInfo = {
        id: 'tool-abc123',
        name: 'createContact',
        status: 'success',
        startTime: Date.now(),
        endTime: Date.now() + 50,
        duration: 50,
        input: { name: 'Alice', email: 'alice@test.com' },
        output: { success: true, contactId: 'c-456' },
      };

      expect(toolCall.id).toBeTruthy();
      expect(toolCall.name).toBe('createContact');
      expect(toolCall.status).toBe('success');
      expect(toolCall.duration).toBe(50);
      expect(toolCall.input).toHaveProperty('name');
      expect(toolCall.output).toHaveProperty('success');
    });

    it('should structure failed tool call', () => {
      const toolCall: ToolCallInfo = {
        id: 'tool-xyz789',
        name: 'deleteContact',
        status: 'error',
        startTime: Date.now(),
        endTime: Date.now() + 25,
        duration: 25,
        input: { contactId: 'invalid' },
        error: 'Contact not found',
      };

      expect(toolCall.status).toBe('error');
      expect(toolCall.error).toBe('Contact not found');
      expect(toolCall.duration).toBe(25);
    });

    it('should handle running tool call', () => {
      const toolCall: ToolCallInfo = {
        id: 'tool-running',
        name: 'searchContacts',
        status: 'running',
        startTime: Date.now(),
        input: { query: 'John' },
      };

      expect(toolCall.status).toBe('running');
      expect(toolCall.endTime).toBeUndefined();
      expect(toolCall.duration).toBeUndefined();
      expect(toolCall.output).toBeUndefined();
    });

    it('should allow all status types', () => {
      const statuses: Array<ToolCallInfo['status']> = ['pending', 'running', 'success', 'error'];

      statuses.forEach((status) => {
        const toolCall: ToolCallInfo = {
          id: `tool-${status}`,
          name: 'testTool',
          status,
          startTime: Date.now(),
        };

        expect(toolCall.status).toBe(status);
      });
    });
  });

  describe('Message with Metadata', () => {
    it('should create message with full metadata', () => {
      const message: Message = {
        id: 'msg-123',
        role: 'assistant',
        content: 'I created a contact for John Doe.',
        parts: [{ type: 'text', text: 'I created a contact for John Doe.' }],
        timestamp: Date.now(),
        metadata: {
          toolCalls: [
            {
              id: 'tool-1',
              name: 'createContact',
              status: 'success',
              startTime: 1000,
              endTime: 1050,
              duration: 50,
              input: { name: 'John Doe', email: 'john@test.com' },
              output: { success: true },
            },
          ],
          summary: 'I created a contact for John Doe.',
          processingTime: 450,
          modelUsed: '@cf/meta/llama-3-8b-instruct',
        },
      };

      expect(message.metadata).toBeDefined();
      expect(message.metadata?.toolCalls).toHaveLength(1);
      expect(message.metadata?.processingTime).toBe(450);
    });

    it('should create message without metadata', () => {
      const message: Message = {
        id: 'msg-456',
        role: 'user',
        content: 'Hello',
        parts: [{ type: 'text', text: 'Hello' }],
        timestamp: Date.now(),
      };

      expect(message.metadata).toBeUndefined();
    });
  });

  describe('Summary Generation Logic', () => {
    it('should extract first sentence from long text', () => {
      const longText = 'This is the first sentence. This is the second sentence. And this is the third sentence with more content.';

      const sentences = longText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;

      expect(summary).toBe('This is the first sentence.');
    });

    it('should handle text with question marks', () => {
      const text = 'What is your name? I need to know. Please tell me.';

      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;

      expect(summary).toBe('What is your name.');
    });

    it('should handle text with exclamation marks', () => {
      const text = 'Welcome! This is exciting. Let me help you.';

      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;

      expect(summary).toBe('Welcome.');
    });

    it('should handle text with no sentence terminators', () => {
      const text = 'This is a continuous text without proper punctuation';

      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const summary = sentences.length > 0 ? sentences[0].trim() + '.' : undefined;

      expect(summary).toBe('This is a continuous text without proper punctuation.');
    });
  });

  describe('Duration Calculation', () => {
    it('should calculate correct duration', () => {
      const startTime = 1000;
      const endTime = 1250;
      const duration = endTime - startTime;

      expect(duration).toBe(250);
    });

    it('should handle real timestamps', () => {
      const startTime = Date.now();
      // Simulate 50ms delay
      const endTime = startTime + 50;
      const duration = endTime - startTime;

      expect(duration).toBe(50);
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Tool Call Status Transitions', () => {
    it('should transition from pending to running to success', () => {
      const startTime = Date.now();

      // Initial state
      let toolCall: ToolCallInfo = {
        id: 'tool-1',
        name: 'testTool',
        status: 'pending',
        startTime,
        input: { test: 'data' },
      };

      expect(toolCall.status).toBe('pending');

      // Start running
      toolCall = { ...toolCall, status: 'running' };
      expect(toolCall.status).toBe('running');

      // Complete successfully
      const endTime = Date.now();
      toolCall = {
        ...toolCall,
        status: 'success',
        endTime,
        duration: endTime - startTime,
        output: { result: 'success' },
      };

      expect(toolCall.status).toBe('success');
      expect(toolCall.output).toBeDefined();
      expect(toolCall.duration).toBeGreaterThanOrEqual(0);
    });

    it('should transition from running to error', () => {
      const startTime = Date.now();

      let toolCall: ToolCallInfo = {
        id: 'tool-2',
        name: 'failingTool',
        status: 'running',
        startTime,
        input: { test: 'data' },
      };

      expect(toolCall.status).toBe('running');

      // Fail with error
      const endTime = Date.now();
      toolCall = {
        ...toolCall,
        status: 'error',
        endTime,
        duration: endTime - startTime,
        error: 'Tool execution failed',
      };

      expect(toolCall.status).toBe('error');
      expect(toolCall.error).toBeTruthy();
      expect(toolCall.output).toBeUndefined();
    });
  });
});
