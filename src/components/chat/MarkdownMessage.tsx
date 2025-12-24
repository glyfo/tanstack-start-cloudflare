import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { MarkdownMessageProps } from "@/types/chatflow-types"

/**
 * Markdown Message Renderer
 * Renders markdown content with basic formatting for chat
 */
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => <h1 className="text-2xl font-bold text-black mb-2 mt-3" {...props} />,
          h2: ({ ...props }) => <h2 className="text-xl font-bold text-black mb-2 mt-2" {...props} />,
          h3: ({ ...props }) => <h3 className="text-lg font-semibold text-black mb-1 mt-2" {...props} />,
          p: ({ ...props }) => <p className="text-black mb-2 leading-relaxed text-sm" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc list-inside text-black mb-2 space-y-1 ml-2" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal list-inside text-black mb-2 space-y-1 ml-2" {...props} />,
          li: ({ ...props }) => <li className="text-black text-sm" {...props} />,
          code: ({ inline, ...props }: any) => 
            inline ? (
              <code className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
            ) : (
              <code className="block bg-slate-100 text-slate-900 p-3 rounded-lg overflow-x-auto mb-2 font-mono text-xs" {...props} />
            ),
          strong: ({ ...props }) => <strong className="font-bold text-black" {...props} />,
          em: ({ ...props }) => <em className="italic text-black" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
