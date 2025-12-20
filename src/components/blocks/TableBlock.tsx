import React, { useState } from "react";
import type { TableSchema } from "@/types/content-schema";

interface TableBlockProps extends TableSchema {
  displayHint?: string;
  theme?: string;
  layout?: string;
}

export const TableBlock: React.FC<TableBlockProps> = ({
  title,
  description,
  headers,
  rows,
  footer,
  sortable = true,
  filterable = true,
  theme = "default",
}) => {
  const [filterText, setFilterText] = useState("");

  const filteredRows = rows.filter((row) => {
    if (!filterText) return true;
    const searchLower = filterText.toLowerCase();
    return headers.some((header) => {
      const cell = row.cells[header.key];
      return String(cell?.value).toLowerCase().includes(searchLower);
    });
  });

  return (
    <div className="my-6">
      {title && (
        <h4 className="text-xl font-bold text-gray-100 mb-2">{title}</h4>
      )}
      {description && (
        <p className="text-gray-400 text-sm mb-4">{description}</p>
      )}

      {filterable && (
        <input
          type="text"
          placeholder="🔍 Filter table..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full mb-4 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              {headers.map((header) => (
                <th
                  key={header.key}
                  style={{ textAlign: header.align }}
                  className={`px-6 py-3 text-left text-sm font-semibold text-gray-200 ${
                    sortable ? "cursor-pointer hover:bg-gray-700 transition-colors" : ""
                  }`}
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors"
              >
                {headers.map((header) => {
                  const cell = row.cells[header.key];
                  return (
                    <td
                      key={header.key}
                      style={{ textAlign: header.align }}
                      className="px-6 py-4 text-sm text-gray-300"
                    >
                      {cell.type === "badge" ? (
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: cell.color || "#3b82f6" }}
                        >
                          {cell.value}
                        </span>
                      ) : (
                        cell.value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footer && <p className="text-gray-400 text-xs mt-3">{footer}</p>}
    </div>
  );
};

export default TableBlock;
