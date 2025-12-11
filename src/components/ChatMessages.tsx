import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

interface ChatMessagesProps {
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
  }>
  isLoading: boolean
  copiedId?: string | null
  onCopyMessage?: (text: string, messageId: string) => void
}

export function ChatMessages({ messages, isLoading, copiedId, onCopyMessage }: ChatMessagesProps) {
  return (
    <div className="space-y-6">
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-white/60 font-medium">Start a conversation</p>
        </div>
      )}
      {messages.map((message) => (
        <MessageBubble 
          key={message.id} 
          message={message}
          isCopied={copiedId === message.id}
          onCopy={onCopyMessage ? (text) => onCopyMessage(text, message.id) : undefined}
        />
      ))}
      {isLoading && <TypingIndicator />}
    </div>
  )
}
