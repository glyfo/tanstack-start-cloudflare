// MCP Apps pattern - Tool invocation result
interface ToolInvokeResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface ActionCardProps {
  title: string;
  description?: string;
  actionType?: 'info' | 'confirm' | 'warning' | 'success';
  primaryAction?: {
    label: string;
    onClick: () => void;
    // MCP Apps pattern - optional tool invocation
    toolId?: string;
    toolParams?: Record<string, any>;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    // MCP Apps pattern - optional tool invocation
    toolId?: string;
    toolParams?: Record<string, any>;
  };
  children?: React.ReactNode;
  // MCP Apps pattern - direct tool invocation
  onInvokeTool?: (toolId: string, params: Record<string, any>) => Promise<ToolInvokeResult>;
}

const actionTypeStyles = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  confirm: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'text-purple-600',
    iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function ActionCard({
  title,
  description,
  actionType = 'info',
  primaryAction,
  secondaryAction,
  children,
  onInvokeTool,
}: ActionCardProps) {
  const styles = actionTypeStyles[actionType];

  // MCP Apps pattern - handle action with direct tool invocation
  const handleAction = async (action: typeof primaryAction) => {
    if (!action) return;

    if (onInvokeTool && action.toolId) {
      try {
        await onInvokeTool(action.toolId, action.toolParams || {});
      } catch (error) {
        console.error('Failed to invoke tool:', error);
      }
    } else {
      action.onClick();
    }
  };

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 mb-3`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0">
          <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={styles.iconPath} />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-stone-900 mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-stone-700">{description}</p>
          )}
        </div>
      </div>

      {/* Custom Content */}
      {children && (
        <div className="mb-3 pl-8">
          {children}
        </div>
      )}

      {/* Action Buttons */}
      {(primaryAction || secondaryAction) && (
        <div className="flex gap-2 pl-8">
          {primaryAction && (
            <button
              onClick={() => handleAction(primaryAction)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={() => handleAction(secondaryAction)}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-stone-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
