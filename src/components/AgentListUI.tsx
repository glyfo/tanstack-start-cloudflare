import { ChevronDown, ChevronRight, Search, Zap, TrendingUp, Clock } from 'lucide-react'
import { useState } from 'react'

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

interface AgentListUIProps {
  agents: Agent[]
  selectedAgentId: string
  onSelectAgent: (agentId: string) => void
  onClose?: () => void
}

export function AgentListUI({
  agents,
  selectedAgentId,
  onSelectAgent,
  onClose
}: AgentListUIProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDept, setExpandedDept] = useState<string | null>('Sales')
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)

  // Group agents by department
  const departments = new Map<string, Agent[]>()
  agents.forEach(agent => {
    const dept = agent.department || 'Other'
    if (!departments.has(dept)) {
      departments.set(dept, [])
    }
    departments.get(dept)!.push(agent)
  })

  // Filter agents by search
  const filteredDepts = new Map<string, Agent[]>()
  departments.forEach((deptAgents, deptName) => {
    const filtered = deptAgents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (filtered.length > 0) {
      filteredDepts.set(deptName, filtered)
    }
  })

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  const handleSelectAgent = (agentId: string) => {
    onSelectAgent(agentId)
    onClose?.()
  }

  return (
    <div className="space-y-3 max-h-[650px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
      {/* Search Bar */}
      <div className="sticky top-0 bg-white/5 backdrop-blur-sm p-3 rounded-lg border border-white/10 z-20 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search agents by name, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 transition-all"
          />
        </div>
      </div>

      {/* Current Selection Summary */}
      {selectedAgent && (
        <div className="bg-linear-to-r from-blue-500/15 to-teal-500/5 border border-blue-500/30 rounded-lg p-4 shadow-md">
          <p className="text-xs text-blue-300 font-bold mb-2 uppercase tracking-wide">Currently Selected</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">{selectedAgent.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{selectedAgent.name}</p>
              {selectedAgent.specialization && (
                <p className="text-xs text-blue-300 mt-0.5">{selectedAgent.specialization} Role</p>
              )}
              <p className="text-xs text-white/50 mt-1">{selectedAgent.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs bg-blue-500/30 border border-blue-400/40 px-2 py-1 rounded-full text-blue-300 font-semibold">
                {selectedAgent.tasksCount} tasks
              </span>
              <span className="text-xs bg-green-500/20 px-2 py-1 rounded text-green-300 font-medium">
                {selectedAgent.kpi}: {selectedAgent.performanceValue}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {!searchQuery && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/60 font-medium">{agents.length}</p>
            <p className="text-xs text-white/40">Agents Available</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/60 font-medium">{departments.size}</p>
            <p className="text-xs text-white/40">Departments</p>
          </div>
        </div>
      )}

      {/* Departments List */}
      <div className="space-y-2">
        {Array.from(filteredDepts.entries()).map(([deptName, deptAgents]) => {
          const isExpanded = expandedDept === deptName
          const primaryAgent = deptAgents.find(a => !a.specialization || a.specialization === 'General')
          const specializedAgents = deptAgents.filter(a => a.specialization && a.specialization !== 'General')

          return (
            <div
              key={deptName}
              className="border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-all hover:shadow-md"
            >
              {/* Department Header */}
              <button
                onClick={() => setExpandedDept(isExpanded ? null : deptName)}
                className="w-full px-4 py-3.5 bg-white/5 hover:bg-white/8 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className={`text-2xl group-hover:scale-110 transition-transform`}>
                    {primaryAgent?.icon || '◆'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                      {deptName}
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      {primaryAgent ? '1 primary' : '0 primary'} + {specializedAgents.length} specialized
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isExpanded 
                      ? 'bg-blue-500/30 text-blue-300' 
                      : 'bg-white/10 text-white/60 group-hover:bg-white/15'
                  }`}>
                    {deptAgents.length}
                  </span>
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-blue-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60" />
                    )}
                  </div>
                </div>
              </button>

              {/* Department Agents */}
              {isExpanded && (
                <div className="border-t border-white/10 divide-y divide-white/10 bg-white/2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Primary Agent */}
                  {primaryAgent && (
                    <button
                      onClick={() => handleSelectAgent(primaryAgent.id)}
                      onMouseEnter={() => setHoveredAgentId(primaryAgent.id)}
                      onMouseLeave={() => setHoveredAgentId(null)}
                      className={`w-full px-4 py-4 text-left transition-all ${
                        selectedAgentId === primaryAgent.id
                          ? 'bg-blue-500/15 border-l-3 border-l-blue-400'
                          : hoveredAgentId === primaryAgent.id
                          ? 'bg-white/8'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-lg group-hover:scale-125 transition-transform">
                              {primaryAgent.icon}
                            </span>
                            <p className="text-sm font-bold text-white truncate">
                              {primaryAgent.name}
                            </p>
                            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/70 font-medium shrink-0">
                              Primary
                            </span>
                          </div>
                          <p className="text-xs text-white/60 line-clamp-2 mb-2">
                            {primaryAgent.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {primaryAgent.kpi}: {primaryAgent.performanceValue}%
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {primaryAgent.tasksCount} tasks
                            </span>
                          </div>
                        </div>
                        {selectedAgentId === primaryAgent.id && (
                          <div className="shrink-0 text-blue-400 font-bold text-2xl animate-pulse">✓</div>
                        )}
                      </div>
                    </button>
                  )}

                  {/* Specialized Agents */}
                  {specializedAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleSelectAgent(agent.id)}
                      onMouseEnter={() => setHoveredAgentId(agent.id)}
                      onMouseLeave={() => setHoveredAgentId(null)}
                      className={`w-full px-4 py-4 text-left transition-all pl-8 ${
                        selectedAgentId === agent.id
                          ? 'bg-blue-500/15 border-l-3 border-l-blue-400'
                          : hoveredAgentId === agent.id
                          ? 'bg-white/8'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-lg">
                              {agent.icon}
                            </span>
                            <p className="text-sm font-bold text-white truncate">
                              {agent.name}
                            </p>
                            <span className="text-xs bg-blue-500/30 border border-blue-400/40 px-2 py-0.5 rounded-full text-blue-300 font-medium shrink-0">
                              {agent.specialization}
                            </span>
                          </div>
                          <p className="text-xs text-white/60 line-clamp-2 mb-2">
                            {agent.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {agent.kpi}: {agent.performanceValue}%
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {agent.tasksCount} tasks
                            </span>
                          </div>
                        </div>
                        {selectedAgentId === agent.id && (
                          <div className="shrink-0 text-blue-400 font-bold text-2xl animate-pulse">✓</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filteredDepts.size === 0 && (
          <div className="text-center py-12 px-4">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-sm text-white/40 font-medium">No agents found</p>
            <p className="text-xs text-white/30 mt-1">Try searching with different keywords</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-blue-400 hover:text-blue-300 mt-3 underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Agent Statistics Footer */}
      {!searchQuery && filteredDepts.size > 0 && (
        <div className="sticky bottom-0 bg-linear-to-t from-black/40 to-transparent pt-2 pb-1">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 backdrop-blur-sm shadow-lg">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white/5 rounded p-2">
                <p className="text-white/70 font-bold text-sm">{agents.length}</p>
                <p className="text-white/40 text-xs mt-0.5">Total Agents</p>
              </div>
              <div className="bg-white/5 rounded p-2">
                <p className="text-white/70 font-bold text-sm">{departments.size}</p>
                <p className="text-white/40 text-xs mt-0.5">Departments</p>
              </div>
              <div className="bg-white/5 rounded p-2">
                <p className="text-white/70 font-bold text-sm">
                  {Math.round(agents.reduce((sum, a) => sum + a.tasksCount, 0) / agents.length)}
                </p>
                <p className="text-white/40 text-xs mt-0.5">Avg Tasks</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
