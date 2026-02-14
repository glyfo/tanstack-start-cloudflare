/**
 * Comprehensive tests for ConversationStateDO
 *
 * Tests workflow state management, field extraction, validation,
 * and multi-turn conversation flows
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
// Mock cloudflare:workers before importing ConversationStateDO
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(public ctx: any, public env: any) {}
  },
}));
import { ConversationStateDO } from "../durable-objects/ConversationStateDO";

// Mock DurableObjectState
class MockDurableObjectState {
  public sqlData = {
    conversation_state: [] as any[],
    conversation_history: [] as any[],
  };

  sql = {
    exec: (query: string, ...params: any[]) => {
      // Simple mock SQL implementation
      const trimmedQuery = query.trim().toUpperCase();

      // CREATE TABLE
      if (trimmedQuery.startsWith("CREATE TABLE")) {
        return { toArray: () => [] };
      }

      // CREATE INDEX
      if (trimmedQuery.startsWith("CREATE INDEX")) {
        return { toArray: () => [] };
      }

      // INSERT INTO conversation_state
      if (trimmedQuery.includes("INSERT INTO CONVERSATION_STATE")) {
        this.sqlData.conversation_state.push({
          id: params[0] || "current",
          workflow_state: params[1] || "idle",
          partial_data: params[2] || "{}",
          missing_fields: params[3] || "[]",
          error_count: 0,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        });
        return { toArray: () => [] };
      }

      // INSERT INTO conversation_history
      if (trimmedQuery.includes("INSERT INTO CONVERSATION_HISTORY")) {
        this.sqlData.conversation_history.push({
          id: params[0],
          role: params[1],
          content: params[2],
          timestamp: Math.floor(Date.now() / 1000),
          metadata: params[3],
        });
        return { toArray: () => [] };
      }

      // SELECT FROM conversation_state
      if (
        trimmedQuery.includes("SELECT") &&
        trimmedQuery.includes("FROM CONVERSATION_STATE")
      ) {
        const state = this.sqlData.conversation_state.find(
          (s) => s.id === "current"
        );
        if (state) {
          // For SELECT ID, return just the id
          if (trimmedQuery.includes("SELECT ID")) {
            return { toArray: () => [{ id: state.id }] };
          }
          // For SELECT *, return full state
          return { toArray: () => [state] };
        }
        return { toArray: () => [] };
      }

      // SELECT FROM conversation_history
      if (trimmedQuery.includes("SELECT * FROM CONVERSATION_HISTORY")) {
        return {
          toArray: () => [...this.sqlData.conversation_history].reverse(),
        };
      }

      // COUNT FROM conversation_history
      if (
        trimmedQuery.includes("COUNT(*) AS COUNT FROM CONVERSATION_HISTORY")
      ) {
        return {
          toArray: () => [{ count: this.sqlData.conversation_history.length }],
        };
      }

      // UPDATE conversation_state reset (must check FIRST before other UPDATE handlers)
      if (
        trimmedQuery.includes("UPDATE CONVERSATION_STATE") &&
        trimmedQuery.includes("PARTIAL_DATA = '{}'") &&
        trimmedQuery.includes("MISSING_FIELDS = '[]'")
      ) {
        const state = this.sqlData.conversation_state.find(
          (s) => s.id === "current"
        );
        if (state) {
          state.workflow_state = "idle";
          state.partial_data = "{}";
          state.missing_fields = "[]";
          state.error_count = 0;
          state.updated_at = Math.floor(Date.now() / 1000);
        }
        return { toArray: () => [] };
      }

      // UPDATE conversation_state workflow_state (simple single-field update)
      if (
        trimmedQuery.includes("UPDATE CONVERSATION_STATE") &&
        trimmedQuery.includes("SET WORKFLOW_STATE = ?") &&
        !trimmedQuery.includes("PARTIAL_DATA")
      ) {
        const state = this.sqlData.conversation_state.find(
          (s) => s.id === "current"
        );
        if (state) {
          state.workflow_state = params[0];
          state.updated_at = Math.floor(Date.now() / 1000);
        }
        return { toArray: () => [] };
      }

      // UPDATE conversation_state partial_data
      if (
        trimmedQuery.includes("UPDATE CONVERSATION_STATE") &&
        trimmedQuery.includes("PARTIAL_DATA") &&
        !trimmedQuery.includes("MISSING_FIELDS = '[]'")
      ) {
        const state = this.sqlData.conversation_state.find(
          (s) => s.id === "current"
        );
        if (state) {
          state.partial_data = params[0];
          state.missing_fields = params[1];
          state.updated_at = Math.floor(Date.now() / 1000);
        }
        return { toArray: () => [] };
      }

      // UPDATE conversation_state error_count
      if (
        trimmedQuery.includes("UPDATE CONVERSATION_STATE") &&
        trimmedQuery.includes("ERROR_COUNT")
      ) {
        const state = this.sqlData.conversation_state.find(
          (s) => s.id === "current"
        );
        if (state) {
          state.error_count = (state.error_count || 0) + 1;
          state.updated_at = Math.floor(Date.now() / 1000);
        }
        return { toArray: () => [] };
      }

      return { toArray: () => [] };
    },
  };

  id = {
    toString: () => "test-conversation-id",
  };

  storage = {
    sql: this.sql,
  };
}

describe("ConversationStateDO", () => {
  let conversationState: ConversationStateDO;
  let mockState: MockDurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    mockState = new MockDurableObjectState();
    mockEnv = {};
    conversationState = new ConversationStateDO(mockState as any, mockEnv);
  });

  describe("Initialization", () => {
    it("should initialize with schema and default state", async () => {
      const state = await conversationState.getState();

      expect(state.workflowState).toBe("idle");
      expect(state.partialData).toEqual({});
      expect(state.missingFields).toEqual([]);
      expect(state.errorCount).toBe(0);
    });
  });

  describe("Field Extraction", () => {
    it("should extract email from message", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "My email is john.doe@example.com",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.email).toBe("john.doe@example.com");
    });

    it('should extract name from "my name is" pattern', async () => {
      await conversationState.processMessage({
        role: "user",
        content: "Hi, my name is John Doe",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.name).toBe("John Doe");
    });

    it("should extract name in collecting_name state", async () => {
      // First message to trigger collecting_name state
      await conversationState.processMessage({
        role: "user",
        content: "I want to create a contact",
        intent: "createContact",
      });

      // Second message with just the name
      await conversationState.processMessage({
        role: "user",
        content: "Jane Smith",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.name).toBe("Jane Smith");
    });

    it("should extract phone number", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "My phone is (555) 123-4567",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.phone).toBeDefined();
      // Phone regex may capture with or without parenthesis depending on format
      expect(state.partialData.phone).toContain("555");
      expect(state.partialData.phone).toContain("123");
      expect(state.partialData.phone).toContain("4567");
    });

    it('should extract company from "work at" pattern', async () => {
      await conversationState.processMessage({
        role: "user",
        content: "I work at Acme Corp",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.company).toBe("Acme Corp");
    });

    it("should infer company from email domain", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "john.doe@acmecorp.com",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.company).toBe("Acmecorp");
    });

    it("should not infer company from common email providers", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "john.doe@gmail.com",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.partialData.company).toBeUndefined();
    });
  });

  describe("Workflow State Transitions", () => {
    it("should transition from idle to collecting_name when no fields provided", async () => {
      const result = await conversationState.processMessage({
        role: "user",
        content: "I want to create a contact",
        intent: "createContact",
      });

      expect(result.state).toBe("collecting_name");
      expect(result.shouldExecuteTool).toBe(false);
    });

    it("should transition to collecting_email after name is provided", async () => {
      // Provide name only (no email inference possible)
      await conversationState.processMessage({
        role: "user",
        content: "John Doe",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      expect(state.workflowState).toBe("collecting_email");
    });

    it("should transition to ready after email is provided (auto-infers company)", async () => {
      // Provide name and email - email domain will auto-infer company
      await conversationState.processMessage({
        role: "user",
        content: "My name is John Doe and email is john@example.com",
        intent: "createContact",
      });

      const state = await conversationState.getState();
      // Email domain infers company = "Example", so we go straight to ready
      expect(state.workflowState).toBe("ready");
      expect(state.partialData.company).toBe("Example");
    });

    it("should transition to ready when all required fields are collected", async () => {
      // Provide all fields
      await conversationState.processMessage({
        role: "user",
        content: "Name: John Doe, Email: john@example.com, Company: Acme",
        intent: "createContact",
      });

      const result = await conversationState.processMessage({
        role: "user",
        content: "Acme Corp",
        intent: "createContact",
      });

      expect(result.state).toBe("ready");
      expect(result.shouldExecuteTool).toBe(true);
    });
  });

  describe("Tool Execution Control", () => {
    it("should not allow tool execution when fields are missing", async () => {
      const result = await conversationState.processMessage({
        role: "user",
        content: "Create contact for john@example.com",
        intent: "createContact",
      });

      expect(result.shouldExecuteTool).toBe(false);
      expect(result.missingFields).toContain("name");
    });

    it("should allow tool execution when all required fields are present", async () => {
      // Provide all required fields
      await conversationState.processMessage({
        role: "user",
        content: "My name is John Doe and email is john@example.com",
        intent: "createContact",
      });

      // Set company manually
      const state = mockState.sqlData.conversation_state.find(
        (s) => s.id === "current"
      );
      if (state) {
        state.partial_data = JSON.stringify({
          name: "John Doe",
          email: "john@example.com",
          company: "Acme",
        });
      }

      const result = await conversationState.processMessage({
        role: "user",
        content: "Please create the contact",
        intent: "createContact",
      });

      expect(result.shouldExecuteTool).toBe(true);
    });

    it("should generate helpful prompt when fields are missing", async () => {
      const result = await conversationState.processMessage({
        role: "user",
        content: "Create a contact",
        intent: "createContact",
      });

      expect(result.promptForUser).toBeDefined();
      expect(result.promptForUser).toContain("name");
    });
  });

  describe("Conversation History", () => {
    it("should save messages to history", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "Hello",
        intent: "createContact",
      });

      await conversationState.processMessage({
        role: "assistant",
        content: "Hi there",
      });

      const history = await conversationState.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].role).toBe("user");
      expect(history[1].role).toBe("assistant");
    });

    it("should retrieve history in chronological order", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "First message",
      });

      await conversationState.processMessage({
        role: "user",
        content: "Second message",
      });

      const history = await conversationState.getHistory();
      expect(history[0].content).toBe("First message");
      expect(history[1].content).toBe("Second message");
    });
  });

  describe("Validation", () => {
    it("should validate contact data and return errors for missing fields", async () => {
      const validation = await conversationState.validateContactData();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Name must be at least 2 characters");
      expect(validation.errors).toContain("Valid email is required");
    });

    it("should validate successfully when all fields are present", async () => {
      // Manually set valid data
      const state = mockState.sqlData.conversation_state.find(
        (s) => s.id === "current"
      );
      if (state) {
        state.partial_data = JSON.stringify({
          name: "John Doe",
          email: "john@example.com",
        });
      }

      const validation = await conversationState.validateContactData();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe("Tool Execution Lifecycle", () => {
    it("should mark execution as started", async () => {
      await conversationState.startToolExecution();

      const state = await conversationState.getState();
      expect(state.workflowState).toBe("executing");
    });

    it("should mark execution as completed on success", async () => {
      await conversationState.startToolExecution();
      await conversationState.completeToolExecution(true);

      const state = await conversationState.getState();
      // After completion, state should be reset to idle
      expect(state.workflowState).toBe("idle");
      expect(state.partialData).toEqual({});
    });

    it("should mark execution as error on failure", async () => {
      await conversationState.startToolExecution();
      await conversationState.completeToolExecution(false);

      const state = await conversationState.getState();
      expect(state.workflowState).toBe("error");
      expect(state.errorCount).toBeGreaterThan(0);
    });
  });

  describe("State Reset", () => {
    it("should reset state for new workflow", async () => {
      // Set some data
      await conversationState.processMessage({
        role: "user",
        content: "John Doe john@example.com",
        intent: "createContact",
      });

      // Reset
      await conversationState.reset();

      const state = await conversationState.getState();
      expect(state.workflowState).toBe("idle");
      expect(state.partialData).toEqual({});
      expect(state.missingFields).toEqual([]);
      expect(state.errorCount).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should return conversation statistics", async () => {
      await conversationState.processMessage({
        role: "user",
        content: "Hello",
      });

      await conversationState.processMessage({
        role: "assistant",
        content: "Hi",
      });

      const stats = await conversationState.getStats();
      expect(stats.messageCount).toBe(2);
      // After processing messages, state will be collecting_name (no fields extracted from "Hi" or "OK")
      expect(stats.state).toBe("collecting_name");
    });
  });

  describe("Multi-turn Workflow", () => {
    it("should handle complete contact creation flow", async () => {
      // Step 1: User expresses intent
      let result = await conversationState.processMessage({
        role: "user",
        content: "I want to create a contact",
        intent: "createContact",
      });

      expect(result.shouldExecuteTool).toBe(false);
      expect(result.state).toBe("collecting_name");
      expect(result.promptForUser).toContain("name");

      // Step 2: User provides name
      result = await conversationState.processMessage({
        role: "user",
        content: "John Doe",
        intent: "createContact",
      });

      expect(result.shouldExecuteTool).toBe(false);
      expect(result.state).toBe("collecting_email");

      // Step 3: User provides email (will auto-infer company from domain)
      result = await conversationState.processMessage({
        role: "user",
        content: "john.doe@example.com",
        intent: "createContact",
      });

      // Email domain infers company = "Example", so should execute tool
      expect(result.shouldExecuteTool).toBe(true);
      expect(result.state).toBe("ready");
      expect(result.partialData.name).toBe("John Doe");
      expect(result.partialData.email).toBe("john.doe@example.com");
      expect(result.partialData.company).toBe("Example");
    });

    it("should handle all-in-one message with complete data", async () => {
      const result = await conversationState.processMessage({
        role: "user",
        content:
          "Create contact: My name is Jane Smith, email jane@company.com, I work at Tech Corp",
        intent: "createContact",
      });

      expect(result.shouldExecuteTool).toBe(true);
      expect(result.partialData.name).toBe("Jane Smith");
      expect(result.partialData.email).toBe("jane@company.com");
      expect(result.partialData.company).toBe("Tech Corp");
    });
  });
});
