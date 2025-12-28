import { ChatState } from "@/types/chat-types";

export class StateManager {
  static async initializeState(currentState: any): Promise<ChatState> {
    return currentState?.sessionId
      ? currentState
      : ({
          sessionId: crypto.randomUUID(),
          userId: "",
          messages: [],
          context: {},
          lastUpdated: Date.now(),
        } as ChatState);
  }

  static addMessage(
    state: ChatState,
    role: "user" | "assistant",
    content: string
  ): void {
    state.messages.push({ role, content, timestamp: Date.now() });
    state.lastUpdated = Date.now();
  }
}
