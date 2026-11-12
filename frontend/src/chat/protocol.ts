// Wire types for the backend contract described in backend/PROTOCOL.md.

export type ChatStatus = "idle" | "responding" | "finished";

export type ChatSummary = {
  id: string;
  title: string;
  status: ChatStatus;
  updatedAt: string;
};

/** Blocks are untrusted: any `type` may arrive, and fields beyond `id` and `type` are unspecified. */
export type Block = {
  id: string;
  type: string;
  [field: string]: unknown;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  status: "streaming" | "completed";
  blocks: Block[];
  createdAt: string;
};

export type Chat = ChatSummary & {
  messages: Message[];
  suggestion: string | null;
  seq: number;
};

export type ProtocolErrorCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_CHAT"
  | "UNEXPECTED_MESSAGE"
  | "CHAT_RESPONDING"
  | "CHAT_FINISHED";

export type ProtocolError = {
  code: ProtocolErrorCode;
  message: string;
};

export type Ack<T> = ({ ok: true } & T) | { ok: false; error: ProtocolError };

export type RequestMap = {
  "chats:list": { payload: undefined; response: { chats: ChatSummary[] } };
  "chat:get": { payload: { chatId: string }; response: { chat: Chat } };
  "message:send": {
    payload: { chatId: string; text: string };
    response: { messageId: string };
  };
};

export type RequestName = keyof RequestMap;

/** What the client sends on `/ws`; the server answers with an ack of the same `id`. */
export type RequestFrame = {
  id: number;
  name: RequestName;
  payload?: unknown;
};

type ServerEventPayloads = {
  "chat:status": { status: ChatStatus; updatedAt: string };
  "chat:suggestion": { suggestion: string | null };
  "message:created": { message: Message };
  "block:created": { messageId: string; block: Block };
  "block:delta": { messageId: string; blockId: string; text: string };
  "block:updated": { messageId: string; block: Block };
  "message:completed": { messageId: string };
};

export type ServerEventName = keyof ServerEventPayloads;

export const SERVER_EVENT_NAMES = [
  "chat:status",
  "chat:suggestion",
  "message:created",
  "block:created",
  "block:delta",
  "block:updated",
  "message:completed",
] as const satisfies readonly ServerEventName[];

/** A server event tagged with the event name it arrived under. */
export type ServerEvent = {
  [N in ServerEventName]: {
    name: N;
    chatId: string;
    seq: number;
  } & ServerEventPayloads[N];
}[ServerEventName];

/** What the server sends on `/ws`. */
export type ServerFrame =
  | { type: "ack"; id: number; ack: Ack<Record<string, unknown>> }
  | {
      [N in ServerEventName]: {
        type: "event";
        name: N;
        event: { chatId: string; seq: number } & ServerEventPayloads[N];
      };
    }[ServerEventName];
