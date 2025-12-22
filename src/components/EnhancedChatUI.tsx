/**
 * Enhanced Chat UI Component
 * Based on shadcn/ui design patterns
 * Clean, minimal light aesthetic
 */

import React, { useState, useEffect, useRef } from "react";
import { Send, X, ChevronDown, Loader2, MessageCircle } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import { A2UIRenderer } from "./A2UIRenderer";
import { Button } from "./ui/shadcn/button";
import { Input } from "./ui/shadcn/input";
import { Card } from "./ui/shadcn/card";
import { Alert, AlertDescription } from "./ui/shadcn/alert";
import {
  Badge,
  EmptyState,
  Divider,
  StatusIndicator,
  colors,
  Typography,
} from "./ui";
import type { A2UIComponent } from "@/types/a2ui-schema";

// ============================================
// TYPES
// ============================================

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  a2uiComponents?: A2UIComponent[];
  routedTo?: string;
  status?: "sending" | "sent" | "error";
}

interface ChatProps {
  sessionId?: string;
  title?: string;
  description?: string;
}

// ============================================
// CONSTANTS
// ============================================

const TIPS = [
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
    title: "📢 Updates",
    description: "Recent activity, follow-ups, news",
    examples: ["What happened today", "Recent updates", "Upcoming events"],
  },
];

// ============================================
// COMPONENTS
// ============================================

/**
 * Message Bubble Component
 */
const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 animate-fadeIn`}
    >
      <div
        className={`max-w-md lg:max-w-xl ${
          isUser
            ? "bg-blue-600 text-white rounded-3xl rounded-tr-lg"
            : "bg-slate-100 text-slate-900 rounded-3xl rounded-tl-lg"
        } px-4 py-3 shadow-sm`}
      >
        {message.a2uiComponents ? (
          <A2UIRenderer components={message.a2uiComponents} />
        ) : (
          <div className={isUser ? "text-base" : ""}>
            <MarkdownMessage content={message.content} />
          </div>
        )}

        {message.routedTo && (
          <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
            <span className="text-xs opacity-75">Routed to {message.routedTo}</span>
            {message.status === "sending" && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Input Suggestions Component
 */
const InputSuggestions = ({ onSelect }: { onSelect: (text: string) => void }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {TIPS.map((tip) => (
        <Card
          key={tip.title}
          variant="outlined"
          hover
          className="cursor-pointer p-4"
          onClick={() => onSelect(tip.examples[0])}
        >
          <h4 className={`font-semibold mb-1 ${colors.text.primary}`}>
            {tip.title}
          </h4>
          <p className={`text-sm mb-3 ${colors.text.secondary}`}>
            {tip.description}
          </p>
          <div className="space-y-1.5">
            {tip.examples.map((example) => (
              <div
                key={example}
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors cursor-pointer pl-3 border-l-2 border-slate-200"
              >
                {example}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
};

/**
 * Chat Input Component
 */
const ChatInput = ({
  value,
  onChange,
  onSend,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex gap-3">
      <Input
        placeholder="Ask about your pipeline, deals, or team performance..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="flex-1"
      />
      <Button
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        size="md"
        isLoading={isLoading}
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
};

/**
 * Main Chat Component
 */
export function EnhancedChatUI({ sessionId, title, description }: ChatProps) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(
    sessionId || crypto.randomUUID()
  );

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ============================================
  // WEBSOCKET CONNECTION
  // ============================================

  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${window.location.host}/agents/ChatAgent/${currentSessionId}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("✅ WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "message") {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content || "",
          timestamp: Date.now(),
          a2uiComponents: data.a2uiComponents,
          routedTo: data.routedTo,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setShowSuggestions(false);
      }

      setIsLoading(false);
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setError("Connection error. Please try again.");
      setIsLoading(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("❌ WebSocket disconnected");
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [currentSessionId]);

  // ============================================
  // AUTO-SCROLL
  // ============================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSendMessage = () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: Date.now(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content: input }));
    }
  };

  const handleSuggestClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
    setCurrentSessionId(crypto.randomUUID());
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className={`border-b ${colors.border} bg-slate-50 px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={`font-semibold ${colors.text.primary}`}>
                {title || "Agent Assistant"}
              </h1>
              {description && (
                <p className={`text-sm ${colors.text.secondary}`}>{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusIndicator status={isConnected ? "online" : "offline"} />
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !showSuggestions && (
          <EmptyState
            icon="💬"
            title="Start a conversation"
            description="Ask about your sales pipeline, team performance, or anything else"
          />
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-slate-100 rounded-3xl rounded-tl-lg px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-streamBounce" />
                <div
                  className="w-2 h-2 bg-slate-400 rounded-full animate-streamBounce"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-2 h-2 bg-slate-400 rounded-full animate-streamBounce"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && showSuggestions && (
        <div className="px-6 py-4 border-t border-slate-200">
          <p className={`text-sm font-medium mb-4 ${colors.text.secondary}`}>
            What would you like to know?
          </p>
          <InputSuggestions onSelect={handleSuggestClick} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className={`border-t ${colors.border} bg-slate-50 px-6 py-4`}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export default EnhancedChatUI;
