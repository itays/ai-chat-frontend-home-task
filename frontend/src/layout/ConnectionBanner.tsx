import { Spinner } from "@/components/ui/spinner";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import { RetryButton } from "./RetryButton.tsx";

/**
 * Says the server is out of reach while the Chats already listed stay on
 * screen. The status line is always mounted, so screen readers announce its
 * text when it appears.
 */
export const ConnectionBanner = () => {
  const connection = useChatState((state) => state.connection);
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-b bg-muted px-4 py-2 text-sm text-muted-foreground has-[p:empty]:hidden">
      <p role="status" className="flex items-center gap-2">
        {connection === "reconnecting" && (
          <>
            <Spinner aria-hidden="true" className="size-3.5" />
            Reconnecting to server…
          </>
        )}
        {/* Connected again, but the chat list could not be reloaded. */}
        {connection === "unavailable" && "Couldn't refresh your chats"}
      </p>
      {connection === "unavailable" && (
        <RetryButton size="xs" variant="outline" />
      )}
    </div>
  );
};
