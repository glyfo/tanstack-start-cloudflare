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
    <form onSubmit={handleSubmit} className="flex gap-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message... (Shift+Enter for new line)"
        disabled={isLoading}
        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-sm resize-none min-h-11 max-h-[120px] placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        rows={1}
      />
      <button
        type="submit"
        disabled={isLoading || !message.trim()}
        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium h-11 cursor-pointer"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
