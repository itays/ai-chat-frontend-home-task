import { describe, expect, it } from "vitest";
import { createChatSync } from "./chatSync.ts";
import type {
  Ack,
  Chat,
  ChatSummary,
  RequestMap,
  RequestName,
  ServerEvent,
} from "./protocol.ts";
import { createChatStore } from "./store.ts";
import type { ChatTransport, TransportSignal } from "./transport.ts";

type PendingRequest = {
  name: RequestName;
  payload: unknown;
  resolve: (ack: Ack<Record<string, unknown>>) => void;
  reject: (error: Error) => void;
};

/** An in-memory transport whose requests stay pending until the test answers them. */
const createFakeTransport = () => {
  const listeners = new Set<(signal: TransportSignal) => void>();
  const pending: PendingRequest[] = [];

  const transport: ChatTransport = {
    request: <N extends RequestName>(
      name: N,
      payload: RequestMap[N]["payload"]
    ) =>
      new Promise<Ack<RequestMap[N]["response"]>>((resolve, reject) => {
        pending.push({
          name,
          payload,
          resolve: resolve as (ack: Ack<Record<string, unknown>>) => void,
          reject,
        });
      }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: () => {},
  };

  const take = (
    name: RequestName,
    payload?: unknown,
    which: "oldest" | "newest" = "oldest"
  ): PendingRequest => {
    const find = which === "oldest" ? "findIndex" : "findLastIndex";
    const index = pending[find](
      (request) =>
        request.name === name &&
        (payload === undefined ||
          JSON.stringify(request.payload) === JSON.stringify(payload))
    );
    const [request] = index === -1 ? [] : pending.splice(index, 1);
    if (!request) {
      throw new Error(
        `No pending ${name} request for ${JSON.stringify(payload)}`
      );
    }
    return request;
  };

  return {
    transport,
    signal: (signal: TransportSignal) => listeners.forEach((l) => l(signal)),
    event: (event: ServerEvent) =>
      listeners.forEach((l) => l({ type: "event", event })),
    answer: async (
      name: RequestName,
      payload: unknown,
      ack: Ack<Record<string, unknown>>
    ) => {
      take(name, payload).resolve(ack);
      await flush();
    },
    answerNewest: async (
      name: RequestName,
      payload: unknown,
      ack: Ack<Record<string, unknown>>
    ) => {
      take(name, payload, "newest").resolve(ack);
      await flush();
    },
    fail: async (name: RequestName, payload: unknown, error: Error) => {
      take(name, payload).reject(error);
      await flush();
    },
    pendingNames: () => pending.map(({ name, payload }) => ({ name, payload })),
  };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const summary = (id: string): ChatSummary => ({
  id,
  title: `Chat ${id}`,
  status: "idle",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const snapshot = (id: string, overrides: Partial<Chat> = {}): Chat => ({
  ...summary(id),
  messages: [],
  suggestion: "Hi",
  seq: 5,
  ...overrides,
});

const setup = () => {
  const fake = createFakeTransport();
  const store = createChatStore();
  const sync = createChatSync({ transport: fake.transport, store });
  return { fake, store, sync };
};

/** Connects and answers the initial list and every Snapshot request. */
const connectWith = async (
  fake: ReturnType<typeof createFakeTransport>,
  chats: Chat[]
) => {
  fake.signal({ type: "connect" });
  await fake.answer("chats:list", undefined, {
    ok: true,
    chats: chats.map(({ id, title, status, updatedAt }) => ({
      id,
      title,
      status,
      updatedAt,
    })),
  });
  for (const chat of chats) {
    await fake.answer("chat:get", { chatId: chat.id }, { ok: true, chat });
  }
};

describe("initial sync", () => {
  it("lists the chats and loads every Snapshot on connect", async () => {
    const { fake, store } = setup();
    const a = snapshot("a");
    const b = snapshot("b", { status: "finished" });

    await connectWith(fake, [a, b]);

    const state = store.getState();
    expect(state.connection).toBe("connected");
    expect(state.chatOrder).toEqual(["a", "b"]);
    expect(state.chats.a).toEqual({
      summary: summary("a"),
      chat: a,
      sync: "ready",
    });
    expect(state.chats.b?.chat).toEqual(b);
  });
});

const suggestionEvent = (
  chatId: string,
  seq: number,
  suggestion: string | null
): ServerEvent => ({ name: "chat:suggestion", chatId, seq, suggestion });

describe("events", () => {
  it("applies live events to a loaded chat", async () => {
    const { fake, store } = setup();
    await connectWith(fake, [snapshot("a", { seq: 5 })]);

    fake.event(suggestionEvent("a", 6, null));

    expect(store.getState().chats.a?.chat).toMatchObject({
      seq: 6,
      suggestion: null,
    });
  });

  it("replays events that arrived before the Snapshot, dropping those it already reflects", async () => {
    const { fake, store } = setup();
    fake.signal({ type: "connect" });
    fake.event(suggestionEvent("a", 5, "already in snapshot"));
    await fake.answer("chats:list", undefined, {
      ok: true,
      chats: [summary("a")],
    });
    fake.event(suggestionEvent("a", 6, null));
    fake.event(suggestionEvent("a", 7, "Latest"));

    await fake.answer(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: snapshot("a", { seq: 5, suggestion: "From snapshot" }) }
    );

    expect(store.getState().chats.a).toMatchObject({
      sync: "ready",
      chat: { seq: 7, suggestion: "Latest" },
    });
  });
});

describe("gaps", () => {
  it("refetches the Snapshot when events were missed, and replaces the chat with it", async () => {
    const { fake, store } = setup();
    await connectWith(fake, [snapshot("a", { seq: 5 })]);

    fake.event(suggestionEvent("a", 8, "skipped ahead"));
    expect(store.getState().chats.a?.sync).toBe("loading");

    fake.event(suggestionEvent("a", 10, "after refetch"));
    await fake.answer(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: snapshot("a", { seq: 9, suggestion: "Fresh" }) }
    );

    expect(store.getState().chats.a).toMatchObject({
      sync: "ready",
      chat: { seq: 10, suggestion: "after refetch" },
    });
  });

  it("refetches when a buffered event leaves a gap after the Snapshot", async () => {
    const { fake, store } = setup();
    fake.signal({ type: "connect" });
    await fake.answer("chats:list", undefined, {
      ok: true,
      chats: [summary("a")],
    });
    fake.event(suggestionEvent("a", 9, "too far ahead"));
    await fake.answer(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: snapshot("a", { seq: 5 }) }
    );

    expect(fake.pendingNames()).toEqual([
      { name: "chat:get", payload: { chatId: "a" } },
    ]);
    await fake.answer(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: snapshot("a", { seq: 9, suggestion: "too far ahead" }) }
    );
    expect(store.getState().chats.a).toMatchObject({
      sync: "ready",
      chat: { seq: 9 },
    });
  });
});

describe("connection", () => {
  it("reports an unavailable server when the first connection fails", () => {
    const { fake, store } = setup();

    fake.signal({ type: "connect_error" });

    expect(store.getState().connection).toBe("unavailable");
  });

  it("reports reconnecting after losing an established connection", async () => {
    const { fake, store } = setup();
    await connectWith(fake, [snapshot("a")]);

    fake.signal({ type: "disconnect" });
    fake.signal({ type: "connect_error" });

    expect(store.getState().connection).toBe("reconnecting");
  });

  it("replaces every chat on reconnect, even when the backend restarted and its Sequence Numbers went back", async () => {
    const { fake, store } = setup();
    await connectWith(fake, [snapshot("a", { seq: 40, status: "finished" })]);
    fake.signal({ type: "disconnect" });

    await connectWith(fake, [snapshot("a", { seq: 0, status: "idle" })]);
    fake.event(suggestionEvent("a", 1, null));

    expect(store.getState()).toMatchObject({
      connection: "connected",
      chats: {
        a: {
          sync: "ready",
          chat: { seq: 1, status: "idle", suggestion: null },
        },
      },
    });
  });

  it("ignores responses that belong to a connection that has since dropped", async () => {
    const { fake, store } = setup();
    fake.signal({ type: "connect" });
    await fake.answer("chats:list", undefined, {
      ok: true,
      chats: [summary("a")],
    });
    fake.signal({ type: "disconnect" });
    fake.signal({ type: "connect" });
    await fake.answer("chats:list", undefined, {
      ok: true,
      chats: [summary("a")],
    });

    const [stale, fresh] = [
      snapshot("a", { seq: 3 }),
      snapshot("a", { seq: 7 }),
    ];
    await fake.answerNewest(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: fresh }
    );
    await fake.answer("chat:get", { chatId: "a" }, { ok: true, chat: stale });

    expect(store.getState().chats.a?.chat?.seq).toBe(7);
  });
});

describe("failed requests", () => {
  it("marks a chat failed when its Snapshot cannot be loaded, and loads it on retry", async () => {
    const { fake, store, sync } = setup();
    fake.signal({ type: "connect" });
    await fake.answer("chats:list", undefined, {
      ok: true,
      chats: [summary("a"), summary("b")],
    });
    await fake.fail(
      "chat:get",
      { chatId: "a" },
      new Error("operation has timed out")
    );
    await fake.answer(
      "chat:get",
      { chatId: "b" },
      {
        ok: false,
        error: { code: "UNKNOWN_CHAT", message: "Unknown chat" },
      }
    );

    expect(store.getState().chats.a?.sync).toBe("failed");
    expect(store.getState().chats.b?.sync).toBe("failed");

    sync.retryChat("a");
    await fake.answer(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: snapshot("a") }
    );
    expect(store.getState().chats.a).toMatchObject({
      sync: "ready",
      chat: snapshot("a"),
    });
  });

  it("reports the server unavailable when the chat list cannot be loaded, and relists on retry", async () => {
    const { fake, store, sync } = setup();
    fake.signal({ type: "connect" });
    await fake.fail(
      "chats:list",
      undefined,
      new Error("operation has timed out")
    );

    expect(store.getState().connection).toBe("unavailable");

    sync.retry();
    await fake.answer("chats:list", undefined, {
      ok: true,
      chats: [summary("a")],
    });
    await fake.answer(
      "chat:get",
      { chatId: "a" },
      { ok: true, chat: snapshot("a") }
    );
    expect(store.getState()).toMatchObject({
      connection: "connected",
      chats: { a: { sync: "ready" } },
    });
  });
});

describe("sending a message", () => {
  const payload = { chatId: "a", text: "Hi" };

  it("resolves ok when the backend accepts the message", async () => {
    const { fake, sync } = setup();
    await connectWith(fake, [snapshot("a")]);

    const sent = sync.sendMessage("a", "Hi");
    await fake.answer("message:send", payload, { ok: true, messageId: "a-m3" });

    await expect(sent).resolves.toEqual({ ok: true });
  });

  it("reports why the backend rejected the message", async () => {
    const { fake, sync } = setup();
    await connectWith(fake, [snapshot("a")]);

    const sent = sync.sendMessage("a", "Hi");
    await fake.answer("message:send", payload, {
      ok: false,
      error: { code: "UNEXPECTED_MESSAGE", message: "Not in the script" },
    });

    await expect(sent).resolves.toEqual({
      ok: false,
      reason: "UNEXPECTED_MESSAGE",
    });
  });

  it("reports a timeout when no acknowledgement arrives", async () => {
    const { fake, sync } = setup();
    await connectWith(fake, [snapshot("a")]);

    const sent = sync.sendMessage("a", "Hi");
    await fake.fail(
      "message:send",
      payload,
      new Error("operation has timed out")
    );

    await expect(sent).resolves.toEqual({ ok: false, reason: "TIMEOUT" });
  });

  it("does not send while disconnected", async () => {
    const { fake, sync } = setup();
    await connectWith(fake, [snapshot("a")]);
    fake.signal({ type: "disconnect" });

    await expect(sync.sendMessage("a", "Hi")).resolves.toEqual({
      ok: false,
      reason: "DISCONNECTED",
    });
    expect(fake.pendingNames()).toEqual([]);
  });
});
