import type { Socket } from "socket.io-client";
import type { Ack, Chat } from "../src/chat/protocol.ts";

// The backend Playwright starts for E2E, shared by the config and specs that drive it directly.
export const BACKEND_PORT = 4100;
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

/** Reads a Chat's Snapshot straight from the backend, bypassing the app. */
export const getChat = async (
  socket: Socket,
  chatId: string
): Promise<Chat> => {
  const ack: Ack<{ chat: Chat }> = await socket.emitWithAck("chat:get", {
    chatId,
  });
  if (!ack.ok) throw new Error(ack.error.message);
  return ack.chat;
};
