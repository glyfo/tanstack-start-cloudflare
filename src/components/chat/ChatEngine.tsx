/**
 * Simple Chat Engine - Back to Working Version
 * - Clean Tailwind styling (no CSS file needed)
 * - Works with Cloudflare Workers AI
 * - Message persistence via Durable Objects
 */

import { useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ModernChatEngine({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = useAgent({
    agent: "ChatAgent",
    name: sessionId,
    onOpen: () => setIsConnected(true),
    onClose: () => setIsConnected(false),
    onError: () => setIsConnected(false)
  });

  const { messages, sendMessage, status, error, clearHistory } = useAgentChat({ agent });

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

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
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
            </svg>
          </div>
          <h1 className="text-sm font-medium text-gray-900">SuperHuman</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {!isConnected && (
            <div className="text-xs text-gray-500 flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" aria-hidden="true"></span>
              <span>Connecting...</span>
            </div>
          )}
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 text-xs bg-white hover:bg-gray-50 text-gray-700 rounded-md font-medium transition-colors border border-gray-200"
            aria-label="Start new chat"
          >
            New Chat
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6" role="main">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center py-20">
            <div className="mb-6">
              <div className="inline-flex w-12 h-12 bg-black rounded-lg items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">
              Welcome to SuperHuman
            </h2>
            <p className="text-sm text-gray-500">
              Intelligent CRM automation for sales, service, and support
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => (
              <article
                key={msg.id}
                className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                    </svg>
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-gray-100 text-gray-900"
                      : "bg-transparent text-gray-900"
                  }`}
                >
                  {msg.parts.map((part, i) => {
                    if (part.type === "text") {
                      const text = (part as any).text;
                      return msg.role === "assistant" ? (
                        <div key={i} className="text-[15px] leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ inline, className, children, ...props }: any) => {
                                if (inline) {
                                  return (
                                    <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <code className="block bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono my-3" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc ml-5 mb-4 space-y-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-5 mb-4 space-y-2">{children}</ol>,
                              strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
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
                        <span key={i} className="text-[15px] whitespace-pre-wrap leading-relaxed">{text}</span>
                      );
                    }
                    return null;
                  })}
                </div>
              </article>
            ))}

            {status === "streaming" && (
              <div className="flex gap-4 justify-start" role="status" aria-live="polite">
                <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                  </svg>
                </div>
                <div className="rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  </div>
                  <span className="sr-only">AI is typing</span>
                </div>
              </div>
            )}50 border-t border-red-200" role="alert">
          <div className="max-w-3xl mx-auto text-xs text-red-600 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <span>{error.message}</span>
          </div>
        </div>
      )}

      {/* Input Form - ChatGPT Style */}
      <footer className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-center bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message SuperHuman..."
              disabled={status === "streaming" || !isConnected}
              className="flex-1 px-4 py-3 bg-transparent focus:outline-none disabled:cursor-not-allowed text-[15px] text-gray-900 placeholder:text-gray-400"
              aria-label="Message input"
            />
            <button
              type="submit"
              disabled={!input.trim() || status === "streaming" || !isConnected}
              className="mr-2 p-2 rounded-lg bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </divame="flex-1 px-4 py-2.5 bg-[#2B2B2B] border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed text-sm text-white placeholder:text-gray-500"
            aria-label="Message input"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "streaming" || !isConnected}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}


