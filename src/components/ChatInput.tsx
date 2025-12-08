import { useState } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSubmit: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    onSubmit(message)
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1 relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message SuperHuman..."
          disabled={isLoading}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-medium text-sm resize-none min-h-12 max-h-[150px] disabled:opacity-50 disabled:cursor-not-allowed"
          rows={1}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !message.trim()}
        className="px-3 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold h-12 cursor-pointer border border-white/20"
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  )
}
