import { MessageRenderer } from "./ChatRenderer";
import type { RenderedMessage } from "@/types/chatflow-types";

interface ChatMessagesProps {
  messages: RenderedMessage[];
  isLoading: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessages({
  messages,
  isLoading,
  error,
  messagesEndRef,
}: ChatMessagesProps) {
  console.log("[🎨 ChatMessages] RENDERING", {
    totalMessages: messages.length,
    isLoading,
    hasError: !!error,
    firstMsg: messages[0]
      ? {
          role: messages[0].role,
          contentLen: messages[0].content?.length,
          preview: messages[0].content?.substring(0, 50),
        }
      : null,
    lastMsg: messages[messages.length - 1]
      ? {
          role: messages[messages.length - 1].role,
          contentLen: messages[messages.length - 1].content?.length,
          preview: messages[messages.length - 1].content?.substring(0, 50),
        }
      : null,
  });

  // Filter out progress messages from regular display
  const displayMessages = messages.filter((msg) => !msg.isProgress);

  console.log("[🎨 ChatMessages] DISPLAY MESSAGES", {
    displayCount: displayMessages.length,
    filteredOutProgress: messages.length - displayMessages.length,
    willRender: displayMessages.length >= 1,
  });
  
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Messages */}
        {displayMessages.length >= 1 && (
          <div className="space-y-6">
            {displayMessages.map((msg, idx) => {
              console.log(`[ChatMessages] Rendering message ${idx}:`, { id: msg.id, role: msg.role, contentLen: msg.content?.length || 0 });
              return (
                <MessageRenderer
                  key={msg.id}
                  message={msg}
                  isLoading={isLoading}
                  isLastMessage={idx === displayMessages.length - 1}
                />
              );
            })}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Progress indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
            <span>Agent processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
