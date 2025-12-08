import { useState, useEffect, useRef } from 'react'
import { Menu, X } from 'lucide-react'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

interface Agent {
  id: string
  name: string
  icon: string
  description: string
}

interface Task {
  id: string
  name: string
  description: string
  completed: boolean
}

interface ChatProps {
  email: string
}

const agents: Agent[] = [
  { id: '1', name: 'Sales', icon: '', description: 'Sales support' },
  { id: '2', name: 'Support', icon: '', description: 'Customer support' },
  { id: '3', name: 'Technical', icon: '', description: 'Technical assistance' },
  { id: '4', name: 'Billing', icon: '', description: 'Billing inquiries' },
]

const tasks: Task[] = [
  { id: '1', name: 'Account Setup', description: 'Complete your profile', completed: false },
  { id: '2', name: 'Verify Email', description: 'Confirm your email address', completed: true },
  { id: '3', name: 'Enable 2FA', description: 'Set up two-factor authentication', completed: false },
  { id: '4', name: 'Schedule Demo', description: 'Book a demo call', completed: false },
]

export function Chat({ email }: ChatProps) {
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('1')
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
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Sidebar - shadcn Dashboard Style */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-0'
        } border-r border-white/10 bg-neutral-950 overflow-hidden transition-all duration-300 flex flex-col shrink-0`}
      >
        {/* Branding */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              SH
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-white">SuperHuman</p>
              <p className="text-xs text-white/50">Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
          {/* Support Agents */}
          <div>
            <h2 className="px-2 text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Support Agents</h2>
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    selectedAgent === agent.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-white/30" />
                  <div className="text-left">
                    <p>{agent.name}</p>
                    <p className="text-xs text-white/50">{agent.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tasks / To-Do */}
          <div>
            <h2 className="px-2 text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Tasks</h2>
            <div className="space-y-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm text-left ${
                    task.completed
                      ? 'text-white/40 line-through'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    readOnly
                    className="w-4 h-4 rounded border border-white/20"
                  />
                  <span>{task.name}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* User Profile */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">alex</p>
              <p className="text-xs text-white/50 truncate">{email}</p>
            </div>
          </div>

          {/* Settings & Help Links */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
              <span>⚙️</span>
              <span>Settings</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
              <span>❓</span>
              <span>Get Help</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white lg:hidden"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="text-lg font-semibold text-white">Chat Console</h1>
          <div className="w-9" />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
            <ChatMessages
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-white/10 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <ChatInput onSubmit={handleSubmit} isLoading={isStreaming} />
          </div>
        </div>
      </div>
    </div>
  )
}
