import { CloudOffIcon } from "lucide-react";
import { PaneMessage } from "./PaneMessage.tsx";
import { RetryButton } from "./RetryButton.tsx";

/** Shown in place of the app while no chats could be listed because the server is out of reach. */
export const ServerUnavailable = () => (
  <main className="flex h-svh">
    <PaneMessage
      level={1}
      icon={<CloudOffIcon />}
      title="Can't reach the server"
      description="Your chats will appear once it responds. Check that the chat server is running, then retry."
      action={<RetryButton />}
    />
  </main>
);
