import { Agent } from "agents";
import { AgentLoopState, LoopPhase, ChatAgentState } from "./types";

export class AgentStateMachine {
  constructor(
    private agent: Agent<any, ChatAgentState>,
    private maxIterations: number = 10
  ) {}

  async initialize(goal: string, maxIterations?: number): Promise<void> {
    const iterations =
      typeof maxIterations === "number" ? maxIterations : this.maxIterations;
    if (typeof this.agent.setState === "function") {
      await this.agent.setState({
        ...this.agent.state,
        agentLoop: {
          phase: "observing",
          goal,
          iteration: 0,
          maxIterations: iterations,
          progress: 0,
          lastUpdate: Date.now(),
        },
      });
    } else {
      this.agent.state.agentLoop = {
        phase: "observing",
        goal,
        iteration: 0,
        maxIterations: iterations,
        progress: 0,
        lastUpdate: Date.now(),
      };
    }
  }

  async transition(
    phase: LoopPhase,
    data?: Partial<AgentLoopState>
  ): Promise<void> {
    const current = this.agent.state.agentLoop;
    if (!current) throw new Error("Agent loop not initialized");

    if (typeof this.agent.setState === "function") {
      await this.agent.setState({
        ...this.agent.state,
        agentLoop: { ...current, phase, ...data, lastUpdate: Date.now() },
      });
    } else {
      this.agent.state.agentLoop = {
        ...current,
        phase,
        ...data,
        lastUpdate: Date.now(),
      };
    }
    // Broadcast phase update
    if (typeof (this.agent as any).safeBroadcast === "function") {
      (this.agent as any).safeBroadcast({ type: "progress", phase, ...data });
    } else if (typeof (this.agent as any).broadcast === "function") {
      (this.agent as any).broadcast({ type: "progress", phase, ...data });
    }
  }

  async updateProgress(
    progress: number,
    currentAction?: string,
    reasoning?: string
  ): Promise<void> {
    const current = this.agent.state.agentLoop;
    if (!current) return;

    if (typeof this.agent.setState === "function") {
      await this.agent.setState({
        ...this.agent.state,
        agentLoop: {
          ...current,
          progress: Math.min(100, Math.max(0, progress)),
          currentAction,
          reasoning,
          lastUpdate: Date.now(),
        },
      });
    } else {
      this.agent.state.agentLoop = {
        ...current,
        progress: Math.min(100, Math.max(0, progress)),
        currentAction,
        reasoning,
        lastUpdate: Date.now(),
      };
    }
    // Broadcast progress update
    if (typeof (this.agent as any).safeBroadcast === "function") {
      (this.agent as any).safeBroadcast({
        type: "progress",
        progress,
        currentAction,
        reasoning,
      });
    } else if (typeof (this.agent as any).broadcast === "function") {
      (this.agent as any).broadcast({
        type: "progress",
        progress,
        currentAction,
        reasoning,
      });
    }
  }

  async nextIteration(): Promise<boolean> {
    const current = this.agent.state.agentLoop;
    if (!current) return false;

    const next = current.iteration + 1;
    if (typeof this.agent.setState === "function") {
      await this.agent.setState({
        ...this.agent.state,
        agentLoop: {
          ...current,
          iteration: next,
          progress: (next / current.maxIterations) * 100,
          lastUpdate: Date.now(),
        },
      });
    } else {
      this.agent.state.agentLoop = {
        ...current,
        iteration: next,
        progress: (next / current.maxIterations) * 100,
        lastUpdate: Date.now(),
      };
    }

    return next < current.maxIterations;
  }

  async complete(success: boolean, result?: any): Promise<void> {
    let iterations = this.maxIterations;
    if (!this.agent.state) {
      // If state is undefined, assign agentLoop using Object.assign (state is readonly)
      Object.assign(this.agent, { state: {} });
    }
    if (!this.agent.state.agentLoop) {
      // Defensive: initialize agentLoop if missing
      this.agent.state.agentLoop = {
        phase: "idle",
        iteration: 0,
        maxIterations: this.maxIterations,
        progress: 0,
        lastUpdate: Date.now(),
      };
    }
    iterations = this.agent.state.agentLoop.maxIterations || this.maxIterations;
    if (typeof this.agent.setState === "function") {
      await this.agent.setState({
        ...this.agent.state,
        agentLoop: {
          phase: "idle",
          iteration: 0,
          maxIterations: iterations,
          progress: success ? 100 : 0,
          lastUpdate: Date.now(),
        },
        lastGoalResult: { success, result, completedAt: Date.now() },
      });
    } else {
      this.agent.state.agentLoop = {
        phase: "idle",
        iteration: 0,
        maxIterations: iterations,
        progress: success ? 100 : 0,
        lastUpdate: Date.now(),
      };
      this.agent.state.lastGoalResult = {
        success,
        result,
        completedAt: Date.now(),
      };
    }
  }

  isActive(): boolean {
    if (!this.agent.state || !this.agent.state.agentLoop) {
      return false;
    }
    // Defensive: agentLoop may be undefined
    return this.agent.state.agentLoop?.phase !== "idle";
  }

  getState(): AgentLoopState | undefined {
    return this.agent.state?.agentLoop;
  }
}
