interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ChatInput({
  input,
  isLoading,
  onInputChange,
  onSubmit,
}: ChatInputProps) {
  return (
    <div className="border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-6 bg-white">
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as any);
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 bg-slate-50 text-slate-900 rounded-lg px-4 py-3 border border-slate-200 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-200 placeholder-slate-500 text-sm transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg px-4 py-3 font-medium transition-colors disabled:cursor-not-allowed text-sm shrink-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
