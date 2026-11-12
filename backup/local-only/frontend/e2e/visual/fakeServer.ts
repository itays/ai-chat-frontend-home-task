import { createServer, type IncomingMessage } from "node:http";
import { Server } from "socket.io";
import type {
  Ack,
  Chat,
  ProtocolErrorCode,
  ServerEventName,
} from "../../src/chat/protocol.ts";
import { FAKE_SERVER_PORT, FIXTURE_CHATS } from "./fixtures.ts";

/**
 * Serves the fixture Snapshots over the real protocol and never changes them
 * on its own (see ADR-0002). Tests steer it over HTTP:
 *
 * - `POST /control/reset` restores the fixtures and accepts connections again.
 * - `POST /control/drop` closes every connection and refuses new ones.
 * - `POST /control/emit` with `{ name, chatId, ...payload }` emits that event
 *   with the Chat's next `seq`. Only `seq` is tracked, so the Snapshot no longer
 *   reflects it: the test must not make the app refetch afterwards.
 */

let chats: Chat[] = structuredClone(FIXTURE_CHATS);
let refusingConnections = false;

const findChat = (chatId: unknown) => chats.find(({ id }) => id === chatId);

const rejection = (code: ProtocolErrorCode): Ack<never> => ({
  ok: false,
  error: { code, message: code },
});

const readEmitRequest = async (request: IncomingMessage) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body) as { name: ServerEventName; chatId: string };
};

const httpServer = createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(404).end();
    return;
  }
  switch (request.url) {
    case "/control/reset":
      chats = structuredClone(FIXTURE_CHATS);
      refusingConnections = false;
      break;
    case "/control/drop":
      refusingConnections = true;
      // Closing the transport, not the socket, so the client tries to reconnect.
      for (const socket of io.sockets.sockets.values()) socket.conn.close();
      break;
    case "/control/emit": {
      const { name, ...payload } = await readEmitRequest(request);
      const chat = findChat(payload.chatId);
      if (!chat) {
        response.writeHead(404).end();
        return;
      }
      chat.seq += 1;
      io.emit(name, { ...payload, seq: chat.seq });
      break;
    }
    default:
      response.writeHead(404).end();
      return;
  }
  response.writeHead(204).end();
});

const io = new Server(httpServer, {
  cors: { origin: /^http:\/\/127\.0\.0\.1(:\d+)?$/ },
  allowRequest: (_request, callback) => callback(null, !refusingConnections),
});

io.on("connection", (socket) => {
  socket.on("chats:list", (respond) =>
    respond({
      ok: true,
      chats: chats.map(({ id, title, status, updatedAt }) => ({
        id,
        title,
        status,
        updatedAt,
      })),
    })
  );

  socket.on("chat:get", ({ chatId }, respond) => {
    const chat = findChat(chatId);
    respond(chat ? { ok: true, chat } : rejection("UNKNOWN_CHAT"));
  });

  // Rejects like the real backend; an accepted Message starts no Turn.
  socket.on("message:send", ({ chatId, text }, respond) => {
    const chat = findChat(chatId);
    if (!chat) return respond(rejection("UNKNOWN_CHAT"));
    if (chat.status === "finished") return respond(rejection("CHAT_FINISHED"));
    if (chat.status === "responding") {
      return respond(rejection("CHAT_RESPONDING"));
    }
    if (String(text).trim() !== chat.suggestion) {
      return respond(rejection("UNEXPECTED_MESSAGE"));
    }
    respond({ ok: true, messageId: `${chatId}-sent` });
  });
});

httpServer.listen(FAKE_SERVER_PORT, "127.0.0.1", () => {
  console.log(`Fake chat server listening on port ${FAKE_SERVER_PORT}`);
});
