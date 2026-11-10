import { createServer, type Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { ChatStore } from './chatStore.ts';
import { Conversations } from './conversations.ts';
import { failure } from './errors.ts';
import { createDelay } from './player.ts';
import type { ChatScript } from './script.ts';

const LOCAL_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

const MAX_MESSAGE_LENGTH = 2_000;

const readString = (payload: unknown, key: string): string | undefined => {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
};

const withAck =
  (handle: (payload: unknown) => unknown) =>
  (...args: unknown[]): void => {
    const ack = args.at(-1);
    if (typeof ack !== 'function') {
      return;
    }
    ack(handle(args.length > 1 ? args[0] : undefined));
  };

const registerHandlers = (
  socket: Socket,
  store: ChatStore,
  conversations: Conversations,
): void => {
  socket.on(
    'chats:list',
    withAck(() => ({ ok: true, chats: store.list() })),
  );

  socket.on(
    'chat:get',
    withAck((payload) => {
      const chatId = readString(payload, 'chatId');
      if (chatId === undefined) {
        return failure('INVALID_REQUEST');
      }
      const chat = store.get(chatId);
      return chat ? { ok: true, chat } : failure('UNKNOWN_CHAT');
    }),
  );

  socket.on(
    'message:send',
    withAck((payload) => {
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
    }),
  );
};

export type ChatServer = {
  httpServer: HttpServer;
  io: Server;
};

export const createChatServer = ({
  scripts,
  delayScale,
}: {
  scripts: ChatScript[];
  delayScale: number;
}): ChatServer => {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: LOCAL_ORIGINS } });
  const store = new ChatStore((name, event) => io.emit(name, event));
  const conversations = new Conversations(
    scripts,
    store,
    createDelay(delayScale),
  );

  io.on('connection', (socket) =>
    registerHandlers(socket, store, conversations),
  );

  return { httpServer, io };
};
