interface Agent {
  id: string
  name: string
  icon: string
  responsibility: string
  workflow: string[]
  kpi: string
  performanceValue: number
  specialization?: string
  department?: string
}

interface AgentHandlerListProps {
  agents: Agent[]
  compact?: boolean
}

export function AgentHandlerList({ agents, compact = false }: AgentHandlerListProps) {
  // Group by department
  const departments = new Map<string, Agent[]>()
  agents.forEach(agent => {
    const dept = agent.department || 'Other'
    if (!departments.has(dept)) {
      departments.set(dept, [])
    }
    departments.get(dept)!.push(agent)
  })

  if (compact) {
    return (
      <div className="space-y-2">
        {Array.from(departments.entries()).map(([dept, deptAgents]) => (
          <div key={dept} className="bg-white/5 border border-white/10 rounded-lg p-2">
            <p className="text-xs font-bold text-white/70 mb-1.5">{dept} Department</p>
            <div className="space-y-1">
              {deptAgents.map(agent => (
                <div key={agent.id} className="text-xs">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">{agent.icon}</span>
                    <span className="font-semibold text-white/80">{agent.name}</span>
                    {agent.specialization && (
                      <span className="text-xs bg-blue-500/20 px-1 rounded text-blue-300">
                        {agent.specialization}
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 ml-6 line-clamp-1">{agent.responsibility}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Agent Handler Overview</h2>

      {Array.from(departments.entries()).map(([dept, deptAgents]) => (
        <div key={dept} className="border border-white/10 rounded-lg overflow-hidden">
          {/* Department Header */}
          <div className="bg-linear-to-r from-blue-500/10 to-transparent px-4 py-3 border-b border-white/10">
            <h3 className="text-base font-bold text-white mb-1">{dept} Department</h3>
            <p className="text-sm text-white/60">{deptAgents.length} specialized roles</p>
          </div>

          {/* Agents */}
          <div className="divide-y divide-white/10">
            {deptAgents.map((agent) => (
              <div key={agent.id} className="p-4 hover:bg-white/5 transition-colors">
                {/* Agent Header */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                      {agent.specialization && (
                        <span className="text-xs bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                          {agent.specialization}
                        </span>
                      )}
                      <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded text-green-300">
                        {agent.kpi}: {agent.performanceValue}%
                      </span>
                    </div>
                    <p className="text-sm text-white/70">{agent.responsibility}</p>
                  </div>
                </div>

                {/* Workflow */}
                <div className="ml-11">
                  <p className="text-xs font-semibold text-white/60 mb-2">Workflow:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.workflow.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/70 font-medium">
                          {step}
                        </span>
                        {idx < agent.workflow.length - 1 && (
                          <span className="text-white/30">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-300 mb-2">📊 Team Overview</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/60 font-medium">{agents.length}</p>
            <p className="text-white/40 text-xs">Total Agents</p>
          </div>
          <div>
            <p className="text-white/60 font-medium">{departments.size}</p>
            <p className="text-white/40 text-xs">Departments</p>
          </div>
          <div className="col-span-2">
            <p className="text-white/60 font-medium text-center">
              {agents.reduce((sum, a) => sum + a.performanceValue, 0) / agents.length}%
            </p>
            <p className="text-white/40 text-xs text-center">Avg Performance</p>
          </div>
        </div>
      </div>
    </div>
  )
}
