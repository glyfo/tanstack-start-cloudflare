interface MetricBarProps {
  label: string;
  value: number; // 0-100
  color?: string;
  showPercentage?: boolean;
}

/**
 * MetricBar - Progress bar for metrics and probabilities
 * Displays a horizontal bar with optional percentage label
 */
export function MetricBar({ label, value, color = 'emerald', showPercentage = true }: MetricBarProps) {
  // Ensure value is within 0-100 range
  const clampedValue = Math.max(0, Math.min(100, value));

  // Color mapping for dynamic Tailwind classes
  const colorClasses: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-700' },
    sky: { bg: 'bg-sky-500', text: 'text-sky-700' },
    stone: { bg: 'bg-stone-400', text: 'text-stone-700' },
  };

  const colors = colorClasses[color] || colorClasses.emerald;

  return (
    <div>
      <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colors.bg}`}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
        {showPercentage && (
          <span className={`text-xs font-semibold ${colors.text}`}>{clampedValue}%</span>
        )}
      </div>
    </div>
  );
}
