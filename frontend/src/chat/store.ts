import { createStore } from "zustand/vanilla";
import type { Chat, ChatSummary } from "./protocol.ts";

/**
 * - `connecting`: never connected yet.
 * - `unavailable`: the first connection attempt failed (the socket keeps
 *   retrying), or the chat list could not be loaded.
 * - `reconnecting`: was connected and lost the connection.
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
  chatOrder: string[];
  chats: Record<string, ChatEntry>;
};

export const createChatStore = () =>
  createStore<ChatStoreState>()(() => ({
    connection: "connecting",
    chatOrder: [],
    chats: {},
  }));

export type ChatStore = ReturnType<typeof createChatStore>;
