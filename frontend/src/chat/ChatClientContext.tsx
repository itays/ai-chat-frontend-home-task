import { createContext, use, type ReactNode } from "react";
import { useStore } from "zustand";
import { createChatSync } from "./chatSync.ts";
import {
  createChatStore,
  type ChatStore,
  type ChatStoreState,
} from "./store.ts";
import { createSocketTransport, type ChatTransport } from "./transport.ts";

export type ChatClient = {
  store: ChatStore;
  sync: ReturnType<typeof createChatSync>;
};

/** Wires a transport to a fresh store and starts syncing. */
export const createChatClient = (transport: ChatTransport): ChatClient => {
  const store = createChatStore();
  const sync = createChatSync({ transport, store });
  transport.connect();
  return { store, sync };
};

export const createSocketChatClient = (url: string): ChatClient =>
  createChatClient(createSocketTransport(url));

const ChatClientContext = createContext<ChatClient | null>(null);

export const ChatClientProvider = ({
  client,
  children,
}: {
  client: ChatClient;
  children: ReactNode;
}) => <ChatClientContext value={client}>{children}</ChatClientContext>;

const useChatClient = (): ChatClient => {
  const client = use(ChatClientContext);
  if (!client) {
    throw new Error("useChatClient must be used inside <ChatClientProvider>");
  }
  return client;
};

/** Subscribes to a slice of chat state; re-renders only when the slice changes. */
export const useChatState = <T,>(selector: (state: ChatStoreState) => T): T =>
  useStore(useChatClient().store, selector);

/** The actions components can trigger: sending messages and retrying failed syncs. */
export const useChatActions = () => useChatClient().sync;
