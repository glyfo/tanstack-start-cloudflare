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
  console.log("[🎬 ChatEngine] COMPONENT INITIALIZING", { 
    sessionId: sessionId?.substring(0, 8),
    timestamp: new Date().toISOString(),
  });

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

      console.log(`[📤 ChatEngine:${msgId}] SENDING MESSAGE`, {
        timestamp: new Date().toISOString(),
        contentLen: content.length,
        contentPreview: content.substring(0, 100),
        isLoading,
        sessionId: currentSessionId.substring(0, 8),
      });

      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        // Add user message to chat immediately
        addMessage({
          id: msgId,
          role: "user",
          content: content,
          timestamp: Date.now(),
        });
        console.log(`[✅ ChatEngine:${msgId}] USER MESSAGE ADDED TO CHAT`, {
          contentLen: content.length,
          totalMessages: messages.length + 1,
        });

        // Detect if this is a form field value or regular chat
        const lastAssistantMsg = [...messages]
          .reverse()
          .find((m) => m.role === "assistant");
        const isFormFlow =
          lastAssistantMsg?.content?.includes?.("(") &&
          lastAssistantMsg?.content?.includes?.("/");

        console.log(`[🔍 ChatEngine:${msgId}] MESSAGE TYPE DETECTION`, {
          isFormFlow,
          lastAssistantMsgPreview: lastAssistantMsg?.content?.substring(0, 50),
        });

        if (isFormFlow) {
          console.log(`[📋 ChatEngine:${msgId}] SENDING FIELD_VALUE`);
          sendMessage("field_value", { value: content, id: msgId });
          console.log(`[✅ ChatEngine:${msgId}] FIELD_VALUE SENT`);
        } else {
          console.log(`[💬 ChatEngine:${msgId}] SENDING CHAT MESSAGE`);
          sendMessage("chat", { content, id: msgId });
          console.log(`[✅ ChatEngine:${msgId}] CHAT MESSAGE SENT`);
        }
      } catch (e) {
        console.error(`[❌ ChatEngine:${msgId}] SEND ERROR`, {
          error: String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
        setError(`Failed to send message: ${String(e)}`);
        setIsLoading(false);
      }
    },
    [isLoading, messages, sendMessage, addMessage, currentSessionId]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      const msgId = crypto.randomUUID().substring(0, 8);
      console.log(`[📝 ChatEngine:${msgId}] FORM SUBMIT HANDLER`, {
        inputLen: input.length,
        timestamp: new Date().toISOString(),
      });
      e.preventDefault();
      const content = input;
      setInput("");
      sendChatMessage(content);
    },
    [input, sendChatMessage]
  );

  const handleTipClick = useCallback(
    (example: string) => {
      const msgId = crypto.randomUUID().substring(0, 8);
      console.log(`[🔘 ChatEngine:${msgId}] TIP CLICKED`, { 
        example: example.substring(0, 50),
      });
      sendChatMessage(example);
    },
    [sendChatMessage]
  );

  const handleClearHistory = useCallback(() => {
    console.log("[🗑️  ChatEngine] CLEAR HISTORY REQUESTED", {
      currentMessageCount: messages.length,
      timestamp: new Date().toISOString(),
    });
    clearHistory();
    clearMessages();
  }, [clearHistory, clearMessages]);

  console.log("[🎨 ChatEngine] RENDERING", { 
    messagesCount: messages.length, 
    isLoading,
    hasError: !!error,
    isWelcomeScreen: messages.length === 0,
    firstMessage: messages[0]?.content?.substring(0, 50),
    timestamp: new Date().toISOString(),
  });

  const isWelcome = messages.length === 0;

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
