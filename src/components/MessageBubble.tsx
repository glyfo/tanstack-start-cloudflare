import { Message } from './Chat'
import { Copy, Check } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  isCopied?: boolean
  onCopy?: (text: string) => void
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

export function MessageBubble({ message, isCopied = false, onCopy }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const timeString = message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-lg px-4 py-2.5 max-w-[75%] text-sm bg-white/10 text-white border border-white/20">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          <p className="text-xs text-white/40 mt-1">{timeString}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start group">
      <div className="rounded-lg px-4 py-2.5 max-w-[75%] bg-white/5 text-white border border-white/10 relative">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {parseMarkdown(message.content)}
        </p>
        <p className="text-xs text-white/40 mt-1">{timeString}</p>
        
        {/* Copy button */}
        {onCopy && (
          <button
            onClick={() => onCopy(message.content)}
            className="absolute -right-10 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
            title="Copy message"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-white/50 hover:text-white" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
