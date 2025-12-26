/**
 * Agent State Manager - Handle state initialization and persistence
 * Reduces 15+ lines from agent-chat.ts
 */

import { ChatState } from "@/types/chat-types";

export class StateManager {
  /**
   * Initialize or get existing state
   */
  static async initializeState(currentState: any): Promise<ChatState> {
    if (currentState?.sessionId) return currentState;

    return {
      sessionId: crypto.randomUUID(),
      userId: "",
      messages: [],
      context: {},
      lastUpdated: Date.now(),
    } as ChatState;
  }

  /**
   * Add message to state
   */
  static addMessage(
    state: ChatState,
    role: "user" | "agent" | "assistant",
    content: string
  ): void {
    state.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    state.lastUpdated = Date.now();
  }
}
