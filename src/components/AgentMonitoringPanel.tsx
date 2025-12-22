import { ChevronDown, ChevronUp, AlertCircle, Clock, CheckCircle2, Zap } from 'lucide-react'
import { useState } from 'react'

interface ActionTimeline {
  id: string
  timestamp: Date
  action: string
  actor: 'ai' | 'user'
  status: 'pending' | 'in-progress' | 'completed'
  duration?: number
  type?: 'summary' | 'meeting' | 'task' | 'action'
}

interface Task {
  id: string
  name: string
  description: string
  completed: boolean
  agentId: string
  type: 'operational' | 'strategic'
  status?: 'pending' | 'ai-working' | 'your-turn' | 'completed'
  timeline?: ActionTimeline[]
  currentStep?: number
  totalSteps?: number
  estimatedTime?: number
  agentAction?: string
  userAction?: string
  impact?: string
}

interface Agent {
  id: string
  name: string
  icon: string
  description: string
  kpi: string
  performanceValue: number
  tasksCount: number
  department?: string
  specialization?: string
}

interface AgentMonitoringPanelProps {
  agents: Agent[]
  tasks: Task[]
  onTaskApprove?: (taskId: string) => void
  onTaskReject?: (taskId: string) => void
}

export function AgentMonitoringPanel({
  agents,
  tasks,
  onTaskApprove,
  onTaskReject
}: AgentMonitoringPanelProps) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  // Get tasks pending human approval
  const pendingApprovalTasks = tasks.filter(task => task.status === 'your-turn')
  
  // Group tasks by agent
  const tasksByAgent = new Map<string, Task[]>()
  pendingApprovalTasks.forEach(task => {
    if (!tasksByAgent.has(task.agentId)) {
      tasksByAgent.set(task.agentId, [])
    }
    tasksByAgent.get(task.agentId)!.push(task)
  })

  // Get agents with pending tasks
  const agentsWithPendingTasks = Array.from(tasksByAgent.entries())
    .map(([agentId]) => agents.find(a => a.id === agentId))
    .filter(Boolean) as Agent[]

  if (pendingApprovalTasks.length === 0) {
    return (
      <div className="bg-linear-to-r from-green-500/10 to-teal-500/10 border border-green-500/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-white">All caught up!</p>
        <p className="text-xs text-white/60 mt-1">No tasks awaiting your approval</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-bold text-white">Human Approval Pending</h2>
        </div>
        <p className="text-sm text-white/60">
          {pendingApprovalTasks.length} {pendingApprovalTasks.length === 1 ? 'task' : 'tasks'} awaiting your review
        </p>
      </div>

      {/* Agents with pending tasks */}
      <div className="space-y-3">
        {agentsWithPendingTasks.map((agent) => {
          const agentTasks = tasksByAgent.get(agent.id) || []
          const isExpanded = expandedAgentId === agent.id

          return (
            <div
              key={agent.id}
              className="bg-linear-to-r from-orange-500/10 via-white/5 to-white/5 border border-orange-500/20 rounded-xl overflow-hidden hover:border-orange-500/40 transition-all shadow-lg hover:shadow-xl"
            >
              {/* Agent Header */}
              <button
                onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 text-left min-w-0">
                  <div className="text-3xl shrink-0">{agent.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white truncate">{agent.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/60 flex-wrap">
                      {agent.department && (
                        <span className="px-2 py-0.5 bg-white/10 rounded-full">{agent.department}</span>
                      )}
                      <span className="font-semibold text-orange-300">
                        {agentTasks.length} {agentTasks.length === 1 ? 'task' : 'tasks'} pending
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-white/40">Performance</p>
                    <p className="text-sm font-bold text-white">{agent.performanceValue}%</p>
                  </div>
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5 text-orange-400" />
                  </div>
                </div>
              </button>

              {/* Agent Tasks */}
              {isExpanded && (
                <div className="border-t border-orange-500/20 bg-black/20 divide-y divide-orange-500/10 animate-in fade-in slide-in-from-top-2 duration-200">
                  {agentTasks.map((task) => {
                    const isTaskExpanded = expandedTaskId === task.id
                    const progress = task.totalSteps ? (task.currentStep || 0) / task.totalSteps : 0

                    return (
                      <div key={task.id} className="p-5 hover:bg-white/5 transition-colors">
                        {/* Task Header */}
                        <button
                          onClick={() => setExpandedTaskId(isTaskExpanded ? null : task.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="text-sm font-bold text-white truncate">{task.name}</h4>
                                <span className="text-xs bg-orange-500/30 text-orange-200 px-2 py-0.5 rounded-full font-semibold shrink-0">
                                  Action Required
                                </span>
                              </div>
                              <p className="text-xs text-white/60 line-clamp-2">{task.description}</p>
                            </div>
                            <div className="shrink-0">
                              {isTaskExpanded ? (
                                <ChevronUp className="w-4 h-4 text-orange-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-white/40" />
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {task.totalSteps && (
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-linear-to-r from-orange-500 to-amber-500 transition-all"
                                  style={{ width: `${progress * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-white/60 font-medium shrink-0">
                                {task.currentStep}/{task.totalSteps}
                              </span>
                            </div>
                          )}

                          {/* Task Meta */}
                          <div className="flex items-center gap-4 text-xs text-white/50 flex-wrap">
                            {task.agentAction && (
                              <span className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-blue-300">AI: {task.agentAction}</span>
                              </span>
                            )}
                            {task.estimatedTime && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                ~{task.estimatedTime}m
                              </span>
                            )}
                            {task.impact && (
                              <span className="text-green-300 font-medium">Impact: {task.impact}</span>
                            )}
                          </div>
                        </button>

                        {/* Expanded Task Details with Timeline */}
                        {isTaskExpanded && (
                          <div className="mt-4 pt-4 border-t border-white/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* User Action Required */}
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <div className="text-orange-400 mt-1 shrink-0">•</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-orange-300 mb-1">Your Action</p>
                                  <p className="text-sm text-white/80">{task.userAction}</p>
                                </div>
                              </div>
                            </div>

                            {/* Timeline */}
                            {task.timeline && task.timeline.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Activity Timeline</p>
                                
                                <div className="relative pl-6 space-y-4">
                                  {/* Vertical line */}
                                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-linear-to-b from-blue-500/50 to-transparent" />

                                  {task.timeline.map((step) => (
                                    <div key={step.id} className="relative">
                                      {/* Timeline dot */}
                                      <div className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 ${
                                        step.status === 'completed'
                                          ? 'bg-green-500 border-green-400'
                                          : step.status === 'in-progress'
                                          ? 'bg-blue-500 border-blue-400 animate-pulse'
                                          : 'bg-white/20 border-white/30'
                                      }`} />

                                      {/* Timeline entry */}
                                      <div className={`p-3 rounded-lg border ${
                                        step.status === 'completed'
                                          ? 'bg-green-500/10 border-green-500/20'
                                          : step.status === 'in-progress'
                                          ? 'bg-blue-500/10 border-blue-500/20'
                                          : 'bg-white/5 border-white/10'
                                      }`}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <p className="text-xs font-semibold text-white">{step.action}</p>
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                            step.actor === 'ai'
                                              ? 'bg-blue-500/30 text-blue-300'
                                              : 'bg-orange-500/30 text-orange-300'
                                          }`}>
                                            {step.actor === 'ai' ? 'AI' : 'YOU'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-white/50">
                                          {step.timestamp && (
                                            <span>{step.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                          )}
                                          {step.duration && (
                                            <span>{step.duration}m</span>
                                          )}
                                          <span className={`font-medium ${
                                            step.status === 'completed' ? 'text-green-400' :
                                            step.status === 'in-progress' ? 'text-blue-400' :
                                            'text-white/40'
                                          }`}>
                                            {step.status}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                              <button
                                onClick={() => onTaskApprove?.(task.id)}
                                className="flex-1 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 hover:border-green-500/60 rounded-lg text-sm font-semibold text-green-300 hover:text-green-200 transition-all"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => onTaskReject?.(task.id)}
                                className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 hover:border-red-500/60 rounded-lg text-sm font-semibold text-red-300 hover:text-red-200 transition-all"
                              >
                                ✕ Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary Footer */}
      <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-white/10">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-orange-400">{pendingApprovalTasks.length}</p>
          <p className="text-xs text-white/60 mt-1">Tasks Pending</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{agentsWithPendingTasks.length}</p>
          <p className="text-xs text-white/60 mt-1">Agents Active</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-white">
            {Math.round(
              pendingApprovalTasks.reduce((sum, t) => sum + (t.totalSteps ? (t.currentStep || 0) / t.totalSteps : 0), 0) / pendingApprovalTasks.length * 100
            )}%
          </p>
          <p className="text-xs text-white/60 mt-1">Avg Progress</p>
        </div>
      </div>
    </div>
  )
}
