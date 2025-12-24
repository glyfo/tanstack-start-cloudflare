import { useState, useCallback } from "react";
import type { ChatProps, ChatTip } from "@/types/chatflow-types";
import { useChatConnection } from "./hooks/useChatConnection";
import { useChatState } from "./hooks/useChatState";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ChatWelcome } from "./ChatWelcome";

const tips: ChatTip[] = [];

export function ChatEngine({ sessionId }: ChatProps) {
  console.log("[Chat] 🚀 COMPONENT INITIALIZING", { sessionId });

  const [input, setInput] = useState("");
  const [currentSessionId] = useState(sessionId || crypto.randomUUID());

  const {
    messages,
    isLoading,
    error,
    setIsLoading,
    setError,
    addMessage,
    clearMessages,
    messagesEndRef,
  } = useChatState();

  const { sendMessage, clearHistory } = useChatConnection(
    currentSessionId,
    addMessage,
    setError,
    setIsLoading
  );

  const sendChatMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const msgId = crypto.randomUUID().substring(0, 8);

      console.log(`[Chat:${msgId}] 📤 SENDING MESSAGE`, {
        timestamp: new Date().toISOString(),
        contentLen: content.length,
      });

      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        // Detect if this is a form field value or regular chat
        const lastAssistantMsg = [...messages]
          .reverse()
          .find((m) => m.role === "assistant");
        const isFormFlow =
          lastAssistantMsg?.content?.includes?.("(") &&
          lastAssistantMsg?.content?.includes?.("/");

        if (isFormFlow) {
          sendMessage("field_value", { value: content, id: msgId });
          console.log(`[Chat:${msgId}] ✅ FIELD VALUE SENT`);
        } else {
          sendMessage("chat", { content, id: msgId });
          console.log(`[Chat:${msgId}] ✅ CHAT MESSAGE SENT`);
        }
      } catch (e) {
        console.error(`[Chat:${msgId}] ❌ SEND ERROR`, {
          error: String(e),
        });
        setError(`Failed to send message: ${String(e)}`);
        setIsLoading(false);
      }
    },
    [isLoading, messages, sendMessage]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const content = input;
      setInput("");
      sendChatMessage(content);
    },
    [input, sendChatMessage]
  );

  const handleTipClick = useCallback(
    (example: string) => {
      console.log("[Chat] 🔘 TIP CLICKED:", example);
      sendChatMessage(example);
    },
    [sendChatMessage]
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    clearMessages();
  }, [clearHistory, clearMessages]);

  console.log("[Chat] 🎨 RENDERING", { messagesCount: messages.length, isLoading });

  const isWelcome =
    messages.length === 1 &&
    messages[0].content === "Connected to agent. How can I help you today?";

  return (
    <div className="flex h-screen flex-col bg-white">
      <ChatHeader title="SuperHuman" onClearHistory={handleClearHistory} />

      {isWelcome ? (
        <ChatWelcome tips={tips} onTipClick={handleTipClick} />
      ) : (
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          error={error}
          messagesEndRef={messagesEndRef}
        />
      )}

      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={setInput}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
