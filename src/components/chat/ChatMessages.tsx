import { MessageRenderer, type RenderedMessage } from "./ChatRenderer";

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
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Messages */}
        {messages.length > 1 && (
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <MessageRenderer
                key={msg.id}
                message={msg}
                isLoading={isLoading}
                isLastMessage={idx === messages.length - 1}
              />
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
  );
}
