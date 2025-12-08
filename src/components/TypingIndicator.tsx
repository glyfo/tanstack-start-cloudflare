export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg px-4 py-3 bg-white/5 border border-white/10">
        <div className="flex space-x-2">
          <div className="w-2.5 h-2.5 bg-white/40 rounded-full animate-bounce" />
          <div className="w-2.5 h-2.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-2.5 h-2.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  )
}
