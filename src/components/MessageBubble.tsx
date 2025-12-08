import { Message } from './Chat'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl px-4 py-3 max-w-[80%] text-sm bg-blue-600 text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="rounded-2xl px-4 py-3 max-w-[85%] bg-gray-100 text-gray-900">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}
