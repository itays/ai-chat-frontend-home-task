import type { ReactElement } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import { selectConnectionView, type ConnectionView } from "@/chat/chatView.ts";
import { RetryButton } from "./RetryButton.tsx";

const statusLine = (
  connection: ConnectionView
): ReactElement | string | null => {
  switch (connection) {
    case "ok":
    case "unreachable": // The app shows a full-page error instead.
      return null;
    case "reconnecting":
      return (
        <>
          <Spinner aria-hidden="true" className="size-3.5" />
          Reconnecting to server…
        </>
      );
    case "refresh-failed":
      return "Couldn't refresh your chats";
  }
};

/**
 * Says the server is out of reach while the Chats already listed stay on
 * screen. The status line is always mounted, so screen readers announce its
 * text when it appears.
 */
export const ConnectionBanner = () => {
  const connection = useChatState(selectConnectionView);
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-b bg-muted px-4 py-2 text-sm text-muted-foreground has-[p:empty]:hidden">
      <p role="status" className="flex items-center gap-2">
        {statusLine(connection)}
      </p>
      {connection === "refresh-failed" && (
        <RetryButton size="xs" variant="outline" />
      )}
    </div>
  );
};
