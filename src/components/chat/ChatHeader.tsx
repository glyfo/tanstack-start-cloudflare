import { X } from "lucide-react";

interface ChatHeaderProps {
  title: string;
  onClearHistory: () => void;
}

export function ChatHeader({ title, onClearHistory }: ChatHeaderProps) {
  return (
    <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <button
        onClick={onClearHistory}
        className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
        title="Clear history"
      >
        <X size={20} />
      </button>
    </div>
  );
}
