import { useSyncExternalStore } from "react";

// The selected Chat lives in the URL (`?chat=<id>`) so it survives a refresh
// and works with back/forward; there is no router.

const CHAT_PARAM = "chat";
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
};

const readSelectedChatId = () =>
  new URLSearchParams(window.location.search).get(CHAT_PARAM);

/** The id in `?chat=`, or null when no Chat is selected. It may name no known Chat. */
export const useSelectedChatId = (): string | null =>
  useSyncExternalStore(subscribe, readSelectedChatId);

export const selectChat = (chatId: string) => {
  if (readSelectedChatId() === chatId) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set(CHAT_PARAM, chatId);
  window.history.pushState(null, "", url);
  listeners.forEach((listener) => listener());
};
