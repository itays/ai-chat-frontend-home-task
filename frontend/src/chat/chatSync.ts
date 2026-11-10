import type {
  Chat,
  ChatSummary,
  ProtocolErrorCode,
  RequestMap,
  RequestName,
  ServerEvent,
} from "./protocol.ts";
import { applyEvent } from "./reducer.ts";
import type { ChatEntry, ChatStore } from "./store.ts";
import type { ChatTransport } from "./transport.ts";

export type SendResult =
  | { ok: true }
  | { ok: false; reason: ProtocolErrorCode | "TIMEOUT" | "DISCONNECTED" };

/**
 * Keeps the store in step with the backend (see ADR-0001): on every connect it
 * lists the chats and replaces each one with a fresh Snapshot, buffering
 * events that arrive before their Snapshot and refetching on a Gap.
 */
export const createChatSync = ({
  transport,
  store,
}: {
  transport: ChatTransport;
  store: ChatStore;
}) => {
  /** Bumped on every connect so responses from an earlier connection are ignored. */
  let generation = 0;
  /** Events held per chat while its Snapshot is in flight. */
  let buffers = new Map<string, ServerEvent[]>();
  /** True between connecting and receiving the chat list, when every event is buffered. */
  let listing = false;
  let everConnected = false;
  let socketConnected = false;
  /** Resolvers for retries waiting on the outcome of the next connection or listing attempt. */
  let pendingRetries: (() => void)[] = [];
  const settleRetries = () => {
    pendingRetries.forEach((settle) => settle());
    pendingRetries = [];
  };

  /** Sends a request, resolving to null if no acknowledgement arrives. */
  const request = <N extends RequestName>(
    name: N,
    payload: RequestMap[N]["payload"]
  ) => transport.request(name, payload).catch(() => null);

  const updateEntry = (chatId: string, update: Partial<ChatEntry>) =>
    store.setState(({ chats }) => {
      const entry = chats[chatId];
      return entry
        ? { chats: { ...chats, [chatId]: { ...entry, ...update } } }
        : {};
    });

  /** Applies events in order, stopping at the first Gap. */
  const applyAll = (
    chat: Chat,
    events: ServerEvent[]
  ): { chat: Chat; gap: boolean } => {
    let current = chat;
    for (const event of events) {
      const result = applyEvent(current, event);
      if (result.kind === "gap") {
        return { chat: current, gap: true };
      }
      if (result.kind === "applied") {
        current = result.chat;
      }
    }
    return { chat: current, gap: false };
  };

  const loadSnapshot = async (chatId: string) => {
    const startedIn = generation;
    if (!buffers.has(chatId)) {
      buffers.set(chatId, []);
    }
    updateEntry(chatId, { sync: "loading" });
    const ack = await request("chat:get", { chatId });
    if (startedIn !== generation) {
      return;
    }
    const buffered = buffers.get(chatId) ?? [];
    buffers.delete(chatId);
    if (!ack?.ok) {
      updateEntry(chatId, { sync: "failed" });
      return;
    }
    const { chat, gap } = applyAll(ack.chat, buffered);
    updateEntry(chatId, { chat, sync: "ready" });
    if (gap) {
      void loadSnapshot(chatId);
    }
  };

  const syncAll = async () => {
    const startedIn = generation;
    listing = true;
    const ack = await request("chats:list", undefined);
    settleRetries();
    if (startedIn !== generation) {
      return;
    }
    listing = false;
    if (!ack?.ok) {
      buffers = new Map();
      store.setState({ connection: "unavailable" });
      return;
    }
    store.setState(({ chats }) => ({
      connection: "connected",
      listed: true,
      chatOrder: ack.chats.map(({ id }) => id),
      chats: Object.fromEntries(
        ack.chats.map((summary: ChatSummary) => [
          summary.id,
          { summary, chat: chats[summary.id]?.chat ?? null, sync: "loading" },
        ])
      ),
    }));
    ack.chats.forEach(({ id }) => void loadSnapshot(id));
  };

  const receive = (event: ServerEvent) => {
    const buffer = buffers.get(event.chatId);
    if (buffer) {
      buffer.push(event);
      return;
    }
    if (listing) {
      buffers.set(event.chatId, [event]);
      return;
    }
    const entry = store.getState().chats[event.chatId];
    if (entry?.sync !== "ready" || !entry.chat) {
      return;
    }
    const { chat, gap } = applyAll(entry.chat, [event]);
    if (gap) {
      void loadSnapshot(event.chatId);
    } else {
      updateEntry(event.chatId, { chat });
    }
  };

  transport.subscribe((signal) => {
    switch (signal.type) {
      case "connect":
        generation += 1;
        buffers = new Map();
        everConnected = true;
        socketConnected = true;
        void syncAll();
        return;
      case "disconnect":
        socketConnected = false;
        store.setState({ connection: "reconnecting" });
        return;
      case "connect_error":
        store.setState({
          connection: everConnected ? "reconnecting" : "unavailable",
        });
        settleRetries();
        return;
      case "event":
        receive(signal.event);
        return;
    }
  });

  return {
    /**
     * Recovers from an unavailable server: relists if connected, otherwise
     * reconnects. Settles once that attempt succeeds or fails.
     */
    retry: () =>
      new Promise<void>((settle) => {
        pendingRetries.push(settle);
        if (socketConnected) {
          void syncAll();
        } else {
          transport.connect();
        }
      }),
    retryChat: (chatId: string) => void loadSnapshot(chatId),
    sendMessage: async (chatId: string, text: string): Promise<SendResult> => {
      if (!socketConnected) {
        return { ok: false, reason: "DISCONNECTED" };
      }
      const ack = await request("message:send", { chatId, text });
      if (!ack) {
        return { ok: false, reason: "TIMEOUT" };
      }
      return ack.ok ? { ok: true } : { ok: false, reason: ack.error.code };
    },
  };
};
