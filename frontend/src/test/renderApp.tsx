import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "@/App.tsx";
import {
  ChatClientProvider,
  type ChatClient,
} from "@/chat/ChatClientContext.tsx";
import {
  createChatStore,
  type ChatEntry,
  type ConnectionStatus,
} from "@/chat/store.ts";

/**
 * Renders the whole app at `url`, connected unless told otherwise, with
 * `chats` already in the store and listed unless there are none.
 */
export const renderApp = ({
  url = "/",
  chats,
  connection = "connected",
  listed = Object.keys(chats).length > 0,
}: {
  url?: string;
  chats: Record<string, ChatEntry>;
  connection?: ConnectionStatus;
  listed?: boolean;
}) => {
  window.history.replaceState(null, "", url);
  const store = createChatStore();
  store.setState({
    connection,
    listed,
    chatOrder: Object.keys(chats),
    chats,
  });
  const sync = {
    retry: vi.fn<ChatClient["sync"]["retry"]>(() => Promise.resolve()),
    retryChat: vi.fn<ChatClient["sync"]["retryChat"]>(),
    sendMessage: vi.fn<ChatClient["sync"]["sendMessage"]>(),
  };
  const client: ChatClient = { store, sync };
  render(
    <ChatClientProvider client={client}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ChatClientProvider>
  );
  return { store, sync };
};
