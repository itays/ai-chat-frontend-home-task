import type { ChatStore } from './chatStore.ts';
import type { Conversations } from './conversations.ts';
import { failure } from './errors.ts';
import type { Ack, RequestName } from './protocol.ts';

const MAX_MESSAGE_LENGTH = 2_000;

export type RequestContext = {
  store: ChatStore;
  conversations: Conversations;
};

type Handler = (payload: unknown, context: RequestContext) => Ack<object>;

const readString = (payload: unknown, key: string): string | undefined => {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
};

const HANDLERS: Record<RequestName, Handler> = {
  'chats:list': (_payload, { store }) => ({ ok: true, chats: store.list() }),

  'chat:get': (payload, { store }) => {
    const chatId = readString(payload, 'chatId');
    if (chatId === undefined) {
      return failure('INVALID_REQUEST');
    }
    const chat = store.get(chatId);
    return chat ? { ok: true, chat } : failure('UNKNOWN_CHAT');
  },

  'message:send': (payload, { conversations }) => {
    const chatId = readString(payload, 'chatId');
    const text = readString(payload, 'text');
    if (
      chatId === undefined ||
      text === undefined ||
      text.length > MAX_MESSAGE_LENGTH
    ) {
      return failure('INVALID_REQUEST');
    }
    return conversations.send(chatId, text);
  },
};

const isRequestName = (name: unknown): name is RequestName =>
  typeof name === 'string' && Object.hasOwn(HANDLERS, name);

export const handleRequest = (
  context: RequestContext,
  name: unknown,
  payload: unknown,
): Ack<object> =>
  isRequestName(name)
    ? HANDLERS[name](payload, context)
    : failure('INVALID_REQUEST');
