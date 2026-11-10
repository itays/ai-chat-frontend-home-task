import { io } from "socket.io-client";
import {
  SERVER_EVENT_NAMES,
  type Ack,
  type RequestMap,
  type RequestName,
  type ServerEvent,
} from "./protocol.ts";

export type TransportSignal =
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "connect_error" }
  | { type: "event"; event: ServerEvent };

/** The narrow view of the socket that chatSync depends on. */
export type ChatTransport = {
  /** Resolves with the acknowledgement; rejects if none arrives in time. */
  request<N extends RequestName>(
    name: N,
    payload: RequestMap[N]["payload"]
  ): Promise<Ack<RequestMap[N]["response"]>>;
  subscribe(listener: (signal: TransportSignal) => void): () => void;
  connect(): void;
};

const REQUEST_TIMEOUT_MS = 10_000;

export const createSocketTransport = (url: string): ChatTransport => {
  const socket = io(url, { autoConnect: false });
  const listeners = new Set<(signal: TransportSignal) => void>();
  const notify = (signal: TransportSignal) =>
    listeners.forEach((listener) => listener(signal));

  socket.on("connect", () => notify({ type: "connect" }));
  socket.on("disconnect", () => notify({ type: "disconnect" }));
  socket.on("connect_error", () => notify({ type: "connect_error" }));
  for (const name of SERVER_EVENT_NAMES) {
    socket.on(name, (payload: Omit<ServerEvent, "name">) =>
      notify({ type: "event", event: { ...payload, name } as ServerEvent })
    );
  }

  return {
    request: (name, payload) => {
      const timed = socket.timeout(REQUEST_TIMEOUT_MS);
      return payload === undefined
        ? timed.emitWithAck(name)
        : timed.emitWithAck(name, payload);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: () => {
      socket.connect();
    },
  };
};
