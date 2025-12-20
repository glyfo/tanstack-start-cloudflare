import React, { useState } from "react";
import type { DefinitionListSchema } from "@/types/content-schema";

interface DefinitionListBlockProps extends DefinitionListSchema {
  displayHint?: string;
  theme?: string;
  layout?: string;
}

export const DefinitionListBlock: React.FC<DefinitionListBlockProps> = ({
  title,
  items,
  columns = 1,
  displayHint,
  theme = "default",
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set(displayHint === "expanded" ? Array.from({ length: items.length }, (_, i) => i) : [])
  );

  const toggleExpand = (idx: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedItems(newExpanded);
  };

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 lg:grid-cols-2",
    3: "grid-cols-1 lg:grid-cols-3",
  };

  return (
    <div className="my-6">
      {title && (
        <h3 className="text-2xl font-bold text-gray-100 mb-4">{title}</h3>
      )}

      <div className={`grid ${gridCols[columns]} gap-4`}>
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-all duration-300 hover:shadow-lg"
          >
            <div className="flex items-start gap-3 mb-3">
              {item.icon && (
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
              )}
              <h4 className="text-lg font-semibold text-white">{item.term}</h4>
            </div>

            {item.tags && item.tags.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 bg-blue-900 text-blue-200 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              {item.definition}
            </p>

            {item.characteristics && item.characteristics.length > 0 && (
              <div className="space-y-2">
                <button
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  onClick={() => toggleExpand(idx)}
                >
                  {expandedItems.has(idx) ? "▼" : "▶"} 
                  <span>Details</span>
                </button>
                {expandedItems.has(idx) && (
                  <ul className="space-y-1 ml-4">
                    {item.characteristics.map((char, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        <span>{char}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DefinitionListBlock;
