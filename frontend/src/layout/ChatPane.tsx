import { MessageSquareIcon, SearchXIcon } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { useShallow } from "zustand/shallow";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useChatActions, useChatState } from "@/chat/ChatClientContext.tsx";
import type { ChatStatus } from "@/chat/protocol.ts";
import { latestSummary, type ChatStoreState } from "@/chat/store.ts";
import { Composer } from "@/composer/Composer.tsx";
import { createComposerStore } from "@/composer/composerStore.ts";
import { MessageList } from "@/messages/MessageList.tsx";
import { ResponseAnnouncer } from "./ResponseAnnouncer.tsx";

type Pane =
  | { view: "none" | "not-found"; title?: never }
  | { view: "loading"; title?: string }
  | { view: "ready"; title: string; status: ChatStatus };

const selectPane =
  (chatId: string | null) =>
  ({ chatOrder, chats }: ChatStoreState): Pane => {
    if (chatId === null) {
      return { view: "none" };
    }
    // The id comes from the URL, so inherited keys like "constructor" must not match.
    if (Object.hasOwn(chats, chatId)) {
      const entry = chats[chatId]!;
      const { title, status } = latestSummary(entry);
      return entry.chat
        ? { view: "ready", title, status }
        : { view: "loading", title };
    }
    // Until the chat list arrives, an id cannot be told apart from an unknown one.
    return { view: chatOrder.length === 0 ? "loading" : "not-found" };
  };

/** The main area: the selected Chat, or a placeholder explaining why none is shown. */
export const ChatPane = ({ chatId }: { chatId: string | null }) => {
  const pane = useChatState(useShallow(selectPane(chatId)));
  const { title } = pane;
  const { sendMessage } = useChatActions();
  // Owned here, above the per-Chat Composer, so drafts and sends survive switching Chats.
  const [composer] = useState(() => createComposerStore(sendMessage));

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
        {title && <h1 className="truncate text-base font-medium">{title}</h1>}
      </header>
      {pane.view === "none" && (
        <PaneMessage
          icon={<MessageSquareIcon />}
          title="Select a chat"
          description="Pick a chat from the sidebar to see its messages and continue it."
        />
      )}
      {pane.view === "not-found" && (
        <PaneMessage
          icon={<SearchXIcon />}
          title="Chat not found"
          description="This link points to a chat that doesn't exist. Pick one from the sidebar."
        />
      )}
      {pane.view === "loading" && <ChatSkeleton />}
      {pane.view === "ready" && chatId !== null && (
        // Keyed so each Chat opens at its latest Message, and a response
        // already under way when it opens is not announced.
        <Fragment key={chatId}>
          <MessageList chatId={chatId} />
          {pane.status === "finished" ? (
            <p className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 pb-6 text-center text-sm text-muted-foreground">
              This chat is finished
            </p>
          ) : (
            <Composer chatId={chatId} composer={composer} />
          )}
          <ResponseAnnouncer status={pane.status} />
        </Fragment>
      )}
    </>
  );
};

const PaneMessage = ({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">{icon}</EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
  </Empty>
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
