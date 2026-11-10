import { MessageSquareIcon, SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";
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
import { useChatState } from "@/chat/ChatClientContext.tsx";
import { latestSummary, type ChatStoreState } from "@/chat/store.ts";

type PaneView = "none" | "not-found" | "loading" | "ready";

const selectPane =
  (chatId: string | null) =>
  ({
    chatOrder,
    chats,
  }: ChatStoreState): { view: PaneView; title?: string } => {
    if (chatId === null) {
      return { view: "none" };
    }
    // The id comes from the URL, so inherited keys like "constructor" must not match.
    if (Object.hasOwn(chats, chatId)) {
      const entry = chats[chatId]!;
      return {
        view: entry.chat ? "ready" : "loading",
        title: latestSummary(entry).title,
      };
    }
    // Until the chat list arrives, an id cannot be told apart from an unknown one.
    return { view: chatOrder.length === 0 ? "loading" : "not-found" };
  };

/** The main area: the selected Chat, or a placeholder explaining why none is shown. */
export const ChatPane = ({ chatId }: { chatId: string | null }) => {
  const { view, title } = useChatState(useShallow(selectPane(chatId)));

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
        {title && <h1 className="truncate text-base font-medium">{title}</h1>}
      </header>
      {view === "none" && (
        <PaneMessage
          icon={<MessageSquareIcon />}
          title="Select a chat"
          description="Pick a chat from the sidebar to see its messages and continue it."
        />
      )}
      {view === "not-found" && (
        <PaneMessage
          icon={<SearchXIcon />}
          title="Chat not found"
          description="This link points to a chat that doesn't exist. Pick one from the sidebar."
        />
      )}
      {view === "loading" && <ChatSkeleton />}
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
