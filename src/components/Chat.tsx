import { useState, useEffect, useRef } from 'react'
import { X, Settings, ChevronDown, ChevronUp, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { connectToAI } from '@/server/ai'

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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [tipsExpanded, setTipsExpanded] = useState(true)
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const copyToClipboard = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hello. Welcome to SuperHuman. I\'m here to help you maximize productivity. What would you like to focus on today?',
          createdAt: new Date(),
        },
      ])
      setError(null)
      setLastUserMessage(null)
    }
  }

  const handleRegenerateMessage = async () => {
    if (!lastUserMessage || isLoading) return
    setError(null)
    // Remove last assistant message
    setMessages((prev) => prev.slice(0, -1))
    // Resend the last user message
    await sendMessage(lastUserMessage)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)
    setLastUserMessage(content)

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsLoading(true)

    try {
      // Call server function with prompt data
      const response = await connectToAI({ data: { prompt: content } })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body from Cloudflare AI')
      }

      // Process the streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        const lines = buffer.split('\n')
        buffer = lines[lines.length - 1]

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]
          
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6)
              const data = JSON.parse(jsonStr)
              
              const token = data.response || data.token
              
              // Skip null tokens, [DONE] markers, and usage data
              if (token && token !== '[DONE]' && !data.usage) {
                accumulatedContent += token
                
                // Update the last message with accumulated content
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastMessage = updated[updated.length - 1]
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content = accumulatedContent
                  }
                  return updated
                })
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }

    } catch (error) {
      console.error('Failed to get AI response:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(errorMessage)

      // Remove incomplete assistant message
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const userContent = input
    setInput('')
    await sendMessage(userContent)
  }

  const handleTipClick = (example: string) => {
    // Collapse the EXPLORE SUGGESTIONS section
    setTipsExpanded(false)
    // Send the message immediately
    sendMessage(example)
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-wide">SUPERHUMAN</h1>
            <p className="text-xs text-white/40 mt-1 tracking-wide">AI-POWERED</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Clear Chat Button */}
            <button
              onClick={handleClearChat}
              title="Clear conversation"
              className="px-3 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer border bg-transparent text-white border-white/20 hover:border-white/40 hover:bg-white/10"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">CLEAR</span>
            </button>

            {/* Regenerate Button */}
            {lastUserMessage && !isLoading && messages.length > 2 && (
              <button
                onClick={handleRegenerateMessage}
                title="Regenerate last response"
                className="px-3 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer border bg-transparent text-white border-white/20 hover:border-white/40 hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">RETRY</span>
              </button>
            )}

            {/* Settings Button */}
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
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/20 border-b border-red-500/50 text-red-300 px-6 py-3 flex items-center justify-between">
              <p className="text-sm">{error}</p>
              <div className="flex gap-2">
                {lastUserMessage && (
                  <button
                    onClick={handleRegenerateMessage}
                    disabled={isLoading}
                    className="text-xs px-3 py-1 bg-red-500/30 hover:bg-red-500/50 border border-red-500/50 rounded transition-colors disabled:opacity-50"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setError(null)}
                  className="text-xs px-2 py-1 hover:bg-red-500/20 rounded transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            <div className="max-w-4xl mx-auto py-6 px-6 space-y-6">
              <ChatMessages
                messages={messages}
                isLoading={isLoading}
                copiedId={copiedId}
                onCopyMessage={copyToClipboard}
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

        {/* Settings Sidebar */}
        {showSettings && (
          <>
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowSettings(false)}
            />
            {/* Sidebar */}
            <div className="fixed right-0 top-0 bottom-0 w-80 bg-black border-l border-white/20 shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-right">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between bg-black">
                <h3 className="text-sm font-semibold text-white tracking-wide">SETTINGS</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer hover:cursor-pointer"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-black space-y-6">
                <div>
                  <h4 className="text-xs font-semibold text-white/70 mb-3 uppercase tracking-wide">Preferences</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 text-xs text-white/60 hover:text-white/80 cursor-pointer transition-colors">
                      <input type="checkbox" defaultChecked className="rounded w-4 h-4 cursor-pointer" />
                      <span>Enable notifications</span>
                    </label>
                    <label className="flex items-center gap-3 text-xs text-white/60 hover:text-white/80 cursor-pointer transition-colors">
                      <input type="checkbox" defaultChecked className="rounded w-4 h-4 cursor-pointer" />
                      <span>Show task timeline</span>
                    </label>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-6">
                  <h4 className="text-xs font-semibold text-white/70 mb-3 uppercase tracking-wide">Account</h4>
                  <div className="space-y-2 text-xs text-white/50">
                    <p>Email: you@company.com</p>
                    <p>Plan: Professional</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Input area */}
        <div className=" px-6 py-4 bg-black relative">
          <div className="max-w-4xl mx-auto">
            <ChatInput 
              onSubmit={handleSubmit} 
              isLoading={isLoading}
              input={input}
              handleInputChange={handleInputChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
