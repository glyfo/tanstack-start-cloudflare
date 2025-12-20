import React from "react";
import type { ContentSchema, StructuredMessage } from "@/types/content-schema";
import TextBlock from "./blocks/TextBlock";
import TableBlock from "./blocks/TableBlock";
import ListBlock from "./blocks/ListBlock";
import TimelineBlock from "./blocks/TimelineBlock";
import DefinitionListBlock from "./blocks/DefinitionListBlock";
import ProcessFlowBlock from "./blocks/ProcessFlowBlock";
import AlertBlock from "./blocks/AlertBlock";

interface ContentRendererProps {
  message: StructuredMessage;
}

export const ContentRenderer: React.FC<ContentRendererProps> = ({ message }) => {
  return (
    <div
      className={`content-renderer max-w-4xl ${
        message.metadata?.layout === "multi-column" ? "grid-cols-2 gap-6" : ""
      }`}
    >
      <div className="bg-linear-to-br from-gray-900 to-black rounded-lg border border-gray-800 p-6 space-y-4">
        {message.content.map((block, idx) => (
          <BlockRenderer key={`${message.id}-${idx}`} block={block} />
        ))}

        {message.metadata?.readTime && (
          <div className="mt-6 pt-4 border-t border-gray-700 text-center">
            <span className="text-xs text-gray-500">
              📖 Estimated read time: ~{message.metadata.readTime} min
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface BlockRendererProps {
  block: ContentSchema;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({ block }) => {
  const commonProps = {
    displayHint: block.metadata?.displayHint,
    theme: block.metadata?.theme,
  };

  switch (block.type) {
    case "text":
      return <TextBlock {...block} {...commonProps} />;
    case "table":
      return <TableBlock {...block} {...commonProps} />;
    case "list":
      return <ListBlock {...block} {...commonProps} />;
    case "timeline":
      return <TimelineBlock {...(block as any)} {...commonProps} />;
    case "definition-list":
      return <DefinitionListBlock {...(block as any)} {...commonProps} />;
    case "process-flow":
      return <ProcessFlowBlock {...(block as any)} {...commonProps} />;
    case "alert":
      return <AlertBlock {...(block as any)} {...commonProps} />;
    default:
      return null;
  }
};

export default ContentRenderer;
