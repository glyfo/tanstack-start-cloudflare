import { Message } from './Chat'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

interface ChatMessagesProps {
  messages: Message[]
  streamingContent: string
  isStreaming: boolean
}

export function ChatMessages({ messages, streamingContent, isStreaming }: ChatMessagesProps) {
  return (
    <div className="space-y-6">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-white/60 font-medium">Start a conversation</p>
        </div>
      )}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isStreaming && streamingContent && (
        <div className="flex justify-start">
          <div className="rounded-lg px-4 py-3 max-w-[75%] bg-white/5 border border-white/10 text-white">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
          </div>
        </div>
      )}
      {isStreaming && !streamingContent && <TypingIndicator />}
    </div>
  )
}
