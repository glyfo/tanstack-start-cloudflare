interface Agent {
  id: string
  name: string
  icon: string
  specialization?: string
  tasksCount: number
}

interface AgentQuickRefProps {
  agents: Agent[]
  selectedAgentId?: string
  onSelectAgent?: (agentId: string) => void
}

export function AgentQuickRef({ agents, selectedAgentId, onSelectAgent }: AgentQuickRefProps) {
  // Group by department/specialization
  const groups = new Map<string, Agent[]>()
  agents.forEach(agent => {
    const key = agent.specialization || 'General'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(agent)
  })

  return (
    <div className="inline-flex flex-wrap gap-2">
      {Array.from(groups.entries()).map(([key, groupAgents]) => (
        <div key={key} className="flex gap-1.5">
          {groupAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent?.(agent.id)}
              title={`${agent.name} (${agent.tasksCount} tasks)`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all text-xs font-medium ${
                selectedAgentId === agent.id
                  ? 'bg-blue-500/30 border border-blue-400 text-blue-300'
                  : 'bg-white/10 border border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              <span className="text-sm">{agent.icon}</span>
              <span className="hidden sm:inline">{agent.name}</span>
              <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
                {agent.tasksCount}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
