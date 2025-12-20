import React from "react";
import type { ProcessFlowSchema } from "@/types/content-schema";

interface ProcessFlowBlockProps extends ProcessFlowSchema {
  displayHint?: string;
  theme?: string;
  layout?: string;
}

export const ProcessFlowBlock: React.FC<ProcessFlowBlockProps> = ({
  title,
  description,
  steps,
  indicators = "numbered",
  theme = "default",
}) => {
  return (
    <div className="my-6">
      {title && (
        <h3 className="text-2xl font-bold text-gray-100 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-400 mb-6">{description}</p>
      )}

      <div className="space-y-0">
        {steps.map((step, idx) => (
          <div key={step.id} className="relative">
            <div className="flex gap-4">
              {/* Indicator */}
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0">
                  {indicators === "numbered" && <span>{idx + 1}</span>}
                  {indicators === "checkmark" && <span>✓</span>}
                  {indicators === "icon" && step.icon && <span>{step.icon}</span>}
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-1 h-20 bg-gradient-to-b from-blue-500 to-blue-700 my-2" />
                )}
              </div>

              {/* Content */}
              <div className="pb-8 pt-2 flex-1">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
                  <h4 className="text-lg font-semibold text-white mb-1">
                    {step.title}
                  </h4>
                  <p className="text-gray-300 text-sm mb-3">
                    {step.description}
                  </p>

                  {step.details && step.details.length > 0 && (
                    <ul className="space-y-1 ml-4">
                      {step.details.map((detail, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-400 flex items-start gap-2"
                        >
                          <span className="text-blue-400 mt-1">•</span>
                          <span>{detail}</span>
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
    </div>
  );
};

export default ProcessFlowBlock;
