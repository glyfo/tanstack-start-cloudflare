import { useEffect, useRef, useState } from "react";
import type { RenderedMessage } from "@/types/chatflow-types";

interface WebSocketState {
  isConnected: boolean;
  error: string | null;
}

export function useChatConnection(
  sessionId: string,
  onMessageReceived: (message: RenderedMessage) => void,
  onError: (error: string) => void,
  onLoadingChange: (loading: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    error: null,
  });

  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${window.location.host}/agents/ChatAgent/${sessionId}`;
    const connectionId = crypto.randomUUID().substring(0, 8);
    const startTime = Date.now();

    console.log(`[Chat:${connectionId}] 🔗 WEBSOCKET CONNECTION INITIATED`, {
      timestamp: new Date().toISOString(),
      protocol: wsProtocol,
      host: window.location.host,
      sessionId,
      wsUrl,
      connectionId,
    });

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const duration = Date.now() - startTime;
      console.log(`[Chat:${connectionId}] ✅ WEBSOCKET CONNECTED`, {
        timestamp: new Date().toISOString(),
        duration,
        readyState: ws.readyState,
        extensions: ws.extensions,
        protocol: ws.protocol,
      });
      wsRef.current = ws;
      setState({ isConnected: true, error: null });
      onError("");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgTimestamp = Date.now() - startTime;
        const msgId = data.id || crypto.randomUUID().substring(0, 8);

        console.log(`[Chat:${msgId}] 📨 WEBSOCKET MESSAGE RECEIVED`, {
          timestamp: new Date().toISOString(),
          connectionDuration: msgTimestamp,
          type: data.type,
          dataSize: event.data.length,
          keys: Object.keys(data),
        });

        handleMessage(data, msgId, onMessageReceived, onLoadingChange);
      } catch (e) {
        console.error(`[Chat:${connectionId}] ❌ PARSE ERROR`, {
          error: String(e),
          rawData: event.data.substring(0, 200),
        });
      }
    };

    ws.onerror = (e: Event) => {
      const errorMsg =
        e instanceof ErrorEvent ? e.message : "WebSocket connection failed";
      const duration = Date.now() - startTime;

      console.error(`[Chat:${connectionId}] ❌ WEBSOCKET ERROR`, {
        timestamp: new Date().toISOString(),
        duration,
        errorMsg,
        readyState: ws.readyState,
        url: wsUrl,
      });

      const errorText = `Connection failed: ${errorMsg} (See console for troubleshooting)`;
      onError(errorText);
      setState({ isConnected: false, error: errorText });
    };

    ws.onclose = () => {
      const duration = Date.now() - startTime;
      console.log(`[Chat:${connectionId}] 🔌 WEBSOCKET CLOSED`, {
        timestamp: new Date().toISOString(),
        duration,
        code: (ws as any).code || "unknown",
        reason: (ws as any).reason || "no reason",
      });
      wsRef.current = null;
      setState({
        isConnected: false,
        error: "Disconnected - Attempting to reconnect...",
      });
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId, onMessageReceived, onError, onLoadingChange]);

  const sendMessage = (type: string, payload: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const msg = "WebSocket not connected";
      console.error("[useChatConnection] ❌ SEND FAILED", {
        readyState: wsRef.current?.readyState,
        type,
      });
      onError(msg);
      return false;
    }
    const msgId = payload.id || crypto.randomUUID().substring(0, 8);
    const payload_str = JSON.stringify({ type, ...payload });
    console.log(`[Chat:${msgId}] 📤 WEBSOCKET SEND`, {
      timestamp: new Date().toISOString(),
      type,
      payloadSize: payload_str.length,
      readyState: wsRef.current.readyState,
    });
    wsRef.current.send(payload_str);
    return true;
  };

  const clearHistory = () => {
    sendMessage("clear_history", {});
  };

  return {
    isConnected: state.isConnected,
    error: state.error,
    sendMessage,
    clearHistory,
    wsRef,
  };
}

function handleMessage(
  data: any,
  connectionId: string,
  onMessageReceived: (message: RenderedMessage) => void,
  onLoadingChange: (loading: boolean) => void
) {
  switch (data.type) {
    case "connected":
      console.log(`[Chat:${connectionId}] ✅ AGENT CONNECTED`, {
        sessionId: data.sessionId,
        userId: data.userId,
      });
      break;

    case "history":
      console.log(`[Chat:${connectionId}] 📖 HISTORY RECEIVED`, {
        count: data.messages?.length || 0,
      });
      data.messages?.forEach((m: any) => {
        onMessageReceived({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        });
      });
      break;

    case "message_added":
      console.log(`[Chat:${connectionId}] ✏️ MESSAGE ADDED`, {
        id: data.message.id,
        role: data.message.role,
      });
      // Turn off loading when we receive actual message
      if (data.message.role === "agent") {
        onLoadingChange(false);
      }
      onMessageReceived({
        id: data.message.id,
        role: data.message.role,
        content: data.message.content,
        timestamp: data.message.timestamp,
      });
      break;

    case "field_question":
      console.log(`[Chat:${connectionId}] ❓ FIELD QUESTION`);
      onMessageReceived({
        id: crypto.randomUUID(),
        role: "agent",
        content: data.prompt,
        timestamp: Date.now(),
      });
      onLoadingChange(false);
      break;

    case "field_error":
      console.log(`[Chat:${connectionId}] ⚠️ FIELD ERROR`);
      onMessageReceived({
        id: crypto.randomUUID(),
        role: "agent",
        content: `❌ ${data.error}`,
        timestamp: Date.now(),
      });
      onLoadingChange(false);
      break;

    case "field_valid":
      console.log(`[Chat:${connectionId}] ✅ FIELD VALID`);
      break;

    case "success":
      console.log(`[Chat:${connectionId}] 🎉 FLOW SUCCESS`);
      onMessageReceived({
        id: crypto.randomUUID(),
        role: "agent",
        content: data.message || `✅ ${data.action} completed!`,
        isSuccess: true,
        successData: data.data,
        timestamp: Date.now(),
      });
      onLoadingChange(false);
      break;

    case "flow_error":
      console.log(`[Chat:${connectionId}] ❌ FLOW ERROR`);
      onMessageReceived({
        id: crypto.randomUUID(),
        role: "agent",
        content: data.message,
        timestamp: Date.now(),
      });
      onLoadingChange(false);
      break;

    case "message_complete":
      console.log(`[Chat:${connectionId}] ✅ MESSAGE COMPLETE`);
      onLoadingChange(false);
      onMessageReceived({
        id: data.message.id,
        role: data.message.role || "agent",
        content: data.message.content || "",
        timestamp: data.message.timestamp || Date.now(),
      });
      break;

    case "progress":
      console.log(`[Chat:${connectionId}] 📊 PROGRESS`, {
        stage: data.stage,
        details: data.details,
      });

      // Only show loading for actual processing stages, not for "complete"
      if (data.stage !== "complete") {
        onLoadingChange(true);
      } else {
        onLoadingChange(false);
      }

      // Send progress message to UI only for non-complete stages
      if (data.stage !== "complete") {
        const progressMessages: { [key: string]: string } = {
          detecting_intent: "🔎 Analyzing your message...",
          executing_skill: "⚙️ Executing skill...",
          processing_message: "⏳ Processing your request...",
          routing_conversation: "💬 Routing to conversation...",
          fallback_conversation: "💬 Starting conversation...",
          executing_workflow: "🚀 Executing workflow...",
          executing_conversation: "💭 Generating response...",
          generating_response: "✍️ Composing response...",
        };
        const progressMsg =
          progressMessages[data.stage] || `Processing... (${data.stage})`;
        onMessageReceived({
          id: crypto.randomUUID(),
          role: "system",
          content: progressMsg,
          timestamp: data.timestamp || Date.now(),
          isProgress: true,
        });
      }
      break;

    case "processing":
      console.log(`[Chat:${connectionId}] 🔄 PROCESSING`, {
        isProcessing: data.isProcessing,
      });
      onLoadingChange(data.isProcessing);
      break;

    case "history_cleared":
      console.log(`[Chat:${connectionId}] 🗑️ HISTORY CLEARED`);
      break;

    case "wizard_open":
      console.log(`[Chat:${connectionId}] 🧙 WIZARD_OPEN EVENT`);
      if (data.wizardSteps && Array.isArray(data.wizardSteps)) {
        onMessageReceived({
          id: crypto.randomUUID(),
          role: "agent",
          content: "Please fill in the details below.",
          timestamp: Date.now(),
        });
        onLoadingChange(false);
      }
      break;

    case "error":
      console.error(`[Chat:${connectionId}] ❌ ERROR`, {
        error: data.error,
      });
      onLoadingChange(false);
      break;

    case "message_stream":
      console.log(`[Chat:${connectionId}] 📊 MESSAGE STREAM`);
      onMessageReceived({
        id: data.id,
        role: data.role || "agent",
        content: data.chunk || "",
        timestamp: Date.now(),
      });
      break;
  }
}
