import { CloudOffIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useChatActions } from "@/chat/ChatClientContext.tsx";

/** Shown in place of the app when the server can't be reached or can't list the chats. */
export const ServerUnavailable = () => {
  const { retry } = useChatActions();
  const [retrying, setRetrying] = useState(false);

  return (
    <main className="flex h-svh">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CloudOffIcon />
          </EmptyMedia>
          <EmptyTitle role="heading" aria-level={1}>
            Can't reach the server
          </EmptyTitle>
          <EmptyDescription>
            Your chats will appear as soon as the connection is back. We keep
            trying in the background.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
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
        </EmptyContent>
      </Empty>
    </main>
  );
};
