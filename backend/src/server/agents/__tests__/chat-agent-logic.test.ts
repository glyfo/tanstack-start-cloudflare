import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentLogicService } from "../services/agent-logic-service";
import { IChatAgent } from "../interfaces/chat-agent.interface";
import { Connection } from "agents";

describe("AgentLogicService", () => {
  let logicService: AgentLogicService;
  let mockAgent: IChatAgent;
  let mockConnection: Connection;

  beforeEach(() => {
    logicService = new AgentLogicService();
    mockConnection = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    } as unknown as Connection;

    mockAgent = {
      stateMachine: {
        initialize: vi.fn(),
        transition: vi.fn(),
        updateProgress: vi.fn(),
        nextIteration: vi.fn().mockResolvedValue(true),
        complete: vi.fn(),
      } as any,
      env: {},
      name: "test-session",
      sql: vi.fn(),
      observe: vi.fn().mockResolvedValue({ context: "observed" }),
      think: vi.fn().mockResolvedValue({ action: "act", reasoning: "reasoning" }),
      act: vi.fn().mockResolvedValue({ success: true, result: "acted" }),
      learn: vi.fn().mockResolvedValue({}),
    };
  });

  it("should execute a single iteration successfully", async () => {
    await logicService.executeAgentLoop(mockAgent, mockConnection, "test goal");

    expect(mockAgent.stateMachine.initialize).toHaveBeenCalledWith("test goal", 10);
    expect(mockAgent.observe).toHaveBeenCalled();
    expect(mockAgent.think).toHaveBeenCalled();
    expect(mockAgent.act).toHaveBeenCalled();
    expect(mockAgent.learn).toHaveBeenCalled();
    expect(mockAgent.stateMachine.complete).toHaveBeenCalledWith(true, expect.objectContaining({ goal: "test goal" }));
  });

  it("should handle multi-iteration loop", async () => {
    // Mock act to fail first time, succeed second time
    mockAgent.act = vi.fn()
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });

    await logicService.executeAgentLoop(mockAgent, mockConnection, "test goal");

    expect(mockAgent.act).toHaveBeenCalledTimes(2);
    expect(mockAgent.stateMachine.nextIteration).toHaveBeenCalled();
    expect(mockAgent.stateMachine.complete).toHaveBeenCalledWith(true, expect.anything());
  });

  it("should stop when max iterations reached", async () => {
    // Mock act to always fail
    mockAgent.act = vi.fn().mockResolvedValue({ success: false });
    // Mock nextIteration to return false after 2 iterations
    (mockAgent.stateMachine.nextIteration as any)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await logicService.executeAgentLoop(mockAgent, mockConnection, "test goal", 2);

    expect(mockAgent.act).toHaveBeenCalled(); // Should affect number of calls based on loop logic
    // The implementation checks `canContinue` from `nextIteration`.
    // If nextIteration returns false, loop breaks.
    
    expect(mockAgent.stateMachine.complete).toHaveBeenCalledWith(true, expect.anything()); // It completes "successfully" as in finishes the loop, but maybe not goal achieved?
    // Wait, complete(true) logic in service:
    // await agent.stateMachine.complete(true, { goal, iterations: iteration });
    // It always calls complete(true) if loop finishes normally, even if goal not achieved?
    // Let's check implementation:
    // continueLoop = !goalAchieved && canContinue;
    // ... loop ends ...
    // await agent.stateMachine.complete(true, ...);
    
    // Yes, currently it marks as complete(true) which might be a logic flaw or intended "process complete".
    // Usually strict agent might mark comparison.
    // But for verification of CURRENT logic, this is correct to existing code.
  });

  it("should handle errors gracefully", async () => {
    mockAgent.observe = vi.fn().mockRejectedValue(new Error("Observation failed"));

    await logicService.executeAgentLoop(mockAgent, mockConnection, "test goal");

    expect(mockAgent.stateMachine.complete).toHaveBeenCalledWith(false, expect.objectContaining({ error: expect.stringContaining("Observation failed") }));
  });
});
