/**
 * QualificationStatus Component
 *
 * Displays lead qualification status in the chat UI
 */

import { useState } from "react";

export interface QualificationData {
  score: number;  // 0-100
  classification: "cold" | "warm" | "hot" | "qualified" | "disqualified";
  phase: string;
  progress: number;  // 0-100
  missingFields: string[];
}

interface QualificationStatusProps {
  data: QualificationData;
}

export function QualificationStatus({ data }: QualificationStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Classification colors
  const classificationStyles = {
    cold: "bg-gray-100 text-gray-700 border-gray-200",
    warm: "bg-yellow-50 text-yellow-700 border-yellow-200",
    hot: "bg-orange-50 text-orange-700 border-orange-200",
    qualified: "bg-green-50 text-green-700 border-green-200",
    disqualified: "bg-red-50 text-red-700 border-red-200",
  };

  const classificationLabels = {
    cold: "Cold Lead",
    warm: "Warm Lead",
    hot: "Hot Lead",
    qualified: "Qualified",
    disqualified: "Disqualified",
  };

  // Score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 55) return "text-orange-600";
    if (score >= 35) return "text-yellow-600";
    return "text-gray-600";
  };

  return (
    <div className="border border-gray-200 rounded mb-3 overflow-hidden bg-white">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Qualification
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded border ${classificationStyles[data.classification]}`}
          >
            {classificationLabels[data.classification]}
          </span>
          <span className={`text-sm font-mono font-semibold ${getScoreColor(data.score)}`}>
            {data.score}/100
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Qualification Progress</span>
              <span className="text-xs font-mono text-gray-900">{data.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>

          {/* Conversation Phase */}
          <div className="mb-3">
            <span className="text-xs text-gray-500">Current Phase</span>
            <div className="text-sm font-medium text-gray-900 mt-1 capitalize">
              {data.phase.replace(/_/g, " ")}
            </div>
          </div>

          {/* Missing Fields */}
          {data.missingFields && data.missingFields.length > 0 && (
            <div>
              <span className="text-xs text-gray-500">Missing BANT Fields</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {data.missingFields.map((field) => (
                  <span
                    key={field}
                    className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded uppercase"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fully Qualified Message */}
          {data.missingFields.length === 0 && data.score >= 75 && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <span className="text-xs text-green-700 font-medium">
                Lead fully qualified and ready for proposal
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
