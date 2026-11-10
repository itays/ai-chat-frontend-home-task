import type { ChatStatus } from "./protocol.ts";
import { latestSummary, type ChatStoreState } from "./store.ts";

/**
 * What the user is told about reaching the server. Once Chats are listed they
 * stay on screen and the banner reports trouble; before that, an unreachable
 * server leaves nothing to show but the error.
 */
export type ConnectionView =
  | "ok"
  | "unreachable"
  | "reconnecting"
  /** Connected again, but the chat list could not be reloaded. */
  | "refresh-failed";

export const selectConnectionView = ({
  connection,
  listed,
}: ChatStoreState): ConnectionView => {
  if (connection === "connected" || connection === "connecting") {
    return "ok";
  }
  if (!listed) {
    return "unreachable";
  }
  return connection === "reconnecting" ? "reconnecting" : "refresh-failed";
};

export type SendAvailability = { ok: true } | { ok: false; reason: string };

const SEND = {
  ok: { ok: true },
  disconnected: { ok: false, reason: "Wait for the connection to come back" },
  stale: { ok: false, reason: "Reload this chat before sending" },
  responding: { ok: false, reason: "Wait for the assistant to finish" },
} as const satisfies Record<string, SendAvailability>;

const sendFor = (
  connected: boolean,
  stale: boolean,
  status: ChatStatus
): SendAvailability => {
  if (!connected) {
    return SEND.disconnected;
  }
  if (stale) {
    // Its events are no longer applied, so a sent Message would never show.
    return SEND.stale;
  }
  return status === "responding" ? SEND.responding : SEND.ok;
};

/** What the user sees of one Chat, and whether they can send to it. */
export type ChatView =
  | { kind: "none" | "not-found"; title?: never }
  | { kind: "loading"; title?: string }
  | { kind: "failed"; title: string }
  | {
      kind: "ready";
      title: string;
      status: ChatStatus;
      /** Refreshing its Snapshot failed, so events are no longer applied. */
      stale: boolean;
      suggestion: string | null;
      send: SendAvailability;
    };

/**
 * Every field is a primitive or a shared `SEND` instance, so under `useShallow`
 * a view stays equal while a response streams in.
 */
export const selectChatView =
  (chatId: string | null) =>
  ({ connection, listed, chats }: ChatStoreState): ChatView => {
    if (chatId === null) {
      return { kind: "none" };
    }
    // The id comes from the URL, so inherited keys like "constructor" must not match.
    if (!Object.hasOwn(chats, chatId)) {
      // Until the chat list arrives, an id cannot be told apart from an unknown one.
      return { kind: listed ? "not-found" : "loading" };
    }
    const entry = chats[chatId]!;
    const { title } = latestSummary(entry);
    const stale = entry.sync === "failed";
    if (!entry.chat) {
      return { kind: stale ? "failed" : "loading", title };
    }
    const { status, suggestion } = entry.chat;
    const send = sendFor(connection === "connected", stale, status);
    return { kind: "ready", title, status, stale, suggestion, send };
  };
