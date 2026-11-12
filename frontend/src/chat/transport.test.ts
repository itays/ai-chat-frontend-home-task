import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerFrame } from "./protocol.ts";
import {
  createSocketTransport,
  type ChatTransport,
  type TransportSignal,
} from "./transport.ts";

class FakeSocket extends EventTarget {
  static instances: FakeSocket[] = [];
  readonly url: string;
  sent: unknown[] = [];
  closed = false;

  constructor(url: URL) {
    super();
    this.url = url.href;
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.closed = true;
  }

  serverOpens() {
    this.dispatchEvent(new Event("open"));
  }

  serverCloses() {
    this.dispatchEvent(new Event("close"));
  }

  serverSends(data: ServerFrame | string) {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: typeof data === "string" ? data : JSON.stringify(data),
      })
    );
  }
}

const latestSocket = () => {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("No socket was opened");
  return socket;
};

const start = (url = "http://localhost:4000") => {
  const transport = createSocketTransport(url);
  const signals: TransportSignal[] = [];
  transport.subscribe((signal) => signals.push(signal));
  transport.connect();
  return { transport, signals };
};

const connected = () => {
  const started = start();
  latestSocket().serverOpens();
  started.signals.length = 0;
  return started;
};

const requestChats = (transport: ChatTransport) =>
  transport.request("chats:list", undefined);

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.useFakeTimers();
  // No jitter, so the backoff delays are exact.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createSocketTransport", () => {
  it.each([
    ["http://localhost:4000", "ws://localhost:4000/ws"],
    ["https://chat.example.com/app", "wss://chat.example.com/ws"],
  ])("connects %s on %s", (url, socketURL) => {
    start(url);

    expect(latestSocket().url).toBe(socketURL);
  });

  it("signals connect on open and disconnect when an open socket closes", () => {
    const { signals } = start();

    latestSocket().serverOpens();
    latestSocket().serverCloses();

    expect(signals).toEqual([{ type: "connect" }, { type: "disconnect" }]);
  });

  it("signals connect_error when a socket closes before it opens", () => {
    const { signals } = start();

    latestSocket().serverCloses();

    expect(signals).toEqual([{ type: "connect_error" }]);
  });

  it("reconnects with a doubling backoff capped at 5 s, reset by a successful open", () => {
    start();
    const waits: number[] = [];
    const failAndWait = () => {
      latestSocket().serverCloses();
      const socketCount = FakeSocket.instances.length;
      const startedAt = Date.now();
      vi.advanceTimersToNextTimer();
      expect(FakeSocket.instances).toHaveLength(socketCount + 1);
      waits.push(Date.now() - startedAt);
    };

    for (let attempt = 0; attempt < 5; attempt += 1) failAndWait();
    latestSocket().serverOpens();
    failAndWait();

    expect(waits).toEqual([1_000, 2_000, 4_000, 5_000, 5_000, 1_000]);
  });

  it("connect() cancels the backoff wait and tries again right away", () => {
    const { transport } = start();
    latestSocket().serverCloses();

    transport.connect();

    expect(FakeSocket.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("connect() replaces a pending socket and ignores its later close", () => {
    const { transport, signals } = start();
    const replaced = latestSocket();

    transport.connect();
    replaced.serverCloses();

    expect(replaced.closed).toBe(true);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(signals).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pairs acks with their requests and ignores unparseable frames", async () => {
    const { transport } = connected();
    const first = requestChats(transport);
    const second = transport.request("chat:get", { chatId: "a" });
    const socket = latestSocket();

    expect(socket.sent).toEqual([
      { id: 1, name: "chats:list" },
      { id: 2, name: "chat:get", payload: { chatId: "a" } },
    ]);
    socket.serverSends("not json");
    socket.serverSends({ type: "ack", id: 2, ack: { ok: true, chat: "b" } });
    socket.serverSends({ type: "ack", id: 1, ack: { ok: true, chats: [] } });

    await expect(second).resolves.toEqual({ ok: true, chat: "b" });
    await expect(first).resolves.toEqual({ ok: true, chats: [] });
  });

  it("signals each server event under its name", () => {
    const { signals } = connected();

    latestSocket().serverSends({
      type: "event",
      name: "chat:suggestion",
      event: { chatId: "a", seq: 3, suggestion: null },
    });

    expect(signals).toEqual([
      {
        type: "event",
        event: {
          name: "chat:suggestion",
          chatId: "a",
          seq: 3,
          suggestion: null,
        },
      },
    ]);
  });

  it("rejects requests while not connected", async () => {
    const { transport } = start();

    await expect(requestChats(transport)).rejects.toThrow("Not connected");
  });

  it("rejects pending requests when their socket closes", async () => {
    const { transport } = connected();
    const request = requestChats(transport);

    latestSocket().serverCloses();

    await expect(request).rejects.toThrow("closed");
  });

  it("rejects a request with no ack after 10 s", async () => {
    const { transport } = connected();
    const request = requestChats(transport);

    vi.advanceTimersByTime(10_000);

    await expect(request).rejects.toThrow("timed out");
  });
});
