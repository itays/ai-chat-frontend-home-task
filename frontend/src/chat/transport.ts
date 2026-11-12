import {
  SERVER_EVENT_NAMES,
  type Ack,
  type RequestFrame,
  type RequestMap,
  type RequestName,
  type ServerEvent,
  type ServerFrame,
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
  /** Starts a connection attempt right away, cancelling any pending one. */
  connect(): void;
};

type Connection =
  | { phase: "idle" }
  | { phase: "connecting"; socket: WebSocket }
  | { phase: "open"; socket: WebSocket }
  | { phase: "waiting"; timer: ReturnType<typeof setTimeout> };

type PendingRequest = {
  resolve: (ack: Ack<unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const REQUEST_TIMEOUT_MS = 10_000;
// Socket.IO's reconnection defaults, kept from before the move to plain WebSockets.
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 5_000;
const RECONNECT_JITTER = 0.5;

const reconnectDelay = (attempt: number) => {
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
  const jitter = (Math.random() * 2 - 1) * RECONNECT_JITTER * delay;
  return Math.min(delay + jitter, RECONNECT_MAX_MS);
};

const toSocketURL = (url: string) => {
  const socketURL = new URL("/ws", url);
  socketURL.protocol = socketURL.protocol === "https:" ? "wss:" : "ws:";
  return socketURL;
};

const parseFrame = (data: unknown): ServerFrame | undefined => {
  try {
    return JSON.parse(String(data)) as ServerFrame;
  } catch {
    return undefined;
  }
};

export const createSocketTransport = (url: string): ChatTransport => {
  const socketURL = toSocketURL(url);
  const listeners = new Set<(signal: TransportSignal) => void>();
  const notify = (signal: TransportSignal) =>
    listeners.forEach((listener) => listener(signal));

  let connection: Connection = { phase: "idle" };
  let failedAttempts = 0;
  let lastRequestId = 0;
  const pending = new Map<number, PendingRequest>();

  const settle = (id: number, outcome: Ack<unknown> | Error) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    clearTimeout(request.timer);
    if (outcome instanceof Error) {
      request.reject(outcome);
    } else {
      request.resolve(outcome);
    }
  };

  // Acks only ever arrive on the socket that carried the request.
  const rejectPending = () => {
    for (const id of [...pending.keys()]) {
      settle(id, new Error("The connection closed before the ack arrived"));
    }
  };

  const isCurrent = (socket: WebSocket) =>
    (connection.phase === "connecting" || connection.phase === "open") &&
    connection.socket === socket;

  const receive = (data: unknown) => {
    const frame = parseFrame(data);
    if (frame?.type === "ack") {
      settle(frame.id, frame.ack);
    } else if (
      frame?.type === "event" &&
      (SERVER_EVENT_NAMES as readonly string[]).includes(frame.name)
    ) {
      notify({
        type: "event",
        event: { ...frame.event, name: frame.name } as ServerEvent,
      });
    }
  };

  const scheduleReconnect = () => {
    const timer = setTimeout(open, reconnectDelay(failedAttempts));
    failedAttempts += 1;
    connection = { phase: "waiting", timer };
  };

  const open = () => {
    const socket = new WebSocket(socketURL);
    connection = { phase: "connecting", socket };
    socket.addEventListener("open", () => {
      if (!isCurrent(socket)) return;
      connection = { phase: "open", socket };
      failedAttempts = 0;
      notify({ type: "connect" });
    });
    socket.addEventListener("message", ({ data }) => {
      if (isCurrent(socket)) receive(data);
    });
    // An error event is always followed by close, so close covers both.
    socket.addEventListener("close", () => {
      if (!isCurrent(socket)) return;
      const wasOpen = connection.phase === "open";
      rejectPending();
      scheduleReconnect();
      notify({ type: wasOpen ? "disconnect" : "connect_error" });
    });
  };

  return {
    request: (name, payload) => {
      if (connection.phase !== "open") {
        return Promise.reject(new Error("Not connected"));
      }
      const { socket } = connection;
      const id = ++lastRequestId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => settle(id, new Error(`${name} timed out`)),
          REQUEST_TIMEOUT_MS
        );
        pending.set(id, {
          resolve: resolve as PendingRequest["resolve"],
          reject,
          timer,
        });
        socket.send(
          JSON.stringify({ id, name, payload } satisfies RequestFrame)
        );
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: () => {
      failedAttempts = 0;
      if (connection.phase === "waiting") {
        clearTimeout(connection.timer);
      } else if (connection.phase !== "idle") {
        rejectPending();
        connection.socket.close();
      }
      open();
    },
  };
};
