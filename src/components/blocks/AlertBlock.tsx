import React from "react";
import type { AlertSchema } from "@/types/content-schema";

interface AlertBlockProps extends AlertSchema {
  displayHint?: string;
  theme?: string;
}

export const AlertBlock: React.FC<AlertBlockProps> = ({
  level = "info",
  title,
  message,
  icon,
  action,
}) => {
  const levelStyles = {
    info: "bg-blue-900/20 border-blue-700/50 text-blue-200",
    warning: "bg-yellow-900/20 border-yellow-700/50 text-yellow-200",
    error: "bg-red-900/20 border-red-700/50 text-red-200",
    success: "bg-green-900/20 border-green-700/50 text-green-200",
  };

  const iconBgStyles = {
    info: "bg-blue-900/40 text-blue-400",
    warning: "bg-yellow-900/40 text-yellow-400",
    error: "bg-red-900/40 text-red-400",
    success: "bg-green-900/40 text-green-400",
  };

  const buttonStyles = {
    info: "bg-blue-600 hover:bg-blue-700 text-white",
    warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
    error: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
  };

  return (
    <div
      className={`my-4 border rounded-lg p-4 ${levelStyles[level]}`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${iconBgStyles[level]}`}
          >
            {icon}
          </div>
        )}

        <div className="flex-1">
          {title && (
            <h4 className="font-semibold text-base mb-1">{title}</h4>
          )}
          <p className="text-sm opacity-90">{message}</p>

          {action && (
            <div className="mt-3">
              {action.link ? (
                <a
                  href={action.link}
                  className={`inline-block px-4 py-2 rounded font-medium text-sm transition-colors ${buttonStyles[level]}`}
                >
                  {action.label}
                </a>
              ) : (
                <button
                  className={`px-4 py-2 rounded font-medium text-sm transition-colors ${buttonStyles[level]}`}
                  onClick={() => action.callback}
                >
                  {action.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertBlock;
