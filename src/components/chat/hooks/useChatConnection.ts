import { useEffect, useRef, useCallback } from "react";
import type { RenderedMessage } from "@/types/chatflow-types";

const PROGRESS_MAP: Record<string, string> = {
  detecting_intent: "Analyzing",
  executing_skill: "Executing",
  processing_message: "Processing",
  routing_conversation: "Routing",
  fallback_conversation: "Starting",
  executing_workflow: "Running",
  executing_conversation: "Thinking",
  generating_response: "Composing",
};

const WS_CONFIG = { DELAY: 2000, MAX_ATTEMPTS: 5, BACKOFF: 1.5 };

function handleMessage(data: any, cb: any) {
  const { onMessage, onError, onLoading } = cb;

  if (
    ["welcome", "user_message", "agent_message", "skill_result"].includes(
      data.type
    )
  ) {
    onMessage(data);
  } else if (data.type === "progress") {
    data.status === "complete"
      ? onLoading(false)
      : onMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          type: "progress",
          content: PROGRESS_MAP[data.status] || "Processing",
          timestamp: Date.now(),
          isProgress: true,
        });
  } else if (data.type === "error") {
    onError(data.content || "An error occurred");
    onLoading(false);
  }
}

export function useChatConnection(
  sessionId: string,
  onMessage: (message: RenderedMessage) => void,
  onError: (error: string) => void,
  onLoading: (loading: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const attemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const cbRef = useRef({ onMessage, onError, onLoading });

  cbRef.current = { onMessage, onError, onLoading };

  const connect = useCallback(() => {
    if (!mountedRef.current || wsRef.current?.readyState === WebSocket.OPEN)
      return;

    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${
        location.host
      }/agents/ChatAgent/${sessionId}`
    );

    ws.onopen = () => {
      wsRef.current = ws;
      attemptsRef.current = 0;
      cbRef.current.onError("");
    };

    ws.onmessage = (e) => {
      try {
        handleMessage(JSON.parse(e.data), cbRef.current);
      } catch {
        cbRef.current.onError("Failed to parse message");
      }
    };

    ws.onerror = () => cbRef.current.onError("Connection failed");

    ws.onclose = () => {
      wsRef.current = null;
      if (mountedRef.current && attemptsRef.current < WS_CONFIG.MAX_ATTEMPTS) {
        const delay =
          WS_CONFIG.DELAY * Math.pow(WS_CONFIG.BACKOFF, attemptsRef.current++);
        timeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback(
    (type: string, payload: any = {}): boolean => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        cbRef.current.onError("Not connected");
        return false;
      }
      wsRef.current.send(JSON.stringify({ type, ...payload }));
      return true;
    },
    []
  );

  return {
    sendMessage,
    clearHistory: useCallback(
      () => sendMessage("clear_history"),
      [sendMessage]
    ),
  };
}
