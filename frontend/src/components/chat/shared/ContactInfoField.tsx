import { ReactNode } from "react";

interface ContactInfoFieldProps {
  icon: ReactNode;
  value: string;
  label?: string;
}

/**
 * ContactInfoField - Icon + value line for contact information
 * Used in lead cards and contact detail views
 */
export function ContactInfoField({ icon, value, label }: ContactInfoFieldProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-4 h-4 text-stone-400 shrink-0">{icon}</div>
      {label ? (
        <div className="flex-1">
          <span className="text-stone-400 text-xs">{label}</span>
          <p className="text-stone-700">{value}</p>
        </div>
      ) : (
        <span className="text-stone-700">{value}</span>
      )}
    </div>
  );
}
