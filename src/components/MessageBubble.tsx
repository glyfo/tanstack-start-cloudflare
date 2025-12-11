import { Message } from './Chat'

interface MessageBubbleProps {
  message: Message
}

// Parse markdown formatting in text
function parseMarkdown(text: string) {
  // Split by ** for bold text
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove ** and wrap in bold tag
      const boldText = part.slice(2, -2)
      return <strong key={index} className="font-semibold">{boldText}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-lg px-4 py-2.5 max-w-[75%] text-sm bg-white/10 text-white border border-white/20">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="rounded-lg px-4 py-2.5 max-w-[75%] bg-white/5 text-white border border-white/10">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {parseMarkdown(message.content)}
        </p>
      </div>
    </div>
  )
}
