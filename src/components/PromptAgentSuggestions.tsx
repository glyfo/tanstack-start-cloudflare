interface Agent {
  id: string
  name: string
  icon: string
  description: string
  specialization?: string
}

interface PromptAgentSuggestionsProps {
  agents: Agent[]
  onSelectAgent: (agentId: string) => void
  suggestedAgentIds?: string[]
}

export function PromptAgentSuggestions({
  agents,
  onSelectAgent,
  suggestedAgentIds = []
}: PromptAgentSuggestionsProps) {
  const suggestions = suggestedAgentIds
    .map(id => agents.find(a => a.id === id))
    .filter(Boolean) as Agent[]

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-3">
      <p className="text-xs font-semibold text-blue-300 mb-2">💡 Suggested Agents</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className="text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-400 px-3 py-1.5 rounded transition-colors text-blue-300 hover:text-blue-200 flex items-center gap-1.5 font-medium"
          >
            <span>{agent.icon}</span>
            <span>{agent.name}</span>
            {agent.specialization && (
              <span className="text-blue-400/60 text-xs">({agent.specialization})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
