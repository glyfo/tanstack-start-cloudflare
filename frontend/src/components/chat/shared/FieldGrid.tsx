import { ReactNode } from "react";

interface Field {
  label: string;
  value: string | number | ReactNode;
  icon?: ReactNode;
}

interface FieldGridProps {
  fields: Field[];
  columns?: 2 | 3;
}

/**
 * FieldGrid - Responsive grid for displaying key-value pairs
 * Supports 2 or 3 columns with optional icons
 */
export function FieldGrid({ fields, columns = 2 }: FieldGridProps) {
  return (
    <div className={`grid gap-x-4 gap-y-1 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {fields.map((field, i) => (
        <div key={i} className="text-xs">
          {field.icon ? (
            <div className="flex items-center gap-1 text-stone-400 mb-0.5">
              {field.icon}
              <span>{field.label}</span>
            </div>
          ) : (
            <span className="text-stone-400">{field.label}</span>
          )}
          <p className="text-stone-700 font-medium">{field.value}</p>
        </div>
      ))}
    </div>
  );
}
