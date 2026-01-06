import { Agent } from "agents";
import { AgentLoopState, LoopPhase, ChatAgentState } from "./types";

export class AgentStateMachine {
  constructor(
    private agent: Agent<any, ChatAgentState>,
    private maxIterations: number = 10
  ) {}

  async initialize(goal: string, maxIterations?: number): Promise<void> {
    await this.agent.setState({
      agentLoop: {
        phase: "observing",
        goal,
        iteration: 0,
        maxIterations: maxIterations || this.maxIterations,
        progress: 0,
        lastUpdate: Date.now(),
      },
    });
  }

  async transition(
    phase: LoopPhase,
    data?: Partial<AgentLoopState>
  ): Promise<void> {
    const current = this.agent.state.agentLoop;
    if (!current) throw new Error("Agent loop not initialized");

    await this.agent.setState({
      agentLoop: { ...current, phase, ...data, lastUpdate: Date.now() },
    });
  }

  async updateProgress(
    progress: number,
    currentAction?: string,
    reasoning?: string
  ): Promise<void> {
    const current = this.agent.state.agentLoop;
    if (!current) return;

    await this.agent.setState({
      agentLoop: {
        ...current,
        progress: Math.min(100, Math.max(0, progress)),
        currentAction,
        reasoning,
        lastUpdate: Date.now(),
      },
    });
  }

  async nextIteration(): Promise<boolean> {
    const current = this.agent.state.agentLoop;
    if (!current) return false;

    const next = current.iteration + 1;
    await this.agent.setState({
      agentLoop: {
        ...current,
        iteration: next,
        progress: (next / current.maxIterations) * 100,
        lastUpdate: Date.now(),
      },
    });

    return next < current.maxIterations;
  }

  async complete(success: boolean, result?: any): Promise<void> {
    await this.agent.setState({
      agentLoop: {
        phase: "idle",
        iteration: 0,
        maxIterations: this.maxIterations,
        progress: success ? 100 : 0,
        lastUpdate: Date.now(),
      },
      lastGoalResult: { success, result, completedAt: Date.now() },
    });
  }

  isActive(): boolean {
    if (!this.agent.state || !this.agent.state.agentLoop) {
      return false;
    }
    return this.agent.state.agentLoop.phase !== "idle";
  }

  getState(): AgentLoopState | undefined {
    return this.agent.state?.agentLoop;
  }
}
