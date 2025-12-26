import { useState, useCallback, useRef, useEffect } from "react";
import type { RenderedMessage } from "@/types/chatflow-types";

export function useChatState() {
  const [messages, setMessages] = useState<RenderedMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Connected to agent. How can I help you today?",
      timestamp: Date.now(),
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const addMessage = useCallback((message: RenderedMessage) => {
    console.log("[useChatState] Adding message", {
      id: message.id,
      role: message.role,
      contentLen: message.content?.length || 0,
    });

    setMessages((prev) => {
      // Check if message already exists - update for streaming
      const idx = prev.findIndex((m) => m.id === message.id);
      if (idx !== -1) {
        // Update existing message (for streaming chunks)
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          content: updated[idx].content + message.content,
        };
        console.log("[useChatState] Updated existing message", {
          id: message.id,
          newLen: updated[idx].content.length,
        });
        return updated;
      }

      // Add new message
      const newMessages = [...prev, message];
      console.log("[useChatState] Added new message", {
        id: message.id,
        totalMessages: newMessages.length,
      });
      return newMessages;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: "Connected to agent. How can I help you today?",
        timestamp: Date.now(),
      },
    ]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    setIsLoading,
    setError,
    addMessage,
    clearMessages,
    messagesEndRef,
  };
}
