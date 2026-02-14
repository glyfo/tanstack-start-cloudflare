import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ToolExecutor } from "../tool-executor";
import type { Tool } from "../tool-registry";

// Mock dependencies
vi.mock("../tool-registry", () => ({
  getToolRegistry: vi.fn(() => ({
    getTools: vi.fn(() => []),
  })),
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    tool: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}));

interface MockConnection {
  id: string;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
}

function createMockConnection(): MockConnection {
  return {
    id: `conn-${Math.random().toString(36).slice(2)}`,
    send: vi.fn().mockImplementation(() => {}), // Make send() actually callable
    close: vi.fn(),
    readyState: 1,
  };
}

function createMockTool(id: string): Tool {
  return {
    id,
    name: id,
    description: "Test tool",
    execution: "client" as const,
    category: "test",
    parameters: {},
    returns: {},
  };
}

describe("ToolExecutor - Memory Leak Prevention", () => {
  let toolExecutor: ToolExecutor;
  let mockConnection: MockConnection;

  beforeEach(() => {
    vi.useFakeTimers();
    toolExecutor = new ToolExecutor();
    mockConnection = createMockConnection();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should cleanup after successful tool execution", async () => {
    const tool = createMockTool("test_tool");
    const toolCall = { params: { value: 42 } };

    // Start execution
    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    // Verify entry added
    expect(toolExecutor["pendingClientTools"].size).toBe(1);

    // Get the executionId from the mock send call
    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    const executionId = sentMessage.executionId;

    // Simulate successful response
    toolExecutor.handleClientToolResult(executionId, {
      success: true,
      data: { result: "success" },
    });

    await promise;

    // Verify cleanup
    expect(toolExecutor["pendingClientTools"].size).toBe(0);
  });

  it("should cleanup after tool execution error", async () => {
    const tool = createMockTool("test_tool");
    const toolCall = { params: {} };

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    expect(toolExecutor["pendingClientTools"].size).toBe(1);

    // Get the executionId from the mock send call
    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    const executionId = sentMessage.executionId;

    // Simulate error response
    toolExecutor.handleClientToolResult(executionId, {
      success: false,
      error: "Tool failed",
    });

    const result = await promise;
    expect(result).toEqual({
      success: false,
      error: "Tool failed",
    });

    // Verify cleanup
    expect(toolExecutor["pendingClientTools"].size).toBe(0);
  });

  it("should cleanup after timeout", async () => {
    const tool = createMockTool("test_tool");
    const toolCall = { params: {} };

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    expect(toolExecutor["pendingClientTools"].size).toBe(1);

    // Fast-forward past timeout (30 seconds)
    vi.advanceTimersByTime(31000);

    await expect(promise).rejects.toThrow("timeout");

    // Verify cleanup
    expect(toolExecutor["pendingClientTools"].size).toBe(0);
  });

  it("should cleanup on connection send failure", async () => {
    const tool = createMockTool("test_tool");
    const toolCall = { params: {} };

    // Make connection.send throw
    const failingConnection = createMockConnection();
    failingConnection.send = vi.fn().mockImplementation(() => {
      throw new Error("Connection closed");
    });

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      failingConnection as any
    );

    await expect(promise).rejects.toThrow();

    // Verify cleanup happened immediately
    expect(toolExecutor["pendingClientTools"].size).toBe(0);
  });

  it("should handle multiple concurrent executions", async () => {
    const executions = [
      {
        tool: createMockTool("tool1"),
        toolCall: { params: {} },
      },
      {
        tool: createMockTool("tool2"),
        toolCall: { params: {} },
      },
      {
        tool: createMockTool("tool3"),
        toolCall: { params: {} },
      },
    ];

    // Start all executions
    const promises = executions.map((exec) =>
      toolExecutor["executeOnClient"](
        exec.tool,
        exec.toolCall as any,
        mockConnection as any
      )
    );

    expect(toolExecutor["pendingClientTools"].size).toBe(3);

    // Get execution IDs from mock calls
    const executionIds = mockConnection.send.mock.calls.map((call) => {
      const msg = JSON.parse(call[0]);
      return msg.executionId;
    });

    // Complete them one by one
    toolExecutor.handleClientToolResult(executionIds[0], {
      success: true,
      data: {},
    });
    await promises[0];
    expect(toolExecutor["pendingClientTools"].size).toBe(2);

    toolExecutor.handleClientToolResult(executionIds[1], {
      success: true,
      data: {},
    });
    await promises[1];
    expect(toolExecutor["pendingClientTools"].size).toBe(1);

    toolExecutor.handleClientToolResult(executionIds[2], {
      success: true,
      data: {},
    });
    await promises[2];
    expect(toolExecutor["pendingClientTools"].size).toBe(0);
  });

  it("should not leak memory after 100 operations", async () => {
    const iterations = 100;
    const tool = createMockTool("test_tool");
    const toolCall = { params: {} };

    for (let i = 0; i < iterations; i++) {
      // Reset mock to track calls
      mockConnection.send.mockClear();

      const promise = toolExecutor["executeOnClient"](
        tool,
        toolCall as any,
        mockConnection as any
      );

      // Get the executionId from the mock send call
      const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
      const executionId = sentMessage.executionId;

      // Immediately resolve
      toolExecutor.handleClientToolResult(executionId, {
        success: true,
        data: {},
      });

      await promise;
    }

    // Verify no entries remain
    expect(toolExecutor["pendingClientTools"].size).toBe(0);
  });

  it("should clear timeout on successful completion", async () => {
    const tool = createMockTool("test_tool");
    const toolCall = { params: {} };
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    // Get the executionId from the mock send call
    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    const executionId = sentMessage.executionId;

    // Complete successfully
    toolExecutor.handleClientToolResult(executionId, {
      success: true,
      data: {},
    });

    await promise;

    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("should clear timeout on error", async () => {
    const tool = createMockTool("test_tool");
    const toolCall = { params: {} };
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    // Get the executionId from the mock send call
    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    const executionId = sentMessage.executionId;

    // Complete with error
    toolExecutor.handleClientToolResult(executionId, {
      success: false,
      error: "Failed",
    });

    const result = await promise;
    expect(result).toEqual({
      success: false,
      error: "Failed",
    });

    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe("ToolExecutor - Client Tool Execution", () => {
  let toolExecutor: ToolExecutor;
  let mockConnection: MockConnection;

  beforeEach(() => {
    toolExecutor = new ToolExecutor();
    mockConnection = createMockConnection();
  });

  it("should send tool-execute message to client", async () => {
    const tool = createMockTool("get_current_time");
    const toolCall = { params: { timezone: "UTC" } };

    // Don't await - we're just checking the message was sent
    toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    // Verify message sent
    expect(mockConnection.send).toHaveBeenCalledWith(
      expect.stringContaining("tool-execute")
    );

    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    expect(sentMessage).toMatchObject({
      type: "tool-execute",
      tool: tool.id,
      params: toolCall.params,
    });
    expect(sentMessage.executionId).toBeDefined();
  });

  it("should resolve with result on success", async () => {
    const tool = createMockTool("get_time");
    const toolCall = { params: {} };
    const expectedResult = { time: "10:30 AM" };

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    // Get the executionId from the mock send call
    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    const executionId = sentMessage.executionId;

    toolExecutor.handleClientToolResult(executionId, {
      success: true,
      data: expectedResult,
    });

    const result = await promise;
    expect(result).toEqual({
      success: true,
      data: expectedResult,
    });
  });

  it("should resolve with error on failure", async () => {
    const tool = createMockTool("failing_tool");
    const toolCall = { params: {} };

    const promise = toolExecutor["executeOnClient"](
      tool,
      toolCall as any,
      mockConnection as any
    );

    // Get the executionId from the mock send call
    const sentMessage = JSON.parse(mockConnection.send.mock.calls[0][0]);
    const executionId = sentMessage.executionId;

    toolExecutor.handleClientToolResult(executionId, {
      success: false,
      error: "Permission denied",
    });

    const result = await promise;
    expect(result).toEqual({
      success: false,
      error: "Permission denied",
    });
  });
});
