import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
  isLoading?: boolean;
}

/**
 * Render text content with proper markdown support
 * - Headers (# ## ###)
 * - Bold (**text**)
 * - Italic (*text*)
 * - Lists (numbered and bullets)
 * - Code blocks with syntax highlighting
 * - Blockquotes
 * - Tables (GitHub Flavored Markdown)
 */
export function MarkdownMessage({ content, isLoading }: MarkdownMessageProps) {
  return (
    <div className="prose prose-invert max-w-none prose-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold text-black mb-3 mt-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold text-black mb-2 mt-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold text-black mb-2 mt-2" {...props} />
          ),

          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="text-black mb-2 leading-relaxed" {...props} />
          ),

          // Lists
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside text-black mb-2 space-y-1 ml-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside text-black mb-2 space-y-1 ml-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-black" {...props} />
          ),

          // Code
          code: ({ node, inline, className, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-gray-900 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
              );
            }
            return (
              <code className="block bg-gray-100 text-black p-3 rounded-lg overflow-x-auto mb-2 font-mono text-sm" {...props} />
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-100 text-black p-3 rounded-lg overflow-x-auto mb-2 font-mono text-sm" {...props} />
          ),

          // Blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 italic text-black my-2 py-1" {...props} />
          ),

          // Links
          a: ({ node, ...props }) => (
            <a className="text-blue-400 hover:text-blue-300 underline" {...props} />
          ),

          // Bold & Italic
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-black" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-black" {...props} />
          ),

          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="border-gray-700 my-3" {...props} />
          ),

          // Tables (GitHub Flavored Markdown)
          table: ({ node, ...props }) => (
            <table className="border-collapse w-full mb-2 border border-gray-700" {...props} />
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-800" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="border border-gray-700" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-700 px-3 py-2 text-left text-black font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-700 px-3 py-2 text-black" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {isLoading && (
        <div className="mt-2 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
          <span className="text-xs text-black">Streaming response...</span>
        </div>
      )}
    </div>
  );
}
