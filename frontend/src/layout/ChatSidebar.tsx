import { memo } from "react";
import { useShallow } from "zustand/shallow";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import type { ChatStatus } from "@/chat/protocol.ts";
import { latestSummary } from "@/chat/store.ts";
import { selectChat } from "./selectedChat.ts";
import { formatAge, useNow } from "./relativeTime.ts";
import { useIsUnread } from "./useIsUnread.ts";

const STATUS_LABELS: Record<ChatStatus, string> = {
  idle: "Idle",
  responding: "Responding",
  finished: "Finished",
};

export const ChatSidebar = ({
  selectedChatId,
}: {
  selectedChatId: string | null;
}) => {
  const chatOrder = useChatState((state) => state.chatOrder);
  const isUnread = useIsUnread(selectedChatId);
  const now = useNow();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Chats">
              <SidebarMenu>
                {chatOrder.map((chatId) => (
                  <ChatSidebarItem
                    key={chatId}
                    chatId={chatId}
                    selected={chatId === selectedChatId}
                    unread={isUnread(chatId)}
                    now={now}
                  />
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

const ChatSidebarItem = memo(
  ({
    chatId,
    selected,
    unread,
    now,
  }: {
    chatId: string;
    selected: boolean;
    unread: boolean;
    now: number;
  }) => {
    const { setOpenMobile } = useSidebar();
    const summary = useChatState(
      useShallow(({ chats }) => {
        const entry = chats[chatId];
        return entry ? latestSummary(entry) : undefined;
      })
    );
    if (!summary) {
      return null;
    }
    const { title, status, updatedAt } = summary;

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-auto flex-col items-start gap-0.5"
          isActive={selected}
          aria-current={selected ? "page" : undefined}
          onClick={() => {
            selectChat(chatId);
            setOpenMobile(false);
          }}
        >
          <span className="flex w-full items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {unread && (
              <span className="ml-auto size-2 shrink-0 rounded-full bg-primary">
                <span className="sr-only">New response</span>
              </span>
            )}
          </span>
          <span className="flex w-full items-center gap-1 text-xs text-muted-foreground">
            {status === "responding" && (
              <Spinner aria-hidden="true" className="size-3" />
            )}
            {STATUS_LABELS[status]}
            <span aria-hidden="true">·</span>
            <time dateTime={updatedAt}>{formatAge(updatedAt, now)}</time>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
);
