import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ChatAgentState, CardType } from "@/types/chat-agent";
import { buildBackendUrl, getBackendSocketConfig } from "@/lib/backend-url";
import ThinkingIndicator, { type StatusPhase } from "./ThinkingIndicator";
import MessageContent from "./MessageContent";
import { ContactCard } from "./ContactCard";
import { ContactList } from "./ContactList";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityList } from "./OpportunityList";
import { CreateContactCard } from "./CreateContactCard";
import { CreateOpportunityCard, type OpportunityFormData } from "./CreateOpportunityCard";
import { ContactSelectorCard } from "./ContactSelectorCard";
import { SuccessCard, SuccessNotification } from "./SuccessCard";
import { LeadSummaryCard } from "./LeadSummaryCard";
import { AnalyticsCard } from "./AnalyticsCard";
import { QualificationStatus } from "./QualificationStatus";
import { SettingsMenu } from "./SettingsMenu";

interface ToolCallInfo {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "error";
  startTime: number;
  endTime?: number;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
}

interface MessageMetadata {
  toolCalls?: ToolCallInfo[];
  summary?: string;
  processingTime?: number;
  modelUsed?: string;
  tokensUsed?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
  metadata?: MessageMetadata;
}

// Avatar removed per user request

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  source?: string;
  tags?: string[];
}

// Types for tool invocation results (MCP Apps pattern)
interface ToolInvokeResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface PendingToolInvoke {
  resolve: (result: ToolInvokeResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// Connection state type
type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

// Create a client-side only file for the actual chat engine
// This will be loaded dynamically to avoid SSR issues
function ChatEngineWithAgent({ sessionId, useAgent: useAgentHook }: { sessionId: string; useAgent: any }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusPhase, setStatusPhase] = useState<string | null>(null);
  const [statusTool, setStatusTool] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [maxConnectionsError, setMaxConnectionsError] = useState<{ message: string; maxConnections: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Agent state from onStateUpdate - used for state-driven card rendering
  const [agentState, setAgentState] = useState<ChatAgentState | null>(null);

  // Pending tool invocations (MCP Apps pattern)
  const pendingToolInvokes = useRef<Map<string, PendingToolInvoke>>(new Map());

  // Per-message response timeouts (replaces global window.__chatTimeout)
  const messageTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track pending message that was interrupted by disconnect
  const pendingMessageRef = useRef<{ id: string; content: string } | null>(null);

  // Track if we had a connection before (for reconnection detection)
  const hadConnectionRef = useRef(false);

  // Ref to hold the stable connection for use in callbacks (fixes stale closure)
  const connectionRef = useRef<any>(null);

  const connection = useAgentHook({
    agent: "ChatAgent",
    name: sessionId,
    ...getBackendSocketConfig(),
    // PartySocket reconnection options
    maxRetries: 10,                    // Max reconnection attempts
    minReconnectionDelay: 1000,        // Start with 1 second delay
    maxReconnectionDelay: 30000,       // Max 30 seconds between retries
    connectionTimeout: 10000,          // 10 second connection timeout
    onOpen: () => {
      console.log("═══════════════════════════════════════");
      console.log("[ChatEngine] ✅ WebSocket CONNECTED");
      console.log("[ChatEngine] Session ID:", sessionId);
      console.log("═══════════════════════════════════════");

      // Update connection state
      const wasReconnecting = hadConnectionRef.current;
      hadConnectionRef.current = true;
      setConnectionState("connected");
      setReconnectAttempt(0);

      // Request fresh messages (use ref to avoid stale closure)
      connectionRef.current?.send(JSON.stringify({ type: "get-messages" }));

      // If we were reconnecting and had a pending message, retry it
      if (wasReconnecting && pendingMessageRef.current) {
        console.log("[ChatEngine] 🔄 Retrying pending message after reconnect");
        const pending = pendingMessageRef.current;
        pendingMessageRef.current = null;

        // Small delay to ensure connection is stable
        setTimeout(() => {
          connectionRef.current?.send(
            JSON.stringify({
              type: "user-message",
              content: pending.content,
              id: pending.id,
            })
          );
        }, 100);
      }
    },
    onError: (error) => {
      console.log("═══════════════════════════════════════");
      console.error("[ChatEngine] ❌ WebSocket ERROR:", error);
      console.log("═══════════════════════════════════════");
    },
    onClose: (event) => {
      console.log("═══════════════════════════════════════");
      console.log("[ChatEngine] ❌ WebSocket CLOSED");
      console.log("[ChatEngine] Code:", event.code);
      console.log("[ChatEngine] Reason:", event.reason);
      console.log("═══════════════════════════════════════");

      // Update connection state
      // Don't reconnect if we were explicitly closed with a fatal error (like 1008 - Policy Violation, used for limits)
      const isFatalError = event.code === 1008;

      if (hadConnectionRef.current && !isFatalError) {
        setConnectionState("reconnecting");
        setReconnectAttempt((prev) => prev + 1);
      } else {
        setConnectionState("disconnected");
      }

      // Clear any pending thinking state to avoid stuck UI
      if (thinkingMessageId) {
        console.log("[ChatEngine] 🧹 Clearing thinking state on disconnect");
        setThinkingMessageId(null);
        setStatusPhase(null);
        setStatusTool(null);
        // Remove the thinking message from UI
        setMessages((prev) => prev.filter((m) => m.id !== thinkingMessageId));
      }

      // Clear streaming state
      if (isStreaming) {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }

      // Clear pending tool invocations
      for (const [id, pending] of pendingToolInvokes.current.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Connection lost"));
        pendingToolInvokes.current.delete(id);
      }
    },
    onMessage: (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
        console.log("═══════════════════════════════════════");
        console.log("[ChatEngine] 📨 RECEIVED:", message.type);
        console.log("[ChatEngine] Data:", message);
        console.log("═══════════════════════════════════════");
      } catch (error) {
        console.error("[ChatEngine] ❌ Failed to parse message:", error);
        console.error("[ChatEngine] Raw data:", event.data);
        return; // Skip malformed messages
      }

      // Handle tool execution request from server
      if (message.type === "tool-execute") {
        executeClientTool(message.executionId, message.tool, message.params);
        return;
      }

      if (message.type === "messages-list") {
        setMessages(message.messages || []);
      } else if (message.type === "history") {
        // Handle history response from server
        setMessages(message.messages || []);
      } else if (message.type === "message") {
        // Complete message from backend (user or assistant) - single source of truth
        if (message.message) {
          // Clear thinking indicator for assistant messages (replace thinking with actual response)
          if (message.message.role === "assistant" && thinkingMessageId) {
            setMessages((prev) => {
              // Replace thinking message with the actual response
              const newMsg = message.message;
              if (!newMsg || !newMsg.id) return prev;
              return prev.map(m => m.id === thinkingMessageId ? newMsg : m);
            });
            setThinkingMessageId(null);
            setStatusPhase(null);
            setStatusTool(null);
          } else {
            setMessages((prev) => {
              // Avoid duplicates
              const exists = prev.some(m => m.id === message.message.id);
              return exists ? prev : [...prev, message.message];
            });
          }
        }
      } else if (message.type === "messages-cleared") {
        setMessages([]);
        console.log("[ChatEngine] Message history cleared");
      } else if (message.type === "history_cleared") {
        setMessages([]);
        console.log("[ChatEngine] Message history cleared");
      } else if (message.type === "status") {
        // Update status phase for thinking indicator
        setStatusPhase(message.phase);
        setStatusTool(message.tool || null);
      } else if (message.type === "message-start") {
        setIsStreaming(true);
        setStreamingMessageId(message.messageId);

        // Keep thinking message visible, just prepare for streaming
        // Don't replace it yet - wait for first chunk
        if (!thinkingMessageId) {
          // No thinking message, add new message
          setMessages((prev) => [
            ...prev,
            {
              id: message.messageId,
              role: "assistant",
              content: "",
              parts: [{ type: "text", text: "" }],
              timestamp: Date.now(),
            },
          ]);
        }
      } else if (message.type === "message-chunk") {
        // Clear timeout when first chunk arrives (keyed by thinkingId or messageId)
        for (const key of [message.messageId, thinkingMessageId]) {
          if (key && messageTimeouts.current.has(key)) {
            clearTimeout(messageTimeouts.current.get(key));
            messageTimeouts.current.delete(key);
          }
        }
        // First chunk: replace thinking message if it exists
        if (thinkingMessageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingMessageId
                ? {
                  id: message.messageId,
                  role: "assistant",
                  content: message.chunk,
                  parts: [{ type: "text", text: message.chunk }],
                  timestamp: Date.now(),
                }
                : m
            )
          );
          setThinkingMessageId(null);
        } else {
          // Update existing message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.messageId
                ? {
                  ...m,
                  content: m.content + message.chunk,
                  parts: [{ type: "text", text: m.content + message.chunk }],
                }
                : m
            )
          );
        }
      } else if (message.type === "message-done") {
        // Clear any pending timeouts for this message
        for (const key of [message.messageId, thinkingMessageId]) {
          if (key && messageTimeouts.current.has(key)) {
            clearTimeout(messageTimeouts.current.get(key));
            messageTimeouts.current.delete(key);
          }
        }
        setIsStreaming(false);
        setStreamingMessageId(null);
        setStatusPhase(null);
        setStatusTool(null);

        // Clear pending message since we got a response
        pendingMessageRef.current = null;

        // Update or add the final message (includes complete content + metadata)
        if (message.message) {
          setMessages((prev) => {
            // If there's a thinking message, replace it with the actual response
            if (thinkingMessageId) {
              return prev.map(m =>
                m.id === thinkingMessageId ? message.message : m
              );
            }

            // Otherwise, find and update the streaming message or add new
            const existingIndex = prev.findIndex(m => m.id === message.message.id);
            if (existingIndex >= 0) {
              // Update existing streaming message with final version
              const updated = [...prev];
              updated[existingIndex] = message.message;
              return updated;
            }
            // Add as new message if not found
            return [...prev, message.message];
          });
        }
        // Always clear thinking message ID
        if (thinkingMessageId) {
          setThinkingMessageId(null);
        }
      } else if (message.type === "goal-complete") {
        setIsStreaming(false);
        setStreamingMessageId(null);
        // Add completion message
        const completionMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message.content || "Goal completed successfully.",
          parts: [{ type: "text", text: message.content || "Goal completed successfully." }],
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, completionMsg]);
      } else if (message.type === "thinking") {
        // Handle thinking message - just update status, don't modify message content
        // The thinking indicator is shown based on thinkingMessageId, not content
        console.log("[ChatEngine] Received thinking:", message.message);

        // Extract tool name from thinking message if present
        const toolMatch = message.message?.match(/Using\s+(\S+)/);
        if (toolMatch) {
          setStatusTool(toolMatch[1]);
          setStatusPhase("calling-tool");
        }

        // Only create thinking message if one doesn't exist
        if (!thinkingMessageId) {
          const newThinkingId = crypto.randomUUID();
          setThinkingMessageId(newThinkingId);
          setMessages((prev) => [
            ...prev,
            {
              id: newThinkingId,
              role: "assistant",
              content: "",
              parts: [{ type: "text", text: "" }],
              timestamp: Date.now(),
            },
          ]);
        }
        // Don't update content - ThinkingIndicator shows status instead
      } else if (message.type === "tool-invoke-result") {
        // Handle direct tool invocation result (MCP Apps pattern)
        console.log("[ChatEngine] Tool invoke result:", message);
        const pending = pendingToolInvokes.current.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingToolInvokes.current.delete(message.requestId);
          pending.resolve(message.result);
        }
        // Clear thinking state if exists
        if (thinkingMessageId) {
          setThinkingMessageId(null);
          setStatusPhase(null);
          setStatusTool(null);
        }
      } else if (message.type === "context-update-ack") {
        // Acknowledge context update received
        console.log("[ChatEngine] Context update acknowledged:", message);
      } else if (message.type === "session-reset") {
        // Handle session reset
        console.log("[ChatEngine] 🔄 Session reset received");
        setMessages([]);
        setAgentState(null);
        setStreamingMessageId(null);
        setThinkingMessageId(null);
        setIsStreaming(false);
        setStatusPhase(null);
        setStatusTool(null);
        // Clear any pending tool invocations
        for (const [id, pending] of pendingToolInvokes.current.entries()) {
          clearTimeout(pending.timeout);
          pendingToolInvokes.current.delete(id);
        }
        console.log("[ChatEngine] ✅ Session reset complete");
      } else if (message.type === "error") {
        // Clear timeout
        if ((window as any).__chatTimeout) {
          clearTimeout((window as any).__chatTimeout);
          (window as any).__chatTimeout = null;
        }
        console.error("Chat error:", message.message);
        setIsStreaming(false);
        setStreamingMessageId(null);
        setStatusPhase(null);
        setStatusTool(null);
        if (thinkingMessageId) {
          setMessages((prev) => prev.filter((m) => m.id !== thinkingMessageId));
          setThinkingMessageId(null);
        }

        // Show error message to user
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message.message || "An error occurred. Please try again.",
          parts: [{ type: "text", text: message.message || "An error occurred. Please try again." }],
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);

        // Specific handling for MAX_CONNECTIONS_EXCEEDED
        if (message.code === "MAX_CONNECTIONS_EXCEEDED") {
          console.warn("[ChatEngine] Connection limit exceeded");
          setMaxConnectionsError({
            message: message.message || "Maximum connections exceeded",
            maxConnections: message.maxConnections || 5
          });
          setConnectionState("disconnected"); // Ensure state reflects disconnection
        }
      } else {
        // Log unknown message types for debugging
        console.warn("[ChatEngine] Unknown message type:", message.type, message);
      }
    },
    // State-driven rendering: receive agent state updates
    onStateUpdate: (state: ChatAgentState, source: unknown) => {
      console.log("[ChatEngine] 🔄 Agent state update from:", source === "server" ? "server" : "client");
      console.log("[ChatEngine] Active card:", state?.ui?.activeCard?.type);
      setAgentState(state);
    },
  });

  // Update connection ref to avoid stale closures in callbacks
  connectionRef.current = connection;

  // Execute client-side tools
  const executeClientTool = (executionId: string, toolId: string, params: any) => {
    console.log('[ChatEngine] Executing client tool:', toolId, params);

    try {
      let result: any = {};

      switch (toolId) {
        case 'client.getTime': {
          const format = params.format || '12h';
          const now = new Date();
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

          result = {
            success: true,
            data: {
              localTime: now.toLocaleTimeString('en-US', {
                hour12: format === '12h',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }),
              timezone,
              utcTime: now.toISOString(),
              timestamp: now.getTime()
            },
            metadata: {
              executionTime: 0,
              source: 'client'
            }
          };
          break;
        }

        case 'client.getLocation': {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const locale = navigator.language;

          result = {
            success: true,
            data: {
              timezone,
              locale,
              timezoneName: new Intl.DateTimeFormat('en-US', {
                timeZoneName: 'long'
              }).format(new Date()).split(', ')[1] || timezone
            },
            metadata: {
              executionTime: 0,
              source: 'client'
            }
          };
          break;
        }

        case 'client.getDevice': {
          result = {
            success: true,
            data: {
              platform: navigator.platform,
              language: navigator.language,
              userAgent: navigator.userAgent
            },
            metadata: {
              executionTime: 0,
              source: 'client'
            }
          };
          break;
        }

        default:
          result = {
            success: false,
            error: `Unknown client tool: ${toolId}`,
            metadata: {
              executionTime: 0,
              source: 'client'
            }
          };
      }

      // Send result back to server (use ref to avoid stale closure)
      const toolResultPayload = JSON.stringify({
        type: 'tool-result',
        executionId,
        result
      });

      console.log('[ChatEngine] 📤 Sending tool-result:', { executionId, connectionExists: !!connectionRef.current });

      if (connectionRef.current) {
        try {
          connectionRef.current.send(toolResultPayload);
          console.log('[ChatEngine] ✅ Tool result sent successfully');
        } catch (sendErr) {
          console.error('[ChatEngine] ❌ Failed to send tool result:', sendErr);
        }
      } else {
        console.error('[ChatEngine] ❌ Cannot send tool result - connection is null!');
      }

    } catch (error) {
      console.error('[ChatEngine] Client tool error:', error);

      // Send error result (use ref to avoid stale closure)
      const errorPayload = JSON.stringify({
        type: 'tool-result',
        executionId,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            executionTime: 0,
            source: 'client'
          }
        }
      });

      console.log('[ChatEngine] 📤 Sending tool error result:', { executionId, connectionExists: !!connectionRef.current });

      if (connectionRef.current) {
        connectionRef.current.send(errorPayload);
      } else {
        console.error('[ChatEngine] ❌ Cannot send error result - connection is null!');
      }
    }
  };

  /**
   * Invoke a server tool directly (MCP Apps pattern)
   * Returns a promise that resolves with the tool result
   */
  const invokeTool = useCallback(async (
    toolId: string,
    params: Record<string, any>
  ): Promise<ToolInvokeResult> => {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        pendingToolInvokes.current.delete(requestId);
        reject(new Error(`Tool invocation timeout: ${toolId}`));
      }, 30000);

      // Store pending request
      pendingToolInvokes.current.set(requestId, {
        resolve,
        reject,
        timeout,
      });

      // Send tool invoke request (use ref to avoid stale closure)
      connectionRef.current?.send(JSON.stringify({
        type: "tool-invoke",
        requestId,
        tool: toolId,
        params,
      }));
    });
  }, []);

  /**
   * Update model context with form state or user interactions (MCP Apps pattern)
   */
  const updateContext = useCallback((context: {
    type: string;
    formId?: string;
    formState?: Record<string, any>;
    action?: string;
    metadata?: Record<string, any>;
  }) => {
    connectionRef.current?.send(JSON.stringify({
      type: "context-update",
      context,
    }));
  }, []);

  // ===========================================================================
  // STATE-DRIVEN RENDERING: RPC-based handlers using agent.call()
  // ===========================================================================

  /**
   * Call agent RPC method directly (state-driven pattern)
   * Falls back to invokeTool if RPC not available
   */
  const callAgentMethod = useCallback(async (method: string, params: unknown[]): Promise<unknown> => {
    // Try RPC call via connection if available
    if (connection && typeof (connection as any).call === 'function') {
      return (connection as any).call(method, params);
    }
    // Fallback to tool invocation for backward compatibility
    console.log(`[ChatEngine] RPC not available, falling back to invokeTool for ${method}`);
    return invokeTool(`server.${method}`, params[0] as Record<string, unknown>);
  }, [connection, invokeTool]);

  /**
   * Dismiss the active card via RPC
   */
  const dismissActiveCard = useCallback(async () => {
    console.log('[ChatEngine] dismissActiveCard called');
    try {
      console.log('[ChatEngine] Calling dismissCard RPC method');
      await callAgentMethod('dismissCard', []);
      console.log('[ChatEngine] dismissCard RPC completed');
    } catch (error) {
      console.error('[ChatEngine] Failed to dismiss card:', error);
    }
  }, [callAgentMethod]);

  // handleContactCreate and handleOpportunityCreate (defined below) are used for both
  // inline cards and state-driven cards — single unified path via RPC

  /**
   * Search contacts via RPC
   */
  const searchContactsRPC = useCallback(async (query: string): Promise<Array<{ id: string; name: string; email: string; company?: string }>> => {
    try {
      const result = await callAgentMethod('searchContacts', [{ query, limit: 10 }]) as { data?: { contacts?: Array<{ id: string; name: string; email: string; company?: string }> } };
      return result?.data?.contacts || [];
    } catch (error) {
      console.error('[ChatEngine] Search contacts error:', error);
      return [];
    }
  }, [callAgentMethod]);

  // Handler for contact selection from state-driven card
  const handleContactSelectedFromState = useCallback((contact: { contactId: string; contactName: string; contactEmail: string; company?: string }) => {
    console.log('[ChatEngine] Contact selected from state card:', contact);
    connectionRef.current?.send(JSON.stringify({
      type: "context-update",
      context: {
        type: "flow-update",
        flowId: "create-opportunity",
        stage: 1,
        status: "active",
        action: "contact-selected",
        collectedData: {
          contactId: contact.contactId,
          contactName: contact.contactName,
          contactEmail: contact.contactEmail,
          company: contact.company,
        },
      },
    }));
  }, []);

  // Handle contact form submission
  const handleContactCreate = useCallback(async (data: ContactFormData) => {
    console.log("[ChatEngine] ✅ handleContactCreate called with data:", data);
    console.log("[ChatEngine] Connection state:", {
      connectionExists: !!connection,
      connectionRefExists: !!connectionRef.current
    });

    setStatusPhase("creating");
    setStatusTool("createContact");

    try {
      console.log("[ChatEngine] Calling createContact RPC method");
      const result = await callAgentMethod('createContact', [{
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        source: data.source,
        tags: data.tags,
      }]);
      console.log("[ChatEngine] Contact creation result:", result);
    } catch (error) {
      console.error("[ChatEngine] Contact creation error:", error);
      setStatusPhase(null);
      setStatusTool(null);

      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to create contact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        parts: [{ type: "text", text: `Failed to create contact: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [callAgentMethod]);

  // Handle opportunity form submission
  const handleOpportunityCreate = useCallback(async (data: OpportunityFormData) => {
    console.log("[ChatEngine] Opportunity form submitted:", data);
    setStatusPhase("creating");
    setStatusTool("createOpportunity");

    try {
      const result = await callAgentMethod('createOpportunity', [{
        title: data.title,
        contactId: data.contactId,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        company: data.company,
        dealValue: data.dealValue,
        stage: data.stage,
        expectedCloseDate: data.expectedCloseDate,
        description: data.description,
        source: data.source,
      }]);
      console.log("[ChatEngine] Opportunity creation result:", result);
    } catch (error) {
      console.error("[ChatEngine] Opportunity creation error:", error);
      setStatusPhase(null);
      setStatusTool(null);

      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Failed to create opportunity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        parts: [{ type: "text", text: `Failed to create opportunity: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [callAgentMethod]);

  // Handle contact search
  const handleSearchContacts = useCallback(async (query: string): Promise<Array<{ id: string; name: string; email: string; company?: string }>> => {
    try {
      const result = await callAgentMethod('searchContacts', [{ query, limit: 10 }]) as { data?: { contacts?: Array<{ id: string; name: string; email: string; company?: string }> } };
      return result?.data?.contacts || [];
    } catch (error) {
      console.error('[ChatEngine] Search contacts error:', error);
      return [];
    }
  }, [callAgentMethod]);

  /**
   * Memoized card element from agent state (state-driven pattern)
   * Returns null if no active card or if card should be rendered inline in messages
   * Recalculates only when activeCard or its callback dependencies change
   */
  const stateCardElement = useMemo(() => {
    console.log('[ChatEngine] stateCardElement recalculating, agentState:', agentState);
    if (!agentState?.ui?.activeCard) {
      console.log('[ChatEngine] No active card in agent state');
      return null;
    }

    const { type, data } = agentState.ui.activeCard;
    const cardData = data as Record<string, unknown>;
    console.log('[ChatEngine] Rendering active card:', { type, data });

    switch (type as CardType) {
      case 'create-contact-form':
        return (
          <div className="my-4">
            <CreateContactCard
              initialData={cardData}
              onSubmit={handleContactCreate}
              onCancel={dismissActiveCard}
              onContextUpdate={updateContext}
            />
          </div>
        );

      case 'create-opportunity-form':
        return (
          <div className="my-4">
            <CreateOpportunityCard
              initialData={cardData}
              onSubmit={handleOpportunityCreate}
              onCancel={dismissActiveCard}
              onContextUpdate={updateContext}
              onSearchContacts={handleSearchContacts}
            />
          </div>
        );

      case 'contact-list':
        return (
          <div className="my-4">
            <ContactList contacts={(cardData.contacts as Array<{ id: string; name: string; email: string; phone?: string; company?: string; source?: string; tags?: string[] }>) || []} />
          </div>
        );

      case 'opportunity-list':
        return (
          <div className="my-4">
            <OpportunityList opportunities={(cardData.opportunities as Array<{ id: string; title: string; contactName?: string; company?: string; dealValue?: number; stage?: string }>) || []} />
          </div>
        );

      case 'contact-selector':
        return (
          <div className="my-4">
            <ContactSelectorCard
              onContactSelected={handleContactSelectedFromState}
              onSearch={searchContactsRPC}
              onContextUpdate={updateContext}
            />
          </div>
        );

      case 'success':
        return (
          <div className="my-4">
            <SuccessCard
              type={(cardData.entityType as 'contact' | 'opportunity' | 'lead') || 'contact'}
              action={(cardData.action as 'created' | 'updated' | 'deleted') || 'created'}
              title={cardData.message as string || 'Success'}
              subtitle={(cardData.entity as Record<string, unknown>)?.name as string}
              details={cardData.details as Array<{ label: string; value: string }> || []}
            />
          </div>
        );

      case 'notification':
        return (
          <div className="my-4">
            <SuccessNotification
              type={(cardData.type as 'success' | 'info' | 'warning') || 'success'}
              message={cardData.message as string || cardData.title as string || 'Success'}
            />
          </div>
        );

      case 'contact':
        return (
          <div className="my-4">
            <ContactCard
              contact={{
                name: cardData.name as string || '',
                email: cardData.email as string || '',
                company: cardData.company as string,
                phone: cardData.phone as string,
                source: cardData.source as string,
                tags: cardData.tags as string[],
                id: cardData.id as string,
              }}
              action={(cardData.action as 'view' | 'create' | 'update') || 'view'}
            />
          </div>
        );

      case 'opportunity':
        return (
          <div className="my-4">
            <OpportunityCard
              opportunity={{
                title: cardData.title as string || '',
                contactName: cardData.contactName as string,
                company: cardData.company as string,
                dealValue: cardData.dealValue as number,
                stage: cardData.stage as string,
                probability: cardData.probability as number,
                expectedCloseDate: cardData.expectedCloseDate as string,
                id: cardData.id as string,
              }}
              action={(cardData.action as 'view' | 'create' | 'update') || 'view'}
            />
          </div>
        );

      case 'lead-summary':
        return (
          <div className="my-4">
            <LeadSummaryCard
              lead={cardData as any}
            />
          </div>
        );

      case 'analytics':
        return (
          <div className="my-4">
            <AnalyticsCard
              data={cardData as any}
              title={cardData.title as string}
              period={cardData.period as string}
            />
          </div>
        );

      case 'qualification-status':
        return (
          <div className="my-4">
            <QualificationStatus
              data={cardData as any}
            />
          </div>
        );

      default:
        console.log('[ChatEngine] Unknown state card type:', type);
        return null;
    }
  }, [agentState?.ui?.activeCard, handleContactCreate, handleOpportunityCreate, dismissActiveCard, updateContext, handleSearchContacts, handleContactSelectedFromState, searchContactsRPC]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentState]);

  // Messages are loaded in onOpen callback - no need for separate useEffect

  // Session management functions - available for future use via agent commands
  // const clearHistory = () => {
  //   connectionRef.current?.send(JSON.stringify({ type: "clear-messages" }));
  // };

  const handleContactCancel = useCallback(() => {
    console.log("[ChatEngine] Contact form cancelled");
    // Update context to let model know form was cancelled
    updateContext({
      type: "form-cancelled",
      formId: "create-contact",
      action: "cancel",
    });
  }, [updateContext]);

  const handleOpportunityCancel = useCallback(() => {
    console.log("[ChatEngine] Opportunity form cancelled");
    // Update context to let model know form was cancelled
    updateContext({
      type: "form-cancelled",
      formId: "create-opportunity",
      action: "cancel",
    });
  }, [updateContext]);

  // Handle contact selection in conversational flow (e.g., when creating opportunity)
  const handleContactSelected = useCallback(async (contact: { contactId: string; contactName: string; contactEmail: string; company?: string }) => {
    console.log("[ChatEngine] Contact selected for flow:", contact);

    let finalContact = contact;

    // Check if this is a new contact that needs to be created first
    if (contact.contactId.startsWith('new-')) {
      console.log("[ChatEngine] Creating new contact first...");
      try {
        const result = await invokeTool("server.createContact", {
          name: contact.contactName,
          email: contact.contactEmail,
          company: contact.company || '',
        }) as { id?: string; contact?: { id: string } };

        // Get the real contact ID from the result
        const newId = result?.id || result?.contact?.id;
        if (newId) {
          finalContact = { ...contact, contactId: newId };
          console.log("[ChatEngine] Contact created with ID:", newId);
        } else {
          console.error("[ChatEngine] Failed to get contact ID from result:", result);
          return;
        }
      } catch (error) {
        console.error("[ChatEngine] Failed to create contact:", error);
        return;
      }
    }

    // Send flow update to advance to next stage
    if (connection) {
      connection.send(JSON.stringify({
        type: "context-update",
        context: {
          type: "flow-update",
          flowId: "create-opportunity",
          stage: 1,
          status: "active",
          action: "contact-selected",
          collectedData: {
            contactId: finalContact.contactId,
            contactName: finalContact.contactName,
            contactEmail: finalContact.contactEmail,
          },
        },
      }));

      // Also send a chat message to trigger the next step
      connection.send(JSON.stringify({
        type: "chat",
        content: `Selected contact: ${finalContact.contactName}`,
        messageId: crypto.randomUUID(),
      }));
    }
  }, [connection, invokeTool]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    // Don't allow sending while disconnected
    if (connectionState !== "connected") {
      console.warn("[ChatEngine] Cannot send message while disconnected");
      return;
    }

    const messageId = crypto.randomUUID();
    const userMessageContent = input.trim();

    console.log("═══════════════════════════════════════");
    console.log("[ChatEngine] 📤 SENDING MESSAGE");
    console.log("[ChatEngine] Content:", userMessageContent);
    console.log("[ChatEngine] Message ID:", messageId);
    console.log("═══════════════════════════════════════");

    // Store pending message in case connection drops
    pendingMessageRef.current = { id: messageId, content: userMessageContent };

    // Add user message immediately to UI for instant feedback
    const userMessage: Message = {
      id: messageId,
      role: "user",
      content: userMessageContent,
      parts: [{ type: "text", text: userMessageContent }],
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    console.log("[ChatEngine] ✅ User message added to UI");

    // Show thinking indicator for assistant response
    const thinkingId = crypto.randomUUID();
    setThinkingMessageId(thinkingId);
    setStatusPhase("thinking"); // Set initial status
    setStatusTool(null);
    setMessages((prev) => [
      ...prev,
      {
        id: thinkingId,
        role: "assistant",
        content: "",
        parts: [{ type: "text", text: "" }],
        timestamp: Date.now(),
      },
    ]);

    // Send to backend (use ref to avoid stale closure)
    connectionRef.current?.send(
      JSON.stringify({
        type: "user-message",
        content: userMessageContent,
        id: messageId,
      })
    );
    setInput("");

    // Per-message timeout to handle unresponsive server
    const assistantMsgId = thinkingId; // used as key until real messageId arrives
    const timeoutId = setTimeout(() => {
      console.warn("[ChatEngine] Response timeout for message:", assistantMsgId);
      messageTimeouts.current.delete(assistantMsgId);
      setThinkingMessageId((current) => {
        if (current === thinkingId) {
          setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "I'm having trouble responding right now. Please try again.",
              parts: [{ type: "text", text: "I'm having trouble responding right now. Please try again." }],
              timestamp: Date.now(),
            },
          ]);
          return null;
        }
        return current;
      });
    }, 30000);
    messageTimeouts.current.set(assistantMsgId, timeoutId);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F0]">
      {/* Connection status */}
      {connectionState === "reconnecting" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-amber-500 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-amber-700 text-sm font-medium">Reconnecting{reconnectAttempt > 1 ? ` (attempt ${reconnectAttempt})` : ''}...</span>
          </div>
        </div>
      )}
      {/* MAX_CONNECTIONS_EXCEEDED Error Banner */}
      {maxConnectionsError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">Too Many Open Connections</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                You have reached the maximum of {maxConnectionsError.maxConnections} concurrent connections. Please close other tabs or windows with SuperHuman open, then refresh this page to continue.
              </p>
            </div>
            <button
              onClick={() => setMaxConnectionsError(null)}
              className="shrink-0 p-1 text-amber-600 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors cursor-pointer"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {connectionState === "disconnected" && !maxConnectionsError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-red-700 text-sm font-medium">Connection lost</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 px-2.5 py-0.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm shrink-0 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-stone-900">SuperHuman</h1>
          </div>
          <div className="flex items-center gap-2 relative">
            <a
              href="/settings/connections"
              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="Connections"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </a>
            <SettingsMenu onResetSession={handleResetSession} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center max-w-2xl w-full">
              {/* Hero branding */}
              <div className="mb-10">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-stone-900 flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0l2.5 7.5L22 7l-5.5 5L19 19.5 12 15l-7 4.5L7.5 12 2 7l7.5.5L12 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-stone-900">
                  What can I help you with?
                </h2>
                <p className="text-stone-500 text-sm mt-2 max-w-md mx-auto">
                  Manage contacts, track deals, and connect your social channels. Just tell me what you need.
                </p>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => setInput("I want to remember someone new")}
                  className="group flex items-center gap-3 px-3.5 py-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Add contact</p>
                    <p className="text-[11px] text-stone-400 truncate">Save someone new</p>
                  </div>
                </button>

                <button
                  onClick={() => setInput("I have a potential sale to track")}
                  className="group flex items-center gap-3 px-3.5 py-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Track deal</p>
                    <p className="text-[11px] text-stone-400 truncate">New opportunity</p>
                  </div>
                </button>

                <button
                  onClick={() => setInput("Who do I know?")}
                  className="group flex items-center gap-3 px-3.5 py-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">My contacts</p>
                    <p className="text-[11px] text-stone-400 truncate">Browse saved</p>
                  </div>
                </button>

                <button
                  onClick={() => setInput("Show me my open deals")}
                  className="group flex items-center gap-3 px-3.5 py-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Pipeline</p>
                    <p className="text-[11px] text-stone-400 truncate">Open deals</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    window.location.href = buildBackendUrl(
                      `/api/oauth/gmail/start?redirect=${encodeURIComponent(window.location.href)}`
                    );
                  }}
                  className="group flex items-center gap-3 px-3.5 py-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Gmail</p>
                    <p className="text-[11px] text-stone-400 truncate">Connect email</p>
                  </div>
                </button>

                <a
                  href="/settings/connections"
                  className="group flex items-center gap-3 px-3.5 py-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">Connect</p>
                    <p className="text-[11px] text-stone-400 truncate">Social channels</p>
                  </div>
                </a>
              </div>

              <div className="mt-8 space-y-3">
                <p className="text-[11px] text-stone-400">
                  Or just type what's on your mind
                </p>

                {/* Quick Commands Hint */}
                <div className="flex items-center gap-2 text-[10px] text-stone-400">
                  <span className="font-medium">Quick commands:</span>
                  <code className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded font-mono">/reset</code>
                  <span className="text-stone-300">•</span>
                  <code className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded font-mono">/help</code>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={msg.role === "user" ? "flex justify-end" : "flex justify-start gap-2.5"}
              >
                {msg.role === "assistant" && (
                  <div className="max-w-[85%] min-w-0">
                    {msg.id === thinkingMessageId ? (
                      <ThinkingIndicator
                        phase={statusPhase as StatusPhase}
                        tool={statusTool}
                      />
                    ) : msg.content || msg.id === streamingMessageId ? (
                      <>
                        <div className="text-[15px] leading-relaxed text-stone-800 prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:text-stone-900 prose-headings:font-semibold prose-strong:text-stone-900">
                          <MessageContent
                            content={msg.parts?.[0]?.text || msg.content || ""}
                            onContactCreate={handleContactCreate}
                            onContactCancel={handleContactCancel}
                            onOpportunityCreate={handleOpportunityCreate}
                            onOpportunityCancel={handleOpportunityCancel}
                            onContextUpdate={updateContext}
                            onContactSelected={handleContactSelected}
                            onSearchContacts={handleSearchContacts}
                          />
                          {msg.id === streamingMessageId && (
                            <span className="inline-block w-0.5 h-5 ml-0.5 bg-stone-900 animate-pulse align-text-bottom" />
                          )}
                        </div>

                        {/* Metadata footer with tool badges */}
                        {msg.metadata && msg.content && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {msg.metadata.processingTime && (
                              <span className="text-[10px] text-stone-400 font-medium">{(msg.metadata.processingTime / 1000).toFixed(1)}s</span>
                            )}
                            {msg.metadata.toolCalls && msg.metadata.toolCalls.length > 0 && (
                              <>
                                {msg.metadata.toolCalls.filter(tc => tc.name).map((tc, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-[10px] text-stone-500 font-medium rounded">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384-3.19A.6.6 0 015.6 11.5h12.8a.6.6 0 01.436.48l-5.384 3.19a.6.6 0 01-.632 0z" />
                                    </svg>
                                    {tc.name.replace('server.', '')}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {msg.role === "user" && (
                  <div className="max-w-[75%]">
                    <div className="bg-stone-900 text-white text-[15px] leading-relaxed px-4 py-2.5 rounded-2xl rounded-br-md whitespace-pre-wrap">
                      {msg.parts?.[0]?.text || msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* State-driven card rendering */}
            {agentState?.ui?.activeCard && (
              <div className="flex justify-start">
                <div className="w-full">
                  {stateCardElement}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <div className="bg-[#F5F5F0] shrink-0 border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-end gap-3 bg-white border border-stone-300 rounded-2xl px-4 py-3 focus-within:border-stone-400 focus-within:shadow-md shadow-sm transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message SuperHuman... (try /help for commands)"
                disabled={isStreaming || connectionState !== "connected" || maxConnectionsError !== null}
                className="flex-1 bg-transparent focus:outline-none disabled:cursor-not-allowed text-[15px] resize-none placeholder:text-stone-400 leading-relaxed"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '24px',
                  maxHeight: '200px',
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming || connectionState !== "connected" || maxConnectionsError !== null}
                className="shrink-0 w-8 h-8 rounded-full bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-all active:scale-95"
                title="Send message (Enter)"
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-stone-400 text-center mt-2">
              SuperHuman can make mistakes. Double-check important info. <kbd className="px-1 py-0.5 text-[9px] font-semibold bg-stone-100 border border-stone-200 rounded">Enter</kbd> to send, <kbd className="px-1 py-0.5 text-[9px] font-semibold bg-stone-100 border border-stone-200 rounded">Shift+Enter</kbd> for new line.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that ensures client-side only rendering and loads useAgent dynamically
export function ModernChatEngine({ sessionId }: { sessionId: string }) {
  const [useAgentHook, setUseAgentHook] = useState<any>(null);

  useEffect(() => {
    // Dynamically import the agents library only on the client
    import('agents/react').then(module => {
      setUseAgentHook(() => module.useAgent);
    }).catch(err => {
      console.error('Failed to load agents library:', err);
    });
  }, []);

  if (!useAgentHook) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }

  return <ChatEngineWithAgent sessionId={sessionId} useAgent={useAgentHook} />;
}
