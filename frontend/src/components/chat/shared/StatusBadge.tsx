interface StatusBadgeProps {
  label: string;
  color?: 'stone' | 'sky' | 'emerald' | 'amber' | 'red' | 'purple';
}

/**
 * StatusBadge - Colored badge for status indicators
 * Supports multiple color variants matching the design system
 */
export function StatusBadge({ label, color = 'stone' }: StatusBadgeProps) {
  // Color mapping for Tailwind classes
  const colorClasses: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    sky: 'bg-sky-100 text-sky-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${colorClasses[color] || colorClasses.stone}`}>
      {label}
    </span>
  );
}
