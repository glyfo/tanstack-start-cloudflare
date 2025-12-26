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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log('[ChatInput] Input changed', { valueLen: value.length, preview: value.substring(0, 50) });
    onInputChange(value);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    console.log('[ChatInput] Form submitted', { inputLen: input.length, isLoading });
    onSubmit(e);
  };

  return (
    <div className="border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-6 bg-white">
      <form onSubmit={handleFormSubmit} className="max-w-2xl mx-auto">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                console.log('[ChatInput] Enter key pressed');
                e.preventDefault();
                handleFormSubmit(e as any);
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
            onClick={() => console.log('[ChatInput] Send button clicked')}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
