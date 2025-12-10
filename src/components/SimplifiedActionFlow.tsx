interface ActionFlowProps {
  agentName: string
  agentIcon: string
  taskName: string
  steps: {
    label: string
    description: string
    completed: boolean
    actor: 'ai' | 'user'
  }[]
  currentStep: number
}

export function SimplifiedActionFlow({ 
  agentName, 
  agentIcon,
  taskName,
  steps, 
  currentStep 
}: ActionFlowProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-linear-to-r from-white/5 to-transparent border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{agentIcon}</span>
            <div>
              <p className="text-xs text-white/50 font-medium">{agentName}</p>
              <p className="text-sm font-bold text-white">{taskName}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-white/40 bg-white/10 px-2 py-1 rounded">
            {currentStep}/{steps.length}
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-white/10">
        {steps.map((step, index) => {
          const isActive = index + 1 === currentStep
          const isCompleted = step.completed
          
          return (
            <div 
              key={index} 
              className={`px-4 py-3 transition-all ${
                isActive 
                  ? 'bg-blue-500/10 border-l-2 border-blue-500' 
                  : isCompleted
                  ? 'bg-green-500/5'
                  : 'bg-white/2'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${
                      isActive ? 'text-blue-300' :
                      isCompleted ? 'text-green-300' :
                      'text-white/60'
                    }`}>
                      {step.label}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      step.actor === 'ai'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-orange-500/20 text-orange-300'
                    }`}>
                      {step.actor === 'ai' ? '🤖' : '👤'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{step.description}</p>
                </div>
                
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  isActive 
                    ? 'bg-blue-500/20 border border-blue-400 animate-pulse'
                    : isCompleted
                    ? 'bg-green-500/20 border border-green-400'
                    : 'bg-white/10 border border-white/20'
                }`}>
                  {isCompleted && <span className="text-xs">✓</span>}
                  {isActive && <span className="text-xs animate-pulse">●</span>}
                </div>
              </div>

              {/* Status indicator */}
              {(isActive || isCompleted) && (
                <div className={`text-xs font-medium flex items-center gap-1 mt-2 ${
                  isActive ? 'text-blue-300' : 'text-green-300'
                }`}>
                  {isActive ? '⚡ In Progress' : '✓ Completed'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Progress */}
      <div className="px-4 py-3 bg-white/5 border-t border-white/10">
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-linear-to-r from-blue-500 to-teal-500 transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-white/40 mt-2 text-center">
          Step {currentStep} of {steps.length}
        </p>
      </div>
    </div>
  )
}
