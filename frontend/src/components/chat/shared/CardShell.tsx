import { ReactNode } from "react";

interface CardShellProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * CardShell - Base card container component
 * Provides consistent styling for all card types with optional icon, title, subtitle, and badge
 */
export function CardShell({
  icon,
  title,
  subtitle,
  badge,
  children,
  className = ""
}: CardShellProps) {
  return (
    <div className={`bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {icon && (
            <div className="shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-stone-900 text-sm">{title}</h4>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
