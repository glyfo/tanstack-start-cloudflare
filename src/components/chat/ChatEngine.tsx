/**
 * Simple Chat Engine - Back to Working Version
 * - Clean Tailwind styling (no CSS file needed)
 * - Works with Cloudflare Workers AI
 * - Message persistence via Durable Objects
 */

import { useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ModernChatEngine({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const agent = useAgent({
    agent: "ChatAgent",
    name: sessionId,
    onOpen: () => setIsConnected(true),
    onClose: () => setIsConnected(false),
    onError: () => setIsConnected(false)
  });

  const { messages, sendMessage, status, error, clearHistory } = useAgentChat({ agent });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === "streaming") return;

    try {
      await sendMessage({ role: "user", parts: [{ type: "text", text: input }] });
      setInput("");
    } catch (err) {
      console.error("Send failed:", err);
    }
  };

  const handleNewChat = async () => {
    await clearHistory();
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-linear-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg" role="img" aria-label="AI">✨</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">SuperHuman AI</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {!isConnected && (
            <div className="text-xs text-yellow-600 flex items-center gap-1.5 px-2 py-1 bg-yellow-50 rounded-md">
              <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full animate-pulse" aria-hidden="true"></span>
              <span>Connecting...</span>
            </div>
          )}
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors active:scale-95"
            aria-label="Start new chat"
          >
            ✨ New Chat
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6" role="main">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center py-12">
            <div className="mb-6">
              <div className="inline-flex w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-2xl items-center justify-center shadow-lg">
                <span className="text-4xl" role="img" aria-label="Robot">🤖</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">
              Welcome to SuperHuman AI
            </h2>
            <p className="text-lg text-gray-600">
              Intelligent CRM automation for sales, service, and support
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <article
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 shadow-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <span className="text-xl mr-2" role="img" aria-label="AI">🤖</span>
                  )}
                  {msg.parts.map((part, i) => {
                    if (part.type === "text") {
                      const text = (part as any).text;
                      return msg.role === "assistant" ? (
                        <div key={i} className="text-sm">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ inline, className, children, ...props }: any) => {
                                if (inline) {
                                  return (
                                    <code className="px-1.5 py-0.5 bg-gray-100 text-pink-600 rounded text-xs font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono my-2" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              a: ({ href, children }) => (
                                <a href={href} className="text-blue-600 hover:text-blue-700 underline" target="_blank" rel="noopener noreferrer">
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">{text}</span>
                      );
                    }
                    return null;
                  })}
                </div>
              </article>
            ))}

            {status === "streaming" && (
              <div className="flex justify-start" role="status" aria-live="polite">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label="AI">🤖</span>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                    <span className="sr-only">AI is typing</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200" role="alert">
          <div className="max-w-3xl mx-auto text-sm text-red-800 flex items-center gap-2">
            <span role="img" aria-label="Error">❌</span>
            <span>{error.message}</span>
          </div>
        </div>
      )}

      {/* Input Form */}
      <footer className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={status === "streaming" || !isConnected}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
            aria-label="Message input"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "streaming" || !isConnected}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            aria-label="Send message"
          >
            {status === "streaming" ? "⏳" : "Send"}
          </button>
        </form>
      </footer>
    </div>
  );
}


