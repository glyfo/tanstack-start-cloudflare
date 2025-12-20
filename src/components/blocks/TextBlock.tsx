import React from "react";
import type { TextSchema } from "@/types/content-schema";

interface TextBlockProps extends TextSchema {
  displayHint?: string;
  theme?: string;
}

export const TextBlock: React.FC<TextBlockProps> = ({
  content,
  format = "markdown",
  style = "body",
}) => {
  if (format === "markdown") {
    // Simple markdown parsing for headings
    if (style === "heading-1") {
      return (
        <h1 className="text-4xl font-bold text-white mb-4 mt-6">
          {content.replace(/^#+\s/, "")}
        </h1>
      );
    }
    if (style === "heading-2") {
      return (
        <h2 className="text-3xl font-bold text-gray-100 mb-3 mt-5">
          {content.replace(/^#+\s/, "")}
        </h2>
      );
    }
    if (style === "heading-3") {
      return (
        <h3 className="text-2xl font-semibold text-gray-200 mb-2 mt-4">
          {content.replace(/^#+\s/, "")}
        </h3>
      );
    }
    if (style === "quote") {
      return (
        <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 text-gray-300 italic bg-gray-900 rounded-r">
          {content}
        </blockquote>
      );
    }
  }

  return (
    <p className="text-gray-300 leading-relaxed mb-3 text-base">
      {content}
    </p>
  );
};

export default TextBlock;
