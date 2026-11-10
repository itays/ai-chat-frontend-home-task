import { createStore } from "zustand/vanilla";
import type { Chat, ChatSummary } from "./protocol.ts";

/**
 * - `connecting`: never connected yet.
 * - `unavailable`: the first connection attempt failed (the socket keeps
 *   retrying), or the chat list could not be loaded.
 * - `reconnecting`: was connected and lost the connection.
 *
 * What the user is told depends on `listed` as well; see `selectConnectionView`.
 */
export type ConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "unavailable";

export type ChatEntry = {
  summary: ChatSummary;
  /** The latest Snapshot with every applied event, or null before the first one arrives. */
  chat: Chat | null;
  /** `loading` while a Snapshot request is in flight, `failed` if it errored. */
  sync: "loading" | "ready" | "failed";
};

export type ChatStoreState = {
  connection: ConnectionStatus;
  /**
   * True once a chat list has arrived. Never reset: a later reconnect replaces
   * the Chats, so the ones listed stay on screen until then.
   */
  listed: boolean;
  chatOrder: string[];
  chats: Record<string, ChatEntry>;
};

export const createChatStore = () =>
  createStore<ChatStoreState>()(() => ({
    connection: "connecting",
    listed: false,
    chatOrder: [],
    chats: {},
  }));

export type ChatStore = ReturnType<typeof createChatStore>;

/** The freshest summary of a Chat: from its Snapshot once loaded, else from the chat list. */
export const latestSummary = ({ summary, chat }: ChatEntry): ChatSummary => {
  const { id, title, status, updatedAt } = chat ?? summary;
  return { id, title, status, updatedAt };
};
