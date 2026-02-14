// Thinking Indicator with blinking dots
export type StatusPhase = "analyzing" | "calling-tool" | "formatting" | "thinking" | "creating" | "searching" | null;

export interface ThinkingIndicatorProps {
  phase: StatusPhase;
  tool?: string | null;
}

const phaseConfig: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  analyzing: {
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    label: "Analyzing your request",
  },
  "calling-tool": {
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Executing action",
  },
  formatting: {
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    label: "Preparing response",
  },
  creating: {
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    label: "Creating record",
  },
  searching: {
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    label: "Searching database",
  },
  thinking: {
    color: "text-stone-500",
    bgColor: "bg-stone-50",
    borderColor: "border-stone-200",
    label: "Thinking",
  },
};

function ThinkingIndicator({ phase, tool }: ThinkingIndicatorProps) {
  const currentPhase = phase || "thinking";
  const config = phaseConfig[currentPhase] || phaseConfig.thinking;

  const getToolLabel = (toolName: string): string => {
    const toolLabels: Record<string, string> = {
      "client.getTime": "Getting current time",
      "client.getLocation": "Getting location info",
      "client.getDevice": "Getting device info",
      "createContact": "Creating contact",
      "updateContact": "Updating contact",
      "searchContacts": "Searching contacts",
      "createOpportunity": "Creating opportunity",
      "updateOpportunity": "Updating opportunity",
      "searchOpportunities": "Searching opportunities",
      "getLeadAnalytics": "Fetching analytics",
      "qualifyLead": "Qualifying lead",
      "server.createContact": "Creating contact",
      "server.searchContacts": "Searching contacts",
      "server.createOpportunity": "Creating opportunity",
      "server.searchOpportunities": "Searching opportunities",
    };
    return toolLabels[toolName] || `Running ${toolName.replace('server.', '')}`;
  };

  const label = tool ? getToolLabel(tool) : config.label;

  return (
    <div className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${config.bgColor} border ${config.borderColor}`}>
      {/* Animated spinner */}
      <div className={`w-4 h-4 ${config.color}`}>
        <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <span className={`text-sm font-medium ${config.color}`}>{label}</span>
    </div>
  );
}

export default ThinkingIndicator;
