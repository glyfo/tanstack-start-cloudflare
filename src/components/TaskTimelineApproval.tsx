import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface TimelineEvent {
  id: string
  time: Date
  actor: 'ai' | 'user'
  action: string
}

interface Task {
  id: string
  name: string
  description: string
  agentName: string
  agentIcon: string
  timeline: TimelineEvent[]
  userActionNeeded: string
  estimatedTime: number
  impact: string
  status: 'awaiting-approval'
}

interface TaskTimelineApprovalProps {
  tasks: Task[]
  onApprove?: (taskId: string) => void
  onReject?: (taskId: string) => void
}

export function TaskTimelineApproval({
  tasks,
  onApprove,
  onReject
}: TaskTimelineApprovalProps) {
  if (tasks.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
        <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
        <p className="text-sm font-semibold text-white">All caught up!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-orange-400" />
        <h2 className="text-sm font-bold text-white">
          Your Approval Needed • {tasks.length} Active
        </h2>
      </div>

      {/* Tasks */}
      {tasks.map((task) => (
        <div
          key={task.id}
          className="bg-gradient-to-r from-gray-800/40 to-gray-700/20 border border-orange-500/30 rounded-lg p-4 space-y-3"
        >
          {/* Task Title */}
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{task.agentIcon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">{task.name}</h3>
              <p className="text-xs text-white/60 mt-0.5">{task.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
                <span>{task.agentName}</span>
                <span>•</span>
                <span>{task.estimatedTime}m</span>
              </div>
            </div>
          </div>

          {/* Simple Timeline */}
          <div className="bg-black/20 rounded p-3 space-y-2">
            {task.timeline.map((event) => (
              <div key={event.id} className="flex items-start gap-2 text-xs">
                <span className="text-white/40 flex-shrink-0 w-12">
                  {event.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  event.actor === 'ai' ? 'bg-blue-500/30 text-blue-300' : 'bg-orange-500/30 text-orange-300'
                }`}>
                  {event.actor === 'ai' ? '🤖' : '👤'}
                </span>
                <span className="text-white/70">{event.action}</span>
              </div>
            ))}
          </div>

          {/* User Action */}
          <div className="bg-orange-500/15 border-l-2 border-l-orange-500 p-3 rounded-r">
            <p className="text-xs font-bold text-orange-300 mb-1">Your Action:</p>
            <p className="text-xs text-white">{task.userActionNeeded}</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onApprove?.(task.id)}
              className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded text-xs font-semibold text-green-300 transition-all"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => onReject?.(task.id)}
              className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs font-semibold text-red-300 transition-all"
            >
              ✕ Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
