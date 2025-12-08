import { useState, useEffect, useRef } from 'react'
import { Menu, X, CheckSquare, HelpCircle, Search } from 'lucide-react'
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
  kpi: string
  performanceValue: number
  tasksCount: number
  responsibility: string
  workflow: string[]
  availability: string
}

interface Task {
  id: string
  name: string
  description: string
  completed: boolean
  agentId: string
}

interface ChatProps {
  email: string
}

const agents: Agent[] = [
  { 
    id: '1', 
    name: 'Sales', 
    icon: '📈', 
    description: 'Sales support', 
    kpi: 'Conversion Rate', 
    performanceValue: 87, 
    tasksCount: 3,
    responsibility: 'Manages customer acquisition, demo scheduling, and sales opportunities. Focuses on onboarding new clients and identifying growth potential.',
    workflow: ['Identify prospects', 'Schedule consultations', 'Present solutions', 'Close deals', 'Onboard clients'],
    availability: 'Mon-Fri, 9 AM - 6 PM'
  },
  { 
    id: '2', 
    name: 'Support', 
    icon: '🎧', 
    description: 'Customer support', 
    kpi: 'Resolution Time', 
    performanceValue: 94, 
    tasksCount: 4,
    responsibility: 'Provides technical troubleshooting and customer issue resolution. Ensures customer satisfaction through timely and effective support.',
    workflow: ['Receive tickets', 'Diagnose issues', 'Implement solutions', 'Test fixes', 'Document resolutions'],
    availability: 'Mon-Sun, 24/7'
  },
  { 
    id: '3', 
    name: 'Technical', 
    icon: '⚙️', 
    description: 'Technical assistance', 
    kpi: 'Uptime', 
    performanceValue: 99, 
    tasksCount: 2,
    responsibility: 'Oversees system infrastructure, API integration, and technical architecture. Maintains platform stability and performance.',
    workflow: ['Review requirements', 'Design solutions', 'Configure systems', 'Deploy updates', 'Monitor performance'],
    availability: 'Mon-Fri, 10 AM - 8 PM'
  },
  { 
    id: '4', 
    name: 'Billing', 
    icon: '💼', 
    description: 'Billing inquiries', 
    kpi: 'Accuracy', 
    performanceValue: 98, 
    tasksCount: 2,
    responsibility: 'Handles invoicing, payment processing, and financial transactions. Ensures accurate billing and timely payment collection.',
    workflow: ['Process invoices', 'Verify payments', 'Handle disputes', 'Generate reports', 'Update records'],
    availability: 'Mon-Fri, 9 AM - 5 PM'
  },
]

const tasks: Task[] = [
  { id: '1', name: 'Account Setup', description: 'Complete your profile', completed: false, agentId: '1' },
  { id: '2', name: 'Verify Email', description: 'Confirm your email address', completed: true, agentId: '1' },
  { id: '3', name: 'Enable 2FA', description: 'Set up two-factor authentication', completed: false, agentId: '2' },
  { id: '4', name: 'Schedule Demo', description: 'Book a demo call', completed: false, agentId: '2' },
  { id: '5', name: 'Configure API', description: 'Set up API access', completed: false, agentId: '3' },
  { id: '6', name: 'Review Pricing', description: 'Check pricing plans', completed: false, agentId: '4' },
]

const strategicTips = [
  { icon: '🎯', title: 'Focus Strategy', content: 'Prioritize high-impact tasks that align with your business goals. Start with Account Setup and Email Verification to establish a strong foundation.' },
  { icon: '📊', title: 'Data-Driven Decisions', content: 'Review performance metrics regularly. Our agents show 87-99% performance rates across key KPIs. Use this data to optimize your workflow.' },
  { icon: '⚡', title: 'Operational Excellence', content: 'Enable 2FA immediately to protect your account security. Our Support team resolves issues in average 2.3 hours.' },
  { icon: '🚀', title: 'Growth Acceleration', content: 'Schedule a demo with our Sales team to unlock advanced features. Clients who complete onboarding see 3x productivity increase.' },
  { icon: '💡', title: 'Automation Tips', content: 'Use our API integration to automate routine tasks. Technical team is available 24/7 for support with 99% uptime guarantee.' },
  { icon: '🔐', title: 'Security Best Practices', content: 'Always verify multi-factor authentication setup. Billing inquiries are processed with 98% accuracy using automated systems.' },
]

export function Chat({ email: _email }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! 👋 Welcome to SuperHuman. I\'m here to help you maximize productivity. What would you like to focus on today?',
      createdAt: new Date(),
    },
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tasksPanelOpen, setTasksPanelOpen] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('1')
  const [showAgentsList, setShowAgentsList] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [showTasksPanel, setShowTasksPanel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get tasks for selected agent
  const agentTasks = tasks.filter(task => task.agentId === selectedAgent)
  const selectedAgentData = agents.find(a => a.id === selectedAgent)

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
      {/* Sidebar - Collapsible with Icon Mode */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-20'
        } border-r border-white/10 bg-neutral-950 overflow-hidden transition-all duration-300 flex flex-col shrink-0`}
      >
        {/* Branding */}
        <div className="px-6 py-5 border-b border-white/10">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  SH
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-bold text-white">SuperHuman</p>
                  <p className="text-xs text-white/50">Console</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {sidebarOpen ? (
            <div className="space-y-8">
              {/* Support Agents Section */}
              {!showAgentsList ? (
                // Agent Details View
                <>
                  {/* Agent Header with Search */}
                  {selectedAgentData && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{selectedAgentData.icon}</span>
                          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Selected Agent</h2>
                        </div>
                        <button
                          onClick={() => setShowAgentsList(true)}
                          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
                          title="Change agent"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Full Agent Details Card */}
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                        {/* Agent Name & KPI */}
                        <div className="space-y-3 pb-3 border-b border-white/10">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">{selectedAgentData.name}</h3>
                            <span className="text-2xl">{selectedAgentData.icon}</span>
                          </div>
                          <p className="text-xs text-white/60">{selectedAgentData.description}</p>
                          
                          {/* KPI Performance */}
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/60 font-medium">{selectedAgentData.kpi}</span>
                              <span className="text-sm font-bold text-white">{selectedAgentData.performanceValue}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2.5">
                              <div
                                className="bg-white/40 h-2.5 rounded-full transition-all"
                                style={{ width: `${selectedAgentData.performanceValue}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Responsibility */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/60 uppercase">Responsibility</p>
                          <p className="text-xs text-white/70 leading-relaxed">{selectedAgentData.responsibility}</p>
                        </div>

                        {/* Workflow Steps */}
                        <div className="space-y-3 py-3 border-y border-white/10">
                          <p className="text-xs font-semibold text-white/60 uppercase">Support Workflow</p>
                          <div className="space-y-2">
                            {selectedAgentData.workflow.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-white/40 mt-1.5 shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-white/70">{step}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Availability & Tasks */}
                        <div className="grid grid-cols-2 gap-4 pt-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-white/60 uppercase">Availability</p>
                            <p className="text-xs text-white/70">{selectedAgentData.availability}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-white/60 uppercase">Active Tasks</p>
                            <p className="text-xs text-white/70">{agentTasks.length} {agentTasks.length === 1 ? 'task' : 'tasks'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Agent Selection List
                <div>
                  <div className="flex items-center justify-between px-2 mb-4">
                    <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Select Agent</h2>
                    <button
                      onClick={() => setShowAgentsList(false)}
                      className="p-1 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgent(agent.id)
                          setShowAgentsList(false)
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-sm font-medium ${
                          selectedAgent === agent.id
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="text-xl">{agent.icon}</span>
                        <div className="text-left flex-1">
                          <p className="text-sm font-semibold">{agent.name}</p>
                          <p className="text-xs text-white/50">{agent.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks / To-Do */}
              <div>
                <div className="flex items-center justify-between px-2 mb-4">
                  <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Agent Tasks</h2>
                  <button
                    onClick={() => setTasksPanelOpen(!tasksPanelOpen)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {tasksPanelOpen ? '−' : '+'}
                  </button>
                </div>
                {tasksPanelOpen && (
                  <div className="space-y-2">
                    {agentTasks.length > 0 ? (
                      agentTasks.map((task) => (
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
                      ))
                    ) : (
                      <p className="text-xs text-white/40 px-3 py-2">No tasks for this agent</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={() => setSelectedAgent('1')}
                className={`p-3 rounded-lg transition-colors ${
                  selectedAgent === '1' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                title="Sales"
              >
                <span className="text-xl">💰</span>
              </button>
              <button
                onClick={() => setSelectedAgent('2')}
                className={`p-3 rounded-lg transition-colors ${
                  selectedAgent === '2' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                title="Support"
              >
                <span className="text-xl">🆘</span>
              </button>
              <button
                onClick={() => setSelectedAgent('3')}
                className={`p-3 rounded-lg transition-colors ${
                  selectedAgent === '3' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                title="Technical"
              >
                <span className="text-xl">⚙️</span>
              </button>
              <button
                onClick={() => setSelectedAgent('4')}
                className={`p-3 rounded-lg transition-colors ${
                  selectedAgent === '4' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                title="Billing"
              >
                <span className="text-xl">💳</span>
              </button>
              <div className="border-t border-white/10 w-8 my-2" />
              <button
                onClick={() => setTasksPanelOpen(!tasksPanelOpen)}
                className="p-3 hover:bg-white/5 rounded-lg transition-colors text-white"
                title="Tasks"
              >
                <CheckSquare className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowTips(!showTips)}
                className="p-3 hover:bg-white/5 rounded-lg transition-colors text-white"
                title="Help & Advice"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          )}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="border-t border-white/10 p-4 space-y-4">
            {/* Settings Link */}
            <div className="space-y-1 pt-2">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                <span>⚙️</span>
                <span>Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Chat Console</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowTasksPanel(false)
                setShowTips(!showTips)
              }}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                showTips
                  ? 'bg-white/10 text-white'
                  : 'hover:bg-white/5 text-white/70 hover:text-white'
              }`}
            >
              <HelpCircle className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Help</span>
            </button>
            <button
              onClick={() => {
                setShowTips(false)
                setShowTasksPanel(!showTasksPanel)
              }}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
                showTasksPanel
                  ? 'bg-white/10 text-white'
                  : 'hover:bg-white/5 text-white/70 hover:text-white'
              }`}
            >
              <CheckSquare className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Tasks</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* Messages area */}
          <div className={`${showTips || showTasksPanel ? 'flex-1' : 'w-full'} overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent`}>
            <div className="max-w-4xl mx-auto py-4 px-6 space-y-6">
              <ChatMessages
                messages={messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
              />
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Strategic Tips Panel */}
          {showTips && (
            <div className="w-80 bg-neutral-950 border border-white/10 rounded-lg flex flex-col overflow-hidden">
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Help & Advice
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 p-4">
                {strategicTips.map((tip, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">{tip.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white mb-1">{tip.title}</p>
                        <p className="text-xs text-white/60 leading-relaxed">{tip.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Panel */}
          {showTasksPanel && (
            <div className="w-80 bg-neutral-950 border border-white/10 rounded-lg flex flex-col overflow-hidden">
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  {selectedAgentData?.name} Tasks
                </h3>
                <p className="text-xs text-white/50 mt-1">Active: {agentTasks.length} {agentTasks.length === 1 ? 'task' : 'tasks'}</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 p-4">
                {agentTasks.length > 0 ? (
                  agentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center mt-0.5">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            readOnly
                            className="w-4 h-4 rounded border border-white/20 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.completed ? 'text-white/40 line-through' : 'text-white'}`}>
                            {task.name}
                          </p>
                          <p className="text-xs text-white/60 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-white/10 rounded text-white/70">
                              {selectedAgentData?.name}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              task.completed
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {task.completed ? 'Done' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-40 text-center">
                    <p className="text-xs text-white/50">No tasks assigned to {selectedAgentData?.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}
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
