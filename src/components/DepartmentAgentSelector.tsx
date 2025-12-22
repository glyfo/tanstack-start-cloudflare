import { ChevronRight } from 'lucide-react'

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
  parentAgentId?: string
}

interface DepartmentAgentSelectorProps {
  agents: Agent[]
  selectedAgentId: string
  onSelectAgent: (agentId: string) => void
  compact?: boolean
}

export function DepartmentAgentSelector({
  agents,
  selectedAgentId,
  onSelectAgent,
  compact = false
}: DepartmentAgentSelectorProps) {
  // Group agents by department
  const departments = new Map<string, Agent[]>()
  
  agents.forEach(agent => {
    const dept = agent.department || 'Other'
    if (!departments.has(dept)) {
      departments.set(dept, [])
    }
    departments.get(dept)!.push(agent)
  })

  const parentAgent = agents.find(a => a.id === selectedAgentId)
  const selectedDepartment = parentAgent?.department || 'Sales'
  const departmentAgents = departments.get(selectedDepartment) || []
  const primaryAgent = departmentAgents.find(a => !a.parentAgentId)
  const specializedAgents = departmentAgents.filter(a => a.parentAgentId)

  if (compact) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
        <p className="text-xs font-bold text-white/60 mb-2">{selectedDepartment} Team</p>
        
        <div className="space-y-1.5">
          {/* Primary agent */}
          {primaryAgent && (
            <button
              onClick={() => onSelectAgent(primaryAgent.id)}
              className={`w-full text-left px-2 py-1.5 rounded transition-all text-xs ${
                selectedAgentId === primaryAgent.id
                  ? 'bg-blue-500/20 border border-blue-500/40'
                  : 'bg-white/5 border border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{primaryAgent.icon}</span>
                <span className="font-medium text-white/80">{primaryAgent.name}</span>
              </div>
            </button>
          )}

          {/* Specialized agents */}
          {specializedAgents.length > 0 && (
            <div className="pl-3 border-l border-white/10 space-y-1">
              {specializedAgents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className={`w-full text-left px-2 py-1 rounded transition-all text-xs flex items-center justify-between ${
                    selectedAgentId === agent.id
                      ? 'bg-blue-500/20 border border-blue-500/40'
                      : 'bg-white/5 border border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm">{agent.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-white/80 truncate">{agent.name}</p>
                      <p className="text-white/40 text-xs">{agent.specialization}</p>
                    </div>
                  </div>
                  {selectedAgentId === agent.id && (
                    <ChevronRight className="w-3 h-3 text-blue-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Array.from(departments.entries()).map(([dept, deptAgents]) => {
        const isPrimaryDept = dept === selectedDepartment
        const primary = deptAgents.find(a => !a.parentAgentId)
        const specialized = deptAgents.filter(a => a.parentAgentId)

        return (
          <div key={dept} className={`rounded-lg border transition-all ${
            isPrimaryDept
              ? 'border-blue-500/40 bg-blue-500/5'
              : 'border-white/10 bg-white/5'
          }`}>
            {/* Department Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">{dept} Department</h3>
              <p className="text-xs text-white/40 mt-1">{specialized.length} specialized roles</p>
            </div>

            {/* Primary Agent */}
            {primary && (
              <button
                onClick={() => onSelectAgent(primary.id)}
                className={`w-full text-left px-4 py-3 transition-all border-b border-white/10 hover:bg-white/10 ${
                  selectedAgentId === primary.id ? 'bg-blue-500/10' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{primary.icon}</span>
                      <h4 className={`font-bold ${
                        selectedAgentId === primary.id ? 'text-blue-300' : 'text-white'
                      }`}>
                        {primary.name}
                      </h4>
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/60">
                        General
                      </span>
                    </div>
                    <p className="text-xs text-white/60">{primary.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                      <span>{primary.kpi}: {primary.performanceValue}%</span>
                      <span>{primary.tasksCount} tasks</span>
                    </div>
                  </div>
                  {selectedAgentId === primary.id && (
                    <div className="text-blue-400 font-bold">✓</div>
                  )}
                </div>
              </button>
            )}

            {/* Specialized Agents */}
            {specialized.length > 0 && (
              <div className="bg-white/2">
                {specialized.map((agent, idx) => (
                  <button
                    key={agent.id}
                    onClick={() => onSelectAgent(agent.id)}
                    className={`w-full text-left px-4 py-3 transition-all ${
                      idx < specialized.length - 1 ? 'border-b border-white/10' : ''
                    } hover:bg-white/5 ${
                      selectedAgentId === agent.id ? 'bg-blue-500/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pl-6">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{agent.icon}</span>
                          <h4 className={`font-bold ${
                            selectedAgentId === agent.id ? 'text-blue-300' : 'text-white'
                          }`}>
                            {agent.name}
                          </h4>
                          <span className="text-xs bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                            {agent.specialization}
                          </span>
                        </div>
                        <p className="text-xs text-white/60">{agent.description}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                          <span>{agent.kpi}: {agent.performanceValue}%</span>
                          <span>{agent.tasksCount} tasks</span>
                        </div>
                      </div>
                      {selectedAgentId === agent.id && (
                        <div className="text-blue-400 font-bold">✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
