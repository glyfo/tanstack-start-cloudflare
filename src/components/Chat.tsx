import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import { A2UIRenderer } from "./A2UIRenderer";
import type { A2UIComponent } from "@/types/a2ui-schema";

/**
 * TEXT-BASED WEBSOCKET CHAT COMPONENT
 * ===================================
 * 
 * No Server Functions - direct WebSocket connection to ChatAgent
 * Real-time bidirectional communication
 * Supports both markdown text and A2UI component tree rendering
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  a2uiComponents?: A2UIComponent[];
}


interface ChatProps {
  sessionId?: string;
}

const tips = [
  {
    title: "Revenue",
    description: "Pipeline, deals, opportunities",
    examples: ["Show my sales pipeline", "At-risk deals", "Close rate"],
  },
  {
    title: "Performance",
    description: "Team metrics, targets, growth",
    examples: ["Team performance", "Conversion metrics", "Weekly results"],
  },
  {
    title: "Priorities",
    description: "Tasks, deadlines, focus areas",
    examples: ["My priorities today", "Urgent tasks", "What's next"],
  },
  {
    title: "Updates",
    description: "Recent activity, follow-ups, news",
    examples: ["What happened today", "Recent updates", "Upcoming events"],
  },
];

export function Chat({ sessionId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Connected to agent. How can I help you today?",
      timestamp: Date.now(),
    },
  ]);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipsExpanded, setTipsExpanded] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(
    sessionId || crypto.randomUUID()
  );
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ============================================
  // WEBSOCKET CONNECTION
  // ============================================

  useEffect(() => {
    // Build WebSocket URL
    // Format: /agents/ChatAgent/{sessionId}
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${window.location.host}/agents/ChatAgent/${currentSessionId}`;
    const connectionId = crypto.randomUUID().substring(0, 8);
    const startTime = Date.now();

    console.log(`[Chat:${connectionId}] 🔗 WEBSOCKET CONNECTION INITIATED`, {
      timestamp: new Date().toISOString(),
      protocol: wsProtocol,
      host: window.location.host,
      sessionId: currentSessionId,
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
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgTimestamp = Date.now() - startTime;
        
        console.log(`[Chat:${connectionId}] 📨 MESSAGE RECEIVED`, {
          timestamp: new Date().toISOString(),
          duration: msgTimestamp,
          type: data.type,
          dataSize: event.data.length,
        });

        switch (data.type) {
          case "connected":
            console.log(`[Chat:${connectionId}] ✅ AGENT CONNECTED`, {
              sessionId: data.sessionId,
              userId: data.userId,
            });
            setCurrentSessionId(data.sessionId);
            break;

          case "history":
            console.log(`[Chat:${connectionId}] 📖 HISTORY RECEIVED`, {
              count: data.messages?.length || 0,
            });
            // Received conversation history
            setMessages(
              data.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              }))
            );
            break;

          case "message_added":
            console.log(`[Chat:${connectionId}] ✏️ MESSAGE ADDED`, {
              id: data.message.id,
              role: data.message.role,
              contentLen: data.message.content.length,
            });
            // User message added to agent
            setMessages((prev) => [
              ...prev,
              {
                id: data.message.id,
                role: data.message.role,
                content: data.message.content,
                timestamp: data.message.timestamp,
              },
            ]);
            break;

          case "message_complete":
            console.log(`[Chat:${connectionId}] ✅ MESSAGE COMPLETE`, {
              id: data.message.id,
              contentLen: data.message.content?.length || 0,
              preview: data.message.content?.substring?.(0, 100) || "EMPTY",
              isStructured: Array.isArray(data.message.content),
            });
            // Message already accumulated in message_stream events
            // Just mark as complete and stop loading indicator
            setIsLoading(false);
            
            // Ensure the final message is in state
            setMessages((prev) => {
              const exists = prev.some(m => m.id === data.message.id);
              if (!exists) {
                console.log(`[Chat:${connectionId}] ℹ️ Adding final message to state`);
                
                // Check if content is structured (array of schemas)
                const isStructured = Array.isArray(data.message.content) && 
                  data.message.content[0]?.type;
                
                return [...prev, {
                  id: data.message.id,
                  role: data.message.role || "assistant",
                  content: data.message.content || "",
                  timestamp: data.message.timestamp || Date.now(),
                  isStructured,
                }];
              }
              return prev;
            });
            break;

          case "history_cleared":
            console.log(`[Chat:${connectionId}] 🗑️ HISTORY CLEARED`);
            setMessages([]);
            break;

          case "error":
            console.error(`[Chat:${connectionId}] ❌ ERROR`, {
              error: data.error,
              details: data.details,
            });
            setError(data.error);
            setIsLoading(false);
            break;

          case "message_stream":
            console.log(`[Chat:${connectionId}] 📊 MESSAGE STREAM`, {
              id: data.id,
              chunkLen: data.chunk?.length || 0,
              chunk: data.chunk?.substring(0, 50) || "EMPTY",
              hasChunk: !!data.chunk,
            });
            // Accumulate streaming chunks into the message
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((m) => m.id === data.id);
              const chunkToAdd = data.chunk || "";
              
              if (idx !== -1) {
                // Update existing message with new chunk
                updated[idx] = {
                  ...updated[idx],
                  content: updated[idx].content + chunkToAdd,
                };
                console.log(
                  `[Chat:${connectionId}] ✏️ Updated existing message #${idx}: "${updated[idx].content.substring(0, 60)}..."`,
                  { totalLen: updated[idx].content.length }
                );
              } else {
                // Create new message with first chunk
                updated.push({
                  id: data.id,
                  role: data.role || "assistant",
                  content: chunkToAdd,
                  timestamp: Date.now(),
                });
                console.log(
                  `[Chat:${connectionId}] ✨ Created NEW message: "${chunkToAdd.substring(0, 60)}..."`,
                  { totalLen: updated.length }
                );
              }
              console.log(`[Chat:${connectionId}] 📈 Messages now:`, updated.map(m => ({ id: m.id, len: m.content.length })));
              return updated;
            });
            break;
        }
      } catch (e) {
        console.error(`[Chat:${connectionId}] ❌ PARSE ERROR`, {
          error: String(e),
          rawData: event.data.substring(0, 100),
        });
      }
    };

    ws.onerror = (e: Event) => {
      const errorMsg = e instanceof ErrorEvent 
        ? e.message 
        : "WebSocket connection failed";
      const duration = Date.now() - startTime;
      
      console.error(`[Chat:${connectionId}] ❌ WEBSOCKET ERROR`, {
        timestamp: new Date().toISOString(),
        duration,
        errorMsg,
        readyState: ws.readyState,
        url: wsUrl,
        event: {
          type: e.type,
          bubbles: e.bubbles,
          cancelable: e.cancelable,
        },
      });
      console.error(`[Chat:${connectionId}] 💡 TROUBLESHOOTING:`, {
        "1": "Check worker logs: wrangler tail",
        "2": "Verify CHAT_AGENT binding in wrangler.jsonc",
        "3": "Ensure agents framework is installed",
        "4": "Check that ChatAgent Durable Object is properly exported",
        "5": "Try /health endpoint first",
      });
      
      setError(`Connection failed: ${errorMsg} (See console for troubleshooting)`);
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
      setError("Disconnected - Attempting to reconnect...");
      // Auto-reconnect could go here
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [currentSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  // ============================================
  // MESSAGE SENDING
  // ============================================

  const sendMessage = async (content: string) => {
    if (!content.trim() || !wsRef.current || isLoading) return;

    const msgId = crypto.randomUUID().substring(0, 8);
    
    console.log(`[Chat:${msgId}] 📤 SENDING MESSAGE`, {
      timestamp: new Date().toISOString(),
      contentLen: content.length,
      wsState: wsRef.current?.readyState,
      wsStateDesc: wsRef.current?.readyState === WebSocket.OPEN ? "OPEN" : "NOT_OPEN",
    });

    setInput("");
    setIsLoading(true);
    setError(null);
    setTipsExpanded(false);

    // Send via WebSocket
    try {
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          content,
          id: msgId,
        })
      );
      console.log(`[Chat:${msgId}] ✅ MESSAGE SENT TO WEBSOCKET`);
    } catch (e) {
      console.error(`[Chat:${msgId}] ❌ SEND ERROR`, {
        error: String(e),
      });
      setError(`Failed to send message: ${String(e)}`);
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = input;
    setInput("");
    sendMessage(content);
  };

  const handleTipClick = (example: string) => {
    sendMessage(example);
  };

  const clearHistory = () => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "clear_history",
        })
      );
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Minimal Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">SuperHuman</h1>
        <button
          onClick={clearHistory}
          className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Clear history"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Initial State */}
          {messages.length === 1 && messages[0].content === "Connected to agent. How can I help you today?" && (
            <div className="text-center py-20">
              <h2 className="text-4xl font-bold text-slate-900 mb-2">SuperHuman</h2>
              <p className="text-slate-600 mb-12">What can I help you with?</p>
              
              {/* Quick suggestion buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                {tips.slice(0, 4).map((tip) => (
                  <button
                    key={tip.title}
                    onClick={() => handleTipClick(tip.examples[0])}
                    className="p-3 text-left border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all text-sm"
                  >
                    <div className="font-medium text-slate-900">{tip.title}</div>
                    <div className="text-xs text-slate-600 mt-1">{tip.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 1 && (
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-2xl px-4 py-3 max-w-xl"
                      : "max-w-2xl text-black"
                  }`}>
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="text-black">
                        {msg.a2uiComponents && msg.a2uiComponents.length > 0 ? (
                          <A2UIRenderer 
                            components={msg.a2uiComponents}
                            isLoading={isLoading && idx === messages.length - 1}
                          />
                        ) : (
                          <div className="prose prose-sm max-w-none prose-headings:text-black prose-p:text-black prose-strong:text-black prose-code:text-black prose-li:text-black">
                            <MarkdownMessage content={msg.content} />
                          </div>
                        )}
                      </div>
                    )}
                    {isLoading && idx === messages.length - 1 && msg.role === "assistant" && (
                      <div className="mt-2 flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full opacity-60"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full opacity-60"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full opacity-60"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-6 bg-white">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="Ask me anything..."
              className="flex-1 bg-slate-50 text-slate-900 rounded-lg px-4 py-3 border border-slate-200 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-200 placeholder-slate-500 text-sm transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg px-4 py-3 font-medium transition-colors disabled:cursor-not-allowed text-sm shrink-0"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
