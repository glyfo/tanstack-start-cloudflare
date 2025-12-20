import React from "react";
import type { TimelineSchema } from "@/types/content-schema";

interface TimelineBlockProps extends TimelineSchema {
  displayHint?: string;
  theme?: string;
}

export const TimelineBlock: React.FC<TimelineBlockProps> = ({
  title,
  events,
  layout = "vertical",
  showConnector = true,
}) => {
  return (
    <div className="my-6">
      {title && (
        <h3 className="text-2xl font-bold text-gray-100 mb-4">{title}</h3>
      )}

      <div className={`timeline-${layout}`}>
        {layout === "vertical" ? (
          <div className="space-y-0">
            {events.map((event, idx) => (
              <div key={idx} className="relative">
                <div className="flex gap-4">
                  {/* Timeline marker */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-gray-900"
                      style={{ color: event.color || "inherit" }}
                    >
                      {event.icon || event.step}
                    </div>
                    {showConnector && idx < events.length - 1 && (
                      <div className="w-0.5 h-20 bg-gradient-to-b from-blue-500 to-transparent my-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-8 pt-1 flex-1">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-colors">
                      <h4 className="text-base font-semibold text-white">
                        {event.label}
                      </h4>
                      {event.description && (
                        <p className="text-sm text-gray-300 mt-1">
                          {event.description}
                        </p>
                      )}
                      {event.duration && (
                        <p className="text-xs text-gray-500 mt-1">
                          ⏱️ {event.duration}
                        </p>
                      )}
                      {event.details && event.details.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {event.details.map((detail, i) => (
                            <li key={i} className="text-xs text-gray-400">
                              • {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Horizontal layout
          <div className="flex gap-4 overflow-x-auto pb-4">
            {events.map((event, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 w-64 bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-white font-semibold text-xs mb-2 bg-gray-900"
                  style={{ color: event.color || "inherit" }}
                >
                  {event.icon || event.step}
                </div>
                <h4 className="text-sm font-semibold text-white">
                  {event.label}
                </h4>
                {event.description && (
                  <p className="text-xs text-gray-300 mt-1">
                    {event.description}
                  </p>
                )}
                {event.duration && (
                  <p className="text-xs text-gray-500 mt-1">
                    ⏱️ {event.duration}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineBlock;
