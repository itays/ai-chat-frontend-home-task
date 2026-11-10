import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import type { ChatStoreState } from "@/chat/store.ts";

/** Completed assistant Messages per Chat id. */
type CompletedResponseCounts = Record<string, number>;

/** Completed assistant Messages per loaded Chat; changes only when a response completes. */
const selectCompletedResponses = ({
  chats,
}: ChatStoreState): CompletedResponseCounts =>
  Object.fromEntries(
    Object.entries(chats).flatMap(([chatId, { chat }]) =>
      chat
        ? [
            [
              chatId,
              chat.messages.filter(
                ({ role, status }) =>
                  role === "assistant" && status === "completed"
              ).length,
            ],
          ]
        : []
    )
  );

/**
 * A Chat's count is seen when its first Snapshot loads and whenever it is selected.
 * A lower count (the backend restarted) resets the baseline.
 * Returns `seen` itself when nothing changed.
 */
const updateSeen = (
  seen: CompletedResponseCounts,
  completed: CompletedResponseCounts,
  selectedChatId: string | null
): CompletedResponseCounts => {
  let next = seen;
  for (const [chatId, count] of Object.entries(completed)) {
    const previous = seen[chatId];
    const isSeen =
      chatId === selectedChatId || previous === undefined || count < previous;
    if (isSeen && previous !== count) {
      next = { ...next, [chatId]: count };
    }
  }
  return next;
};

/**
 * Tells whether a Chat has a response that completed while it was not selected.
 * Kept in memory only: a refresh treats everything as read.
 */
export const useIsUnread = (
  selectedChatId: string | null
): ((chatId: string) => boolean) => {
  const completed = useChatState(useShallow(selectCompletedResponses));
  const [seen, setSeen] = useState<CompletedResponseCounts>({});
  const nextSeen = updateSeen(seen, completed, selectedChatId);
  if (nextSeen !== seen) {
    // Adjusting state during render, as React recommends for derived updates.
    setSeen(nextSeen);
  }
  return (chatId) =>
    chatId !== selectedChatId &&
    (completed[chatId] ?? 0) > (nextSeen[chatId] ?? Infinity);
};
