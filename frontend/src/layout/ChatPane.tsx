import {
  MessageSquareIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { useShallow } from "zustand/shallow";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useChatActions, useChatState } from "@/chat/ChatClientContext.tsx";
import { selectChatView } from "@/chat/chatView.ts";
import { Composer } from "@/composer/Composer.tsx";
import { createComposerStore } from "@/composer/composerStore.ts";
import { MessageList } from "@/messages/MessageList.tsx";
import { PaneMessage } from "./PaneMessage.tsx";
import { ResponseAnnouncer } from "./ResponseAnnouncer.tsx";

/** The main area: the selected Chat, or a placeholder explaining why none is shown. */
export const ChatPane = ({ chatId }: { chatId: string | null }) => {
  const view = useChatState(useShallow(selectChatView(chatId)));
  const { title } = view;
  const { sendMessage, retryChat } = useChatActions();
  // Owned here, above the per-Chat Composer, so drafts and sends survive switching Chats.
  const [composer] = useState(() => createComposerStore(sendMessage));

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
        {title && <h1 className="truncate text-base font-medium">{title}</h1>}
      </header>
      {view.kind === "none" && (
        <PaneMessage
          icon={<MessageSquareIcon />}
          title="Select a chat"
          description="Pick a chat from the sidebar to see its messages and continue it."
        />
      )}
      {view.kind === "not-found" && (
        <PaneMessage
          icon={<SearchXIcon />}
          title="Chat not found"
          description="This link points to a chat that doesn't exist. Pick one from the sidebar."
        />
      )}
      {view.kind === "loading" && <ChatSkeleton />}
      {view.kind === "failed" && chatId !== null && (
        <PaneMessage
          icon={<TriangleAlertIcon />}
          title="Couldn't load this chat"
          description="Something went wrong while fetching its messages."
          action={<Button onClick={() => retryChat(chatId)}>Retry</Button>}
        />
      )}
      {view.kind === "ready" && chatId !== null && (
        // Keyed so each Chat opens at its latest Message, and a response
        // already under way when it opens is not announced.
        <Fragment key={chatId}>
          {view.stale && <StaleChatAlert onRetry={() => retryChat(chatId)} />}
          <MessageList chatId={chatId} />
          {view.status === "finished" ? (
            <p className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 pb-6 text-center text-sm text-muted-foreground">
              This chat is finished
            </p>
          ) : (
            <Composer
              chatId={chatId}
              composer={composer}
              suggestion={view.suggestion}
              send={view.send}
            />
          )}
          <ResponseAnnouncer status={view.status} />
        </Fragment>
      )}
    </>
  );
};

const StaleChatAlert = ({ onRetry }: { onRetry: () => void }) => (
  <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-4">
    <Alert>
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle>This chat may be out of date</AlertTitle>
      <AlertDescription>New messages couldn't be loaded.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </AlertAction>
    </Alert>
  </div>
);

const ChatSkeleton = () => (
  <div
    role="status"
    aria-label="Loading chat"
    className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4"
  >
    <Skeleton className="h-16 w-3/4" />
    <Skeleton className="h-24 w-2/3" />
    <Skeleton className="ml-auto h-10 w-1/2" />
  </div>
);
