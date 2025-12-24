/**
 * Enhanced Typing Indicator
 * Animated loading state with text feedback
 * Increases user engagement by providing clear feedback
 */

import type { TypingIndicatorProps } from "@/types/chatflow-types"

export function TypingIndicator({ message = "SuperHuman is thinking..." }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 shadow-sm">
        {/* Animated dots */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        
        {/* Text feedback */}
        <span className="text-sm font-medium text-slate-600">{message}</span>
      </div>
    </div>
  )
}
