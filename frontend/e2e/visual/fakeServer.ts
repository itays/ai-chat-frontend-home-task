import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type {
  Ack,
  Chat,
  ProtocolErrorCode,
  RequestFrame,
  RequestName,
  ServerEventName,
  ServerFrame,
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

const readPayload = (payload: unknown) =>
  (typeof payload === "object" && payload !== null ? payload : {}) as Record<
    string,
    unknown
  >;

const send = (socket: WebSocket, frame: ServerFrame) =>
  socket.send(JSON.stringify(frame));

const answer = (
  name: RequestName,
  payload: unknown
): Ack<Record<string, unknown>> => {
  switch (name) {
    case "chats:list":
      return {
        ok: true,
        chats: chats.map(({ id, title, status, updatedAt }) => ({
          id,
          title,
          status,
          updatedAt,
        })),
      };
    case "chat:get": {
      const chat = findChat(readPayload(payload).chatId);
      return chat ? { ok: true, chat } : rejection("UNKNOWN_CHAT");
    }
    // Rejects like the real backend; an accepted Message starts no Turn.
    case "message:send": {
      const { chatId, text } = readPayload(payload);
      const chat = findChat(chatId);
      if (!chat) return rejection("UNKNOWN_CHAT");
      if (chat.status === "finished") return rejection("CHAT_FINISHED");
      if (chat.status === "responding") return rejection("CHAT_RESPONDING");
      if (String(text).trim() !== chat.suggestion) {
        return rejection("UNEXPECTED_MESSAGE");
      }
      return { ok: true, messageId: `${chatId}-sent` };
    }
  }
};

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
      for (const socket of sockets.clients) socket.terminate();
      break;
    case "/control/emit": {
      const { name, ...payload } = await readEmitRequest(request);
      const chat = findChat(payload.chatId);
      if (!chat) {
        response.writeHead(404).end();
        return;
      }
      chat.seq += 1;
      for (const socket of sockets.clients) {
        send(socket, {
          type: "event",
          name,
          event: { ...payload, seq: chat.seq },
        } as ServerFrame);
      }
      break;
    }
    default:
      response.writeHead(404).end();
      return;
  }
  response.writeHead(204).end();
});

const sockets = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url !== "/ws" || refusingConnections) {
    // Refused before the handshake, so the client sees a failed connect.
    socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
    return;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => {
    ws.on("message", (data) => {
      const { id, name, payload } = JSON.parse(String(data)) as RequestFrame;
      send(ws, { type: "ack", id, ack: answer(name, payload) });
    });
  });
});

httpServer.listen(FAKE_SERVER_PORT, "127.0.0.1", () => {
  console.log(`Fake chat server listening on port ${FAKE_SERVER_PORT}`);
});
