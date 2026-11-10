import { ChevronRightIcon, PuzzleIcon } from "lucide-react";
import type { UnknownBlock } from "@/chat/blocks.ts";

/** Content this client cannot display: named by its type, with the raw data on request. */
export const UnknownBlockView = ({ type, raw }: UnknownBlock) => (
  <details className="group/unknown w-full max-w-full min-w-0 rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
      <PuzzleIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 wrap-break-word">
        Unsupported content ·{" "}
        <code className="font-mono text-foreground">{type}</code>
      </span>
      <ChevronRightIcon
        aria-hidden="true"
        className="size-4 shrink-0 transition-transform group-open/unknown:rotate-90"
      />
    </summary>
    <pre className="max-h-64 overflow-auto border-t px-3 py-2 font-mono text-xs">
      {JSON.stringify(raw, null, 2)}
    </pre>
  </details>
);
