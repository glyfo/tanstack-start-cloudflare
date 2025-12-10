import { CheckCircle2, Circle, Clock, Zap, Calendar, MessageSquare } from 'lucide-react'

interface ActionStep {
  id: string
  label: string
  description: string
  status: 'pending' | 'in-progress' | 'completed'
  timestamp?: Date
  actor: 'ai' | 'user'
  duration?: number
  icon?: string
  type?: 'summary' | 'meeting' | 'task' | 'action'
}

interface ActionTimelineProps {
  steps: ActionStep[]
  currentStep: number
  totalSteps: number
  title?: string
  compact?: boolean
  showSummary?: boolean
}

export function ActionTimeline({ 
  steps, 
  currentStep, 
  totalSteps,
  title = 'Timeline',
  compact = false,
  showSummary = true
}: ActionTimelineProps) {
  
  const getTypeIcon = (type?: string, icon?: string) => {
    if (icon) return icon
    switch(type) {
      case 'summary':
        return '⚡'
      case 'meeting':
        return '📅'
      case 'task':
        return '✓'
      case 'action':
        return '→'
      default:
        return '•'
    }
  }

  const getTypeColor = (type?: string) => {
    switch(type) {
      case 'summary':
        return 'from-purple-500 to-purple-600'
      case 'meeting':
        return 'from-orange-500 to-orange-600'
      case 'task':
        return 'from-pink-500 to-pink-600'
      case 'action':
        return 'from-blue-500 to-blue-600'
      default:
        return 'from-gray-500 to-gray-600'
    }
  }

  const getBorderColor = (type?: string) => {
    switch(type) {
      case 'summary':
        return 'border-l-purple-500'
      case 'meeting':
        return 'border-l-orange-500'
      case 'task':
        return 'border-l-pink-500'
      case 'action':
        return 'border-l-blue-500'
      default:
        return 'border-l-gray-500'
    }
  }

  const getActorBadge = (actor: 'ai' | 'user') => {
    if (actor === 'ai') {
      return <span className="text-xs font-bold px-2.5 py-1 bg-blue-500/25 text-blue-300 rounded-full border border-blue-400/30">🤖 AI</span>
    }
    return <span className="text-xs font-bold px-2.5 py-1 bg-orange-500/25 text-orange-300 rounded-full border border-orange-400/30">👤 YOU</span>
  }

  if (compact) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-white/40 font-medium">{currentStep}/{totalSteps}</p>
        </div>
        
        <div className="flex items-center gap-1.5">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
                step.status === 'completed' ? 'bg-green-400 shadow-lg shadow-green-500/50' :
                step.status === 'in-progress' ? 'bg-blue-400 animate-pulse shadow-lg shadow-blue-500/50' :
                'bg-white/20'
              }`} />
              {idx < steps.length - 1 && (
                <div className="w-1.5 h-0.5 bg-white/15" />
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-white/60 font-medium">
          {steps[currentStep - 1]?.label}
        </div>

        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-linear-to-r from-blue-500 to-teal-500 transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-white/50 mt-1">Based on recent activities</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-white">{currentStep}/{totalSteps}</p>
          <p className="text-xs text-white/40 mt-1">{Math.round((currentStep / totalSteps) * 100)}% complete</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-linear-to-b from-blue-500/50 via-purple-500/30 to-transparent" />

        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={step.id} className="relative animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex gap-6">
                {/* Timeline Icon */}
                <div className="flex-shrink-0 relative z-10 mt-1">
                  <div className={`w-14 h-14 rounded-lg bg-linear-to-br ${getTypeColor(step.type)} flex items-center justify-center text-xl font-bold shadow-lg hover:shadow-xl transition-shadow`}>
                    {getTypeIcon(step.type, step.icon)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`bg-white/5 border-l-4 ${getBorderColor(step.type)} border-t border-r border-b border-white/10 rounded-r-lg p-5 hover:bg-white/8 transition-all hover:shadow-lg`}>
                    
                    {/* Title and Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{step.label}</h4>
                        {step.type === 'summary' && (
                          <p className="text-xs text-gray-400 mt-1">Based on recent activities</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {getActorBadge(step.actor)}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-white/70 leading-relaxed mb-4 line-clamp-3">
                      {step.description}
                    </p>

                    {/* Meta Information */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
                      {step.timestamp && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {step.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {step.duration && (
                        <span className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          {step.duration}m duration
                        </span>
                      )}
                      {step.status === 'completed' && (
                        <span className="text-green-400 font-medium">✓ Completed</span>
                      )}
                      {step.status === 'in-progress' && (
                        <span className="text-blue-400 font-medium animate-pulse">⟳ In Progress</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Footer */}
      <div className="mt-8 p-5 bg-linear-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Overall Progress</p>
          <p className="text-sm font-bold text-blue-300">{Math.round((currentStep / totalSteps) * 100)}%</p>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-linear-to-r from-blue-500 via-teal-500 to-cyan-500 transition-all duration-500 rounded-full shadow-lg shadow-blue-500/50"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
