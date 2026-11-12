import type {
  Ack,
  Chat,
  RequestFrame,
  RequestMap,
  RequestName,
  ServerFrame,
} from "../src/chat/protocol.ts";

// The backend Playwright starts for E2E, shared by the config and specs that drive it directly.
export const BACKEND_PORT = 4100;
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

export type BackendConnection = {
  request<N extends RequestName>(
    name: N,
    payload: RequestMap[N]["payload"]
  ): Promise<Ack<RequestMap[N]["response"]>>;
  close(): void;
};

/** Opens a WebSocket to the E2E backend, bypassing the app. */
export const connectToBackend = async (): Promise<BackendConnection> => {
  const socket = new WebSocket(`ws://127.0.0.1:${BACKEND_PORT}/ws`);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map<number, (ack: Ack<unknown>) => void>();
  let lastId = 0;
  socket.addEventListener("message", ({ data }) => {
    const frame = JSON.parse(String(data)) as ServerFrame;
    if (frame.type === "ack") {
      pending.get(frame.id)?.(frame.ack);
      pending.delete(frame.id);
    }
  });
  return {
    request: (name, payload) =>
      new Promise((resolve) => {
        const id = ++lastId;
        pending.set(id, resolve as (ack: Ack<unknown>) => void);
        socket.send(
          JSON.stringify({ id, name, payload } satisfies RequestFrame)
        );
      }),
    close: () => socket.close(),
  };
};

/** Reads a Chat's Snapshot straight from the backend. */
export const getChat = async (
  backend: BackendConnection,
  chatId: string
): Promise<Chat> => {
  const ack = await backend.request("chat:get", { chatId });
  if (!ack.ok) throw new Error(ack.error.message);
  return ack.chat;
};
