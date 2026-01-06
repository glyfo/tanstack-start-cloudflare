import { useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
}

export function ModernChatEngine({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const connection = useAgent({
    agent: "ChatAgent",
    name: sessionId,
    onMessage: (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "messages-list") {
        setMessages(message.messages);
      } else if (message.type === "message-start") {
        setIsStreaming(true);
        setStreamingMessageId(message.messageId);
        
        // Replace thinking message with real streaming message
        if (thinkingMessageId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingMessageId
                ? {
                    id: message.messageId,
                    role: "assistant",
                    content: "",
                    parts: [{ type: "text", text: "" }],
                    timestamp: Date.now(),
                  }
                : m
            )
          );
          setThinkingMessageId(null);
        } else {
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
      } else if (message.type === "message-done") {
        setIsStreaming(false);
        setStreamingMessageId(null);
      } else if (message.type === "error") {
        console.error("Chat error:", message.message);
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    onOpen: () => {
      connection.send(JSON.stringify({ type: "get-messages" }));
    },
    onClose: () => console.log("Connection closed"),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      parts: [{ type: "text", text: input.trim() }],
      timestamp: Date.now(),
    };

    // Add user message
    setMessages((prev) => [...prev, userMessage]);
    
    // Add temporary thinking message
    const thinkingId = crypto.randomUUID();
    setThinkingMessageId(thinkingId);
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

    connection.send(
      JSON.stringify({
        type: "user-message",
        content: input.trim(),
      })
    );
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="border-b border-gray-200 bg-white shrink-0 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">SuperHuman</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center max-w-2xl">
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">
                How can I help you today?
              </h2>
              <p className="text-base text-gray-600">
                I'm your AI assistant, ready to help with business operations, data analysis, and more.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {msg.role === "assistant" && (
                  <div className="flex gap-4 max-w-3xl">
                    <div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-black">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-[15px] leading-relaxed text-gray-900 prose prose-sm max-w-none">
                      {msg.id === thinkingMessageId ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <span>Thinking</span>
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </div>
                      ) : (
                        <>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.parts[0]?.text}
                          </ReactMarkdown>
                          {msg.id === streamingMessageId && (
                            <span className="inline-block w-0.5 h-5 ml-1 bg-blue-500 animate-pulse" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {msg.role === "user" && (
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-[70%]">
                    <div className="text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                      {msg.parts[0]?.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <div className="bg-white shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-center gap-3 bg-white border border-gray-300 rounded-[26px] px-4 py-3 focus-within:border-gray-400 shadow-sm hover:shadow-md transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message SuperHuman..."
                disabled={isStreaming}
                className="flex-1 bg-transparent focus:outline-none disabled:cursor-not-allowed text-[15px] resize-none max-h-[200px] placeholder:text-gray-500"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '24px',
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="shrink-0 w-8 h-8 rounded-full bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-all"
                title="Send message (Enter)"
              >
                <svg 
                  className="w-4 h-4 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3 px-2">
              SuperHuman can make mistakes. Please double-check responses. Press <kbd className="px-1 py-0.5 text-[10px] font-semibold bg-gray-100 border border-gray-300 rounded">Enter</kbd> to send.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
