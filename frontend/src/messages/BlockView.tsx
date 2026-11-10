import { memo } from "react";
import { parseBlock } from "@/chat/blocks.ts";
import type { Block } from "@/chat/protocol.ts";
import { BlockErrorBoundary } from "./BlockErrorBoundary.tsx";
import { Markdown } from "./Markdown.tsx";
import { TableView } from "./TableView.tsx";
import { ToolCallView } from "./ToolCallView.tsx";
import { UnknownBlockView } from "./UnknownBlockView.tsx";

/** One Block, validated against its declared type and isolated from its siblings' failures. */
export const BlockView = memo(({ block }: { block: Block }) => (
  <BlockErrorBoundary resetKey={block}>
    <BlockContent block={block} />
  </BlockErrorBoundary>
));

const BlockContent = ({ block }: { block: Block }) => {
  const parsed = parseBlock(block);
  switch (parsed.kind) {
    case "markdown":
      return <Markdown text={parsed.text} />;
    case "tool_call":
      return <ToolCallView {...parsed} />;
    case "table":
      return <TableView {...parsed} />;
    case "unknown":
      return <UnknownBlockView {...parsed} />;
  }
};
