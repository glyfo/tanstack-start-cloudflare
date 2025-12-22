export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg px-4 py-3 bg-white text-black border border-white">
        <div className="flex space-x-2">
          <div className="w-2.5 h-2.5 bg-black/40 rounded-full opacity-60" />
          <div className="w-2.5 h-2.5 bg-black/40 rounded-full opacity-60" />
          <div className="w-2.5 h-2.5 bg-black/40 rounded-full opacity-60" />
        </div>
      </div>
    </div>
  )
}
