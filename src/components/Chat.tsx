import { useState, useEffect, useRef } from 'react'
import { X, Settings, ChevronDown, ChevronUp } from 'lucide-react'
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

const tips = [
  {
    title: 'Revenue',
    description: 'Pipeline, deals, opportunities',
    examples: ['Show my sales pipeline', 'At-risk deals', 'Close rate'],
  },
  {
    title: 'Performance',
    description: 'Team metrics, targets, growth',
    examples: ['Team performance', 'Conversion metrics', 'Weekly results'],
  },
  {
    title: 'Priorities',
    description: 'Tasks, deadlines, focus areas',
    examples: ['My priorities today', 'Urgent tasks', 'What\'s next'],
  },
  {
    title: 'Updates',
    description: 'Recent activity, follow-ups, news',
    examples: ['What happened today', 'Recent updates', 'Upcoming events'],
  },
]

export function Chat({ email: _email }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello. Welcome to SuperHuman. I\'m here to help you maximize productivity. What would you like to focus on today?',
      createdAt: new Date(),
    },
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [tipsExpanded, setTipsExpanded] = useState(true)
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
    const response = "Analyzing your request and pulling relevant data..."
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

  const handleTipClick = (example: string) => {
    handleSubmit(example)
    setTipsExpanded(false)
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-wide">SUPERHUMAN</h1>
            <p className="text-xs text-white/40 mt-1 tracking-wide">AI-POWERED CX</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer border ${
              showSettings
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white border-white/20 hover:border-white/40'
            }`}
            title="View settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">SETTINGS</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            <div className="max-w-4xl mx-auto py-6 px-6 space-y-6">
              <ChatMessages
                messages={messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
              />
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Tips Grid - Card Based */}
        <div className=" bg-black flex justify-center px-6 py-4">
          <div className="max-w-4xl w-full">
            <div className="border border-white/20 rounded-lg bg-white/2.5 hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer">
              <button
                onClick={() => setTipsExpanded(!tipsExpanded)}
                className="w-full flex items-center justify-between text-white/70 hover:text-white transition-all text-left py-3 px-4 cursor-pointer group"
              >
                <span className="text-xs font-semibold tracking-wide group-hover:text-white/90 transition-colors">EXPLORE SUGGESTIONS</span>
                {tipsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                )}
              </button>

              {tipsExpanded && (
                <div className="border-t border-white/10 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {tips.map((tip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTipClick(tip.examples[0])}
                        className="bg-white/5 border border-white/15 rounded-md p-3 hover:border-white/40 hover:bg-white/15 hover:shadow-lg hover:shadow-white/5 transition-all text-left group cursor-pointer active:scale-95 active:shadow-none"
                      >
                        <h3 className="text-xs font-semibold text-white/80 group-hover:text-white tracking-wide mb-1 transition-colors">
                          {tip.title}
                        </h3>
                        <p className="text-xs text-white/40 mb-2 group-hover:text-white/60 transition-colors line-clamp-1">
                          {tip.description}
                        </p>
                        
                        <div className="space-y-0.5">
                          {tip.examples.map((example, exIdx) => (
                            <button
                              key={exIdx}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTipClick(example)
                              }}
                              className="block w-full text-left text-xs text-white/40 hover:text-white/90 hover:bg-white/8 rounded px-1.5 py-1 transition-all truncate cursor-pointer"
                              title={example}
                            >
                              • {example}
                            </button>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Settings Modal */}
        {showSettings && (
          <div className="absolute bottom-24 right-6 w-96 max-h-96 bg-black border border-white/20 rounded-lg shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-right">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between bg-black">
              <h3 className="text-sm font-semibold text-white tracking-wide">SETTINGS</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer hover:cursor-pointer"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-black space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-white/70 mb-2 uppercase tracking-wide">Preferences</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-white/60 hover:text-white/80 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>Enable notifications</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/60 hover:text-white/80 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span>Show task timeline</span>
                  </label>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-xs font-semibold text-white/70 mb-2 uppercase tracking-wide">Account</h4>
                <div className="space-y-1 text-xs text-white/50">
                  <p>Email: you@company.com</p>
                  <p>Plan: Professional</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className=" px-6 py-4 bg-black relative">
          <div className="max-w-4xl mx-auto">
            <ChatInput 
              onSubmit={handleSubmit} 
              isLoading={isStreaming}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
