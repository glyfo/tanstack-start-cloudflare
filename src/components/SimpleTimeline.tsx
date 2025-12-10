import { CheckCircle2, Circle } from 'lucide-react'

interface TimelineEvent {
  id: string
  title: string
  description?: string
  time: Date
  actor: 'ai' | 'user'
  status: 'pending' | 'in-progress' | 'completed'
}

interface SimpleTimelineProps {
  events: TimelineEvent[]
  title?: string
  onApprove?: () => void
  onReject?: () => void
}

export function SimpleTimeline({
  events,
  title = 'Task Timeline',
  onApprove,
  onReject,
}: SimpleTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-white">All caught up!</p>
        <p className="text-xs text-white/50 mt-1">No pending tasks</p>
      </div>
    )
  }

  const completedCount = events.filter(e => e.status === 'completed').length
  const totalCount = events.length
  const progress = Math.round((completedCount / totalCount) * 100)
  const hasActionNeeded = events.some(e => e.actor === 'user' && e.status === 'pending')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-white/50 mt-0.5">{completedCount} of {totalCount} completed</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{progress}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-blue-500 to-purple-500 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timeline */}
      <div className="relative space-y-3">
        {/* Vertical connector line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-linear-to-b from-blue-500/50 via-purple-500/30 to-transparent" />

        {/* Events */}
        {events.map((event) => (
          <div key={event.id} className="relative pl-14">
            {/* Timeline dot */}
            <div className="absolute left-0 top-1.5 z-10">
              {event.status === 'completed' ? (
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
              ) : event.status === 'in-progress' ? (
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center animate-pulse">
                  <Circle className="w-4 h-4 text-blue-400" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/30 flex items-center justify-center">
                  <Circle className="w-4 h-4 text-white/40" />
                </div>
              )}
            </div>

            {/* Event content */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/8 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      event.actor === 'ai' 
                        ? 'bg-blue-500/25 text-blue-300' 
                        : 'bg-orange-500/25 text-orange-300'
                    }`}>
                      {event.actor === 'ai' ? '🤖 AI' : '👤 You'}
                    </span>
                    <span className="text-xs text-white/50">
                      {event.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1">{event.title}</h4>
                  {event.description && (
                    <p className="text-xs text-white/60 mt-0.5">{event.description}</p>
                  )}
                </div>
                {event.status === 'completed' && (
                  <span className="text-xs font-bold text-green-400 shrink-0">✓</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons - show only if user action is needed */}
      {hasActionNeeded && (
        <div className="flex gap-2 pt-2 border-t border-white/10">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded text-xs font-semibold text-green-300 transition-all hover:shadow-lg hover:shadow-green-500/20"
            >
              ✓ Approve & Continue
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs font-semibold text-red-300 transition-all hover:shadow-lg hover:shadow-red-500/20"
            >
              ✕ Reject
            </button>
          )}
        </div>
      )}
    </div>
  )
}
