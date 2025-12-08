import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Sparkles, ArrowLeft } from 'lucide-react'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

interface ChatProps {
  email: string
}

export function Chat({ email }: ChatProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! 👋 Welcome to SuperHuman. How can I help you today?',
      createdAt: new Date(),
    },
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSubmit = async (content: string) => {
    if (!content.trim() || isStreaming) return

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Simulate AI response
    setIsStreaming(true)
    setStreamingContent('')

    // Simulate streaming response
    const response = "That's a great question! I'm here to help you make the most of SuperHuman. Tell me more about what you'd like to know."
    let currentIndex = 0

    const streamInterval = setInterval(() => {
      if (currentIndex < response.length) {
        setStreamingContent((prev) => prev + response[currentIndex])
        currentIndex++
      } else {
        clearInterval(streamInterval)

        // Add assistant message
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response,
          createdAt: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
        setStreamingContent('')
        setIsStreaming(false)
      }
    }, 10)
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/' })}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">SuperHuman Assistant</h3>
              <p className="text-xs text-gray-500">{email}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          <ChatMessages
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSubmit={handleSubmit} isLoading={isStreaming} />
        </div>
      </div>
    </div>
  )
}
