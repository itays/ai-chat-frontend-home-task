import { Spinner } from "@/components/ui/spinner";
import { useChatState } from "@/chat/ChatClientContext.tsx";

/**
 * Says the connection dropped while the socket reconnects. Always mounted, so
 * screen readers announce the text when it appears.
 */
export const ConnectionBanner = () => {
  const reconnecting = useChatState(
    (state) => state.connection === "reconnecting"
  );
  return (
    <p
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 border-b bg-muted px-4 py-2 text-sm text-muted-foreground empty:hidden"
    >
      {reconnecting && (
        <>
          <Spinner aria-hidden="true" className="size-3.5" />
          Reconnecting to server…
        </>
      )}
    </p>
  );
};
