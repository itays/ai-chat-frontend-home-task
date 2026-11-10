import { CircleCheckIcon, CircleXIcon, Loader2Icon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { ToolCallBlock, ToolCallStatus } from "@/chat/blocks.ts";

const STATUS_DISPLAY: Record<
  ToolCallStatus,
  { label: string; icon: typeof Loader2Icon; className: string }
> = {
  running: {
    label: "Running",
    icon: Loader2Icon,
    className: "animate-spin text-muted-foreground",
  },
  succeeded: {
    label: "Succeeded",
    icon: CircleCheckIcon,
    className: "text-emerald-600",
  },
  failed: { label: "Failed", icon: CircleXIcon, className: "text-destructive" },
};

/** An action the assistant performs; the status is spoken as text, not only shown as an icon. */
export const ToolCallView = ({ title, status, summary }: ToolCallBlock) => {
  const titleId = useId();
  const { label, icon: Icon, className } = STATUS_DISPLAY[status];
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      data-status={status}
      className="flex w-fit max-w-full min-w-0 flex-col gap-0.5 rounded-lg border bg-card px-3 py-2 text-sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />
        <span id={titleId} className="min-w-0 font-medium wrap-break-word">
          {title}
        </span>
        <span className="sr-only">{label}</span>
      </div>
      {summary && (
        <p
          className={cn(
            "pl-6 wrap-break-word text-muted-foreground",
            status === "failed" && "text-destructive"
          )}
        >
          {summary}
        </p>
      )}
    </div>
  );
};
