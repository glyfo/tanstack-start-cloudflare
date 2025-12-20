import React from "react";
import type { ListSchema } from "@/types/content-schema";

interface ListBlockProps extends ListSchema {
  displayHint?: string;
  theme?: string;
}

export const ListBlock: React.FC<ListBlockProps> = ({
  title,
  items,
  style = "bullet",
}) => {
  const getMarker = (depth: number) => {
    switch (style) {
      case "numbered":
        return null; // Use ol tag
      case "checkmark":
        return <span className="text-green-400 font-bold">✓</span>;
      case "bullet":
      default:
        return <span className="text-blue-400">•</span>;
    }
  };

  const renderItem = (item: any, depth = 0, index = 0) => {
    const ListTag = style === "numbered" ? "ol" : "ul";
    const itemMargin = depth > 0 ? "ml-6" : "";

    return (
      <li
        key={item.id || item.label}
        className={`text-gray-300 mb-2 flex gap-2 ${itemMargin}`}
      >
        {style !== "numbered" && getMarker(depth)}
        {style === "numbered" && (
          <span className="text-blue-400 font-semibold">{index + 1}.</span>
        )}
        <div className="flex-1">
          <span className="font-medium">{item.label}</span>
          {item.description && (
            <p className="text-gray-400 text-sm mt-1">{item.description}</p>
          )}
          {item.children && item.children.length > 0 && (
            <ListTag className="mt-2 space-y-2">
              {item.children.map((child, idx) =>
                renderItem(child, depth + 1, idx)
              )}
            </ListTag>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="my-4">
      {title && (
        <h3 className="text-xl font-bold text-gray-100 mb-3">{title}</h3>
      )}
      {style === "numbered" ? (
        <ol className="space-y-2">
          {items.map((item, idx) => renderItem(item, 0, idx))}
        </ol>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => renderItem(item))}
        </ul>
      )}
    </div>
  );
};

export default ListBlock;
