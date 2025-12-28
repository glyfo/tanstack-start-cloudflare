import { useState, useCallback, useRef, useLayoutEffect } from "react";
import type { RenderedMessage } from "@/types/chatflow-types";

export function useChatState() {
  const [messages, setMessages] = useState<RenderedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Optimization 1: useLayoutEffect for synchronous scroll (prevents visual jump)
  // Optimization 2: Depend on messages.length instead of full array (better performance)
  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const addMessage = useCallback((message: RenderedMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null); // Also clear error when clearing messages
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
