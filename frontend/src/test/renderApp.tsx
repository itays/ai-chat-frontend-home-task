import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "@/App.tsx";
import {
  ChatClientProvider,
  type ChatClient,
} from "@/chat/ChatClientContext.tsx";
import { createChatStore, type ChatEntry } from "@/chat/store.ts";

/** Renders the whole app at `url`, connected, with `chats` already in the store. */
export const renderApp = ({
  url = "/",
  chats,
}: {
  url?: string;
  chats: Record<string, ChatEntry>;
}) => {
  window.history.replaceState(null, "", url);
  const store = createChatStore();
  store.setState({
    connection: "connected",
    chatOrder: Object.keys(chats),
    chats,
  });
  const client: ChatClient = {
    store,
    sync: { retry: vi.fn(), retryChat: vi.fn(), sendMessage: vi.fn() },
  };
  render(
    <ChatClientProvider client={client}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ChatClientProvider>
  );
  return { store };
};
