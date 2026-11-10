import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useChatActions } from "@/chat/ChatClientContext.tsx";

/** Retries reaching the server, showing progress until that attempt succeeds or fails. */
export const RetryButton = (
  props: Pick<ComponentProps<typeof Button>, "size" | "variant">
) => {
  const { retry } = useChatActions();
  const [retrying, setRetrying] = useState(false);
  return (
    <Button
      {...props}
      disabled={retrying}
      onClick={async () => {
        setRetrying(true);
        await retry();
        setRetrying(false);
      }}
    >
      {retrying && <Spinner aria-hidden="true" />}
      {retrying ? "Retrying…" : "Retry"}
    </Button>
  );
};
