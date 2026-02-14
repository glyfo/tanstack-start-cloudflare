interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface CardActionsProps {
  actions: Action[];
}

/**
 * CardActions - Consistent button row for card actions
 * Supports primary, secondary, and danger variants
 */
export function CardActions({ actions }: CardActionsProps) {
  const getButtonClass = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-sky-500 hover:bg-sky-600 text-white';
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-stone-100 hover:bg-stone-200 text-stone-700';
    }
  };

  return (
    <div className="flex gap-2 mt-3">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          disabled={action.disabled}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getButtonClass(action.variant)}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
