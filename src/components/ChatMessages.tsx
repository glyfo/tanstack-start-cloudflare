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
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isStreaming && streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-900">
            <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
          </div>
        </div>
      )}
      {isStreaming && !streamingContent && <TypingIndicator />}
    </div>
  )
}
