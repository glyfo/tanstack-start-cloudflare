import { useState } from 'react'
import { Send, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'

interface Task {
  id: string
  name: string
  description: string
  completed: boolean
  agentId: string
  type: 'operational' | 'strategic'
  frequency?: 'daily' | 'weekly' | 'monthly' | 'one-time'
  priority?: 'P1' | 'P2' | 'P3'
  status?: 'your-turn' | 'ai-working' | 'completed'
  estimatedTime?: number // in minutes
  agentAction?: string // what the AI did
  userAction?: string // what the user needs to do
  impact?: string // business impact
  lastUpdated?: Date
  urgency?: 'urgent' | 'today' | 'this-week'
}

interface ChatInputProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  agentTasks?: Task[]
  agentName?: string
  agentIcon?: string
}

export function ChatInput({ onSubmit, isLoading, input, handleInputChange, agentTasks = [], agentName = '', agentIcon = '' }: ChatInputProps) {
  const [expandedTask, setExpandedTask] = useState<Task | null>(null)
  const [expandAiWorking, setExpandAiWorking] = useState(false)
  const [tasksCollapsed, setTasksCollapsed] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSubmit(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Categorize tasks by status
  const yourTurnTasks = agentTasks.filter(t => t.status === 'your-turn' && !t.completed)
  const aiWorkingTasks = agentTasks.filter(t => t.status === 'ai-working' && !t.completed)
  const completedTasks = agentTasks.filter(t => t.completed)

  // Sort "Your Turn" tasks by urgency
  const sortedYourTurn = [...yourTurnTasks].sort((a, b) => {
    const urgencyOrder = { 'urgent': 0, 'today': 1, 'this-week': 2, undefined: 3 }
    return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 3) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 3)
  })

  const getUrgencyLabel = (urgency?: string) => {
    switch(urgency) {
      case 'urgent': return 'URGENT'
      case 'today': return 'TODAY'
      case 'this-week': return 'THIS WEEK'
      default: return 'UPCOMING'
    }
  }

  const getUrgencyColor = (urgency?: string) => {
    switch(urgency) {
      case 'urgent': return 'bg-red-500/15 border-red-500/40 hover:border-red-500/60'
      case 'today': return 'bg-yellow-500/15 border-yellow-500/40 hover:border-yellow-500/60'
      case 'this-week': return 'bg-blue-500/15 border-blue-500/40 hover:border-blue-500/60'
      default: return 'bg-white/10 border-white/20 hover:border-white/30'
    }
  }

  // Task Card Component - Human-in-the-Loop Focus
  const YourTurnCard = ({ task }: { task: Task }) => (
    <button
      onClick={() => setExpandedTask(task)}
      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer group ${getUrgencyColor(task.urgency)}`}
    >
      {/* Header: Urgency Badge + Title */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded">{getUrgencyLabel(task.urgency)}</span>
            <span className="text-xs font-bold text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded animate-pulse">HUMAN APPROVAL</span>
          </div>
          <h3 className="text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">{task.name}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-white/60 mb-3 line-clamp-1">{task.description}</p>

      {/* AI Work Done + Human Next Step */}
      <div className="space-y-2 mb-3 text-xs">
        <div className="flex gap-2">
          <span className="text-blue-400 font-bold shrink-0 text-xs">AI</span>
          <div className="bg-blue-500/10 flex-1 p-2 rounded border border-blue-500/20">
            <p className="text-white/70 line-clamp-2">{task.agentAction?.substring(0, 60)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-orange-400 font-bold shrink-0 text-xs">YOU</span>
          <div className="bg-orange-500/10 flex-1 p-2 rounded border border-orange-500/20">
            <p className="text-white/70 line-clamp-2">{task.userAction?.substring(0, 60)}</p>
          </div>
        </div>
      </div>

      {/* Footer: Time + Impact Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>{task.estimatedTime}m</span>
          {task.impact && <span className="text-green-400">Impact</span>}
        </div>
        <span className="text-xs font-semibold text-teal-400 group-hover:text-teal-300">Review →</span>
      </div>
    </button>
  )

  // Expanded Task View - Human-in-the-Loop Focus
  const ExpandedTask = ({ task }: { task: Task }) => (
    <div className="border-b border-white/10 p-4 bg-linear-to-r from-white/5 to-transparent space-y-4">
      {/* Header + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-bold text-white/50 bg-white/5 px-2 py-1 rounded">{getUrgencyLabel(task.urgency)}</span>
            <span className="text-xs font-bold text-orange-300 bg-orange-500/20 px-2 py-1 rounded animate-pulse">WAITING FOR YOU</span>
            <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">{task.type === 'operational' ? 'Operational' : 'Strategic'}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{task.name}</h2>
          <p className="text-sm text-white/60 mt-1">{task.description}</p>
        </div>
        <button
          onClick={() => setExpandedTask(null)}
          className="text-white/50 hover:text-white text-lg font-semibold transition-colors shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Agent Work Summary */}
      <div className="bg-blue-500/10 border-l-2 border-blue-500/50 p-4 rounded-lg space-y-2">
        <p className="text-sm font-semibold text-blue-300 flex items-center gap-2">
          What AI Completed
        </p>
        <p className="text-sm text-white/80 leading-relaxed">{task.agentAction}</p>
      </div>

      {/* Human Action Required */}
      <div className="bg-orange-500/15 border-l-2 border-orange-500/50 p-4 rounded-lg space-y-2">
        <p className="text-sm font-semibold text-orange-300 flex items-center gap-2">
          <span className="text-lg font-bold text-orange-400">YOU</span>
          Your Action Required
        </p>
        <p className="text-sm text-white/80 leading-relaxed">{task.userAction}</p>
      </div>

      {/* Business Impact */}
      {task.impact && (
        <div className="bg-green-500/10 border-l-2 border-green-500/50 p-4 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-green-300 flex items-center gap-2">
            Business Impact
          </p>
          <p className="text-sm text-white/80 leading-relaxed">{task.impact}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
          <p className="text-xs text-white/50 font-medium mb-1">Time to Review</p>
          <p className="text-lg font-bold text-teal-300">{task.estimatedTime}m</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
          <p className="text-xs text-white/50 font-medium mb-1">Focus Type</p>
          <p className="text-sm font-bold text-white/80 capitalize">{task.type}</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
          <p className="text-xs text-white/50 font-medium mb-1">Frequency</p>
          <p className="text-sm font-bold text-white/80 capitalize">{task.frequency || 'One-time'}</p>
        </div>
      </div>

      {/* Main Action Button */}
      <button className="w-full py-3 bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer">
        <span className="text-lg">✓</span>
        <span>Mark Complete & Continue</span>
      </button>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button className="py-2 border border-white/20 hover:border-white/40 text-white/70 hover:text-white font-medium rounded-lg transition-colors cursor-pointer">
          ↩️ Ask AI More
        </button>
        <button className="py-2 border border-white/20 hover:border-white/40 text-white/70 hover:text-white font-medium rounded-lg transition-colors cursor-pointer">
          Save for Later
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-2 flex flex-col-reverse">
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-center gap-0 bg-white/10 border border-white/20 rounded-lg hover:border-white/30 transition-all has-focus:border-white/40 has-focus:ring-1 has-focus:ring-white/20">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message SuperHuman..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-transparent text-white placeholder-white/40 focus:outline-none focus:ring-0 transition-all font-medium text-sm resize-none min-h-12 max-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed border-0"
            rows={1}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed font-semibold h-12 w-12 cursor-pointer shrink-0 hover:text-teal-400 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Simplified Task Container - Collapsible */}
      {agentTasks.length > 0 && !expandedTask && !tasksCollapsed && (
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
          
          {/* PRIMARY: "Your Turn" Section - Prominent with Human Icon */}
          {sortedYourTurn.length > 0 && (
            <div className="border-b border-white/10 p-4 bg-linear-to-r from-orange-500/5 to-transparent">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative">
                    <span className="text-2xl font-bold text-orange-400">YOU</span>
                    <span className="absolute top-0 right-0 w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-white">Your Approval Needed</h2>
                    <p className="text-xs text-white/50">{sortedYourTurn.length} task{sortedYourTurn.length !== 1 ? 's' : ''} waiting for your decision</p>
                  </div>
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/20 px-3 py-1 rounded-full">{sortedYourTurn.length} Active</span>
                </div>
              </div>
              <div className="space-y-2">
                {sortedYourTurn.map((task) => (
                  <YourTurnCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* SECONDARY: "AI Working" Section - Background Processing */}
          {aiWorkingTasks.length > 0 && (
            <div className="border-b border-white/10">
              <button
                onClick={() => setExpandAiWorking(!expandAiWorking)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left flex-1">
                  <div className="relative">
                    <span className="text-xl font-bold text-blue-400">AI</span>
                    <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">AI Processing ({aiWorkingTasks.length})</p>
                    <p className="text-xs text-white/50">Working in background • You can chat meanwhile</p>
                  </div>
                </div>
                {expandAiWorking ? (
                  <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                )}
              </button>

              {expandAiWorking && (
                <div className="border-t border-white/10 px-4 py-3 bg-white/2 space-y-2">
                  {aiWorkingTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded bg-blue-500/5 border border-blue-500/20">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{task.name}</p>
                          <p className="text-xs text-white/40">{task.estimatedTime}m remaining • {task.agentAction?.substring(0, 40)}...</p>
                        </div>
                      </div>
                      <span className="text-xs text-blue-300 font-semibold shrink-0">Processing...</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TERTIARY: Completed Section - Achievement Indicator */}
          {completedTasks.length > 0 && (
            <div className="px-4 py-3 bg-green-500/5 border-t border-green-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">{completedTasks.length} completed today</span>
              </div>
              <span className="text-white/40">Great progress! 🎉</span>
            </div>
          )}

          {/* Footer: Agent Info + Quick Stats */}
          <div className="px-4 py-3 bg-white/5 border-t border-white/10 text-xs text-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{agentIcon}</span>
              <span className="font-semibold">{agentName}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/40">Next: {sortedYourTurn.length > 0 ? 'Review your tasks' : 'Check AI progress'}</span>
            </div>
            <button
              onClick={() => setTasksCollapsed(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/60 hover:text-white/80"
              title="Collapse tasks"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsed Tasks Indicator - Show Human-Loop Status */}
      {agentTasks.length > 0 && !expandedTask && tasksCollapsed && (
        <button
          onClick={() => setTasksCollapsed(false)}
          className="w-full px-4 py-3 bg-linear-to-r from-orange-500/10 to-white/5 border border-orange-500/20 hover:border-orange-500/40 rounded-lg hover:bg-orange-500/15 transition-all flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-3 text-left flex-1">
            <div className="relative">
              <span className="text-lg font-bold text-orange-400 animate-pulse">YOU</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
            </div>
            <div>
              <p className="text-xs font-bold text-orange-300">Human Approval Pending</p>
              <p className="text-xs text-white/50">{agentName} • {sortedYourTurn.length + aiWorkingTasks.length} active tasks</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-orange-400/60 shrink-0" />
        </button>
      )}

      {/* Expanded Task View */}
      {expandedTask && (
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
          <ExpandedTask task={expandedTask} />

          {/* Footer: Agent Info */}
          <div className="px-4 py-2 bg-white/5 border-t border-white/10 text-xs text-white/50 flex items-center gap-2">
            <span>{agentIcon}</span>
            <span className="font-medium">{agentName}</span>
          </div>
        </div>
      )}
    </div>
  )
}
