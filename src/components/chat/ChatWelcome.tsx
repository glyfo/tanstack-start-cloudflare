import type { ChatTip } from "@/types/chatflow-types";

interface ChatWelcomeProps {
  tips: ChatTip[];
  onTipClick: (example: string) => void;
}

export function ChatWelcome({ tips, onTipClick }: ChatWelcomeProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-20">
          <h2 className="text-4xl font-bold text-slate-900 mb-2">SuperHuman</h2>
          <p className="text-slate-600 mb-12">What can I help you with?</p>

          {/* Quick suggestion buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
            {tips.slice(0, 4).map((tip) => (
              <button
                key={tip.title}
                onClick={() => onTipClick(tip.examples[0])}
                className="p-3 text-left border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all text-sm"
              >
                <div className="font-medium text-slate-900">{tip.title}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {tip.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
