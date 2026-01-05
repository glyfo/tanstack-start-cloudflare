/**
 * Agent State Machine
 * Tracks agent execution flow and emits events for UI feedback
 */

export type AgentState =
  | "IDLE"
  | "PROCESSING"
  | "TOOL_EXECUTION"
  | "STREAMING_RESPONSE"
  | "ERROR"
  | "COMPLETE";

export type EventType =
  | "MESSAGE_RECEIVED"
  | "INTENT_DETECTED"
  | "TOOL_SELECTED"
  | "TOOL_STARTED"
  | "TOOL_COMPLETED"
  | "TOOL_FAILED"
  | "RESPONSE_STARTED"
  | "RESPONSE_COMPLETED";

export interface StateTransition {
  from: AgentState;
  to: AgentState;
  event: AgentEvent;
  timestamp: number;
}

export interface AgentEvent {
  type: EventType;
  data?: any;
  timestamp: number;
}

export type StateEvent = StateTransition | AgentEvent;

export class AgentStateMachine {
  private state: AgentState = "IDLE";
  private history: StateEvent[] = [];
  private listeners: Array<(event: StateEvent) => void> = [];

  getCurrentState(): AgentState {
    return this.state;
  }

  transition(newState: AgentState, eventType: EventType, data?: any): void {
    const transition: StateTransition = {
      from: this.state,
      to: newState,
      event: {
        type: eventType,
        data,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.state = newState;
    this.history.push(transition);
    this.notifyListeners(transition);
  }

  emit(eventType: EventType, data?: any): void {
    const event: AgentEvent = {
      type: eventType,
      data,
      timestamp: Date.now(),
    };

    this.history.push(event);
    this.notifyListeners(event);
  }

  subscribe(fn: (event: StateEvent) => void): void {
    this.listeners.push(fn);
  }

  getHistory(): StateEvent[] {
    return [...this.history];
  }

  getStateAt(timestamp: number): AgentState | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      const entry = this.history[i];
      if ("from" in entry && entry.timestamp <= timestamp) {
        return entry.to;
      }
    }
    return "IDLE";
  }

  clearHistory(): void {
    this.history = [];
  }

  reset(): void {
    this.state = "IDLE";
    this.history = [];
  }

  private notifyListeners(event: StateEvent): void {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (error) {
        console.error("[StateMachine] Listener error:", error);
      }
    });
  }
}
