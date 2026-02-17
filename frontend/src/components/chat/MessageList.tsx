/**
 * MessageList Component
 *
 * Renders the chat message list with user and assistant messages,
 * thinking indicators, streaming states, and active cards.
 */

import type { ChatAgentState } from "@/types/chat-agent";
import ThinkingIndicator, { type StatusPhase } from "./ThinkingIndicator";
import MessageContent from "./MessageContent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: Array<{ type: "text"; text: string }>;
  timestamp: number;
  metadata?: {
    toolCalls?: Array<{ name: string; [key: string]: any }>;
    processingTime?: number;
    [key: string]: any;
  };
}

interface MessageListProps {
  messages: Message[];
  thinkingMessageId: string | null;
  statusPhase: string | null;
  statusTool: string | null;
  streamingMessageId: string | null;
  agentState: ChatAgentState | null;
  stateCardElement: React.ReactNode;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  // Event handlers
  handleContactCreate: (data: any) => void;
  handleContactCancel: () => void;
  handleOpportunityCreate: (data: any) => void;
  handleOpportunityCancel: () => void;
  updateContext: (context: any) => void;
  handleContactSelected: (contact: any) => void;
  handleSearchContacts: (query: string) => Promise<any[]>;
}

export function MessageList({
  messages,
  thinkingMessageId,
  statusPhase,
  statusTool,
  streamingMessageId,
  agentState,
  stateCardElement,
  messagesEndRef,
  handleContactCreate,
  handleContactCancel,
  handleOpportunityCreate,
  handleOpportunityCancel,
  updateContext,
  handleContactSelected,
  handleSearchContacts,
}: MessageListProps) {
  return (
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
                        <span className="text-[10px] text-stone-400 font-medium">
                          {(msg.metadata.processingTime / 1000).toFixed(1)}s
                        </span>
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
  );
}
