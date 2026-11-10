import { describe, expect, it } from "vitest";
import { shallow } from "zustand/shallow";
import {
  selectChatView,
  selectConnectionView,
  type ChatView,
  type ConnectionView,
  type SendAvailability,
} from "./chatView.ts";
import type { Chat, ChatStatus } from "./protocol.ts";
import type { ChatEntry, ChatStoreState, ConnectionStatus } from "./store.ts";

const summary = {
  id: "c1",
  title: "Listed title",
  status: "idle" as const,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const snapshot = (overrides: Partial<Chat> = {}): Chat => ({
  ...summary,
  title: "Snapshot title",
  messages: [],
  suggestion: "Hi",
  seq: 0,
  ...overrides,
});

const state = ({
  entry,
  connection = "connected",
  listed = true,
}: {
  entry?: ChatEntry;
  connection?: ConnectionStatus;
  listed?: boolean;
}): ChatStoreState => ({
  connection,
  listed,
  chatOrder: entry ? ["c1"] : [],
  chats: entry ? { c1: entry } : {},
});

const ready = (
  overrides: Partial<Extract<ChatView, { kind: "ready" }>> = {}
): ChatView => ({
  kind: "ready",
  title: "Snapshot title",
  status: "idle",
  stale: false,
  suggestion: "Hi",
  send: { ok: true },
  ...overrides,
});

const blocked = (reason: string): SendAvailability => ({ ok: false, reason });

describe("selectChatView", () => {
  it.each<[string, string | null, ChatStoreState, ChatView]>([
    ["no Chat selected", null, state({}), { kind: "none" }],
    [
      "no Chat selected before the list",
      null,
      state({ listed: false }),
      { kind: "none" },
    ],
    ["an unknown id", "nope", state({}), { kind: "not-found" }],
    [
      "an inherited key from the URL",
      "constructor",
      state({}),
      { kind: "not-found" },
    ],
    [
      "an id before the list arrives",
      "nope",
      state({ listed: false }),
      { kind: "loading" },
    ],
    [
      "an inherited key before the list arrives",
      "constructor",
      state({ listed: false }),
      { kind: "loading" },
    ],
    [
      "no Snapshot, loading",
      "c1",
      state({ entry: { summary, chat: null, sync: "loading" } }),
      { kind: "loading", title: "Listed title" },
    ],
    [
      "no Snapshot, not yet requested",
      "c1",
      state({ entry: { summary, chat: null, sync: "ready" } }),
      { kind: "loading", title: "Listed title" },
    ],
    [
      "no Snapshot, failed",
      "c1",
      state({ entry: { summary, chat: null, sync: "failed" } }),
      { kind: "failed", title: "Listed title" },
    ],
    [
      "a Snapshot, refreshing",
      "c1",
      state({ entry: { summary, chat: snapshot(), sync: "loading" } }),
      ready(),
    ],
    [
      "a Snapshot, ready",
      "c1",
      state({ entry: { summary, chat: snapshot(), sync: "ready" } }),
      ready(),
    ],
    [
      "a Snapshot whose refresh failed",
      "c1",
      state({ entry: { summary, chat: snapshot(), sync: "failed" } }),
      ready({ stale: true, send: blocked("Reload this chat before sending") }),
    ],
  ])("%s", (_, chatId, store, expected) => {
    expect(selectChatView(chatId)(store)).toEqual(expected);
  });

  it.each<[ChatStatus, string | null, SendAvailability]>([
    ["idle", "Hi", { ok: true }],
    ["responding", null, blocked("Wait for the assistant to finish")],
    ["finished", null, { ok: true }],
  ])("a %s Chat", (status, suggestion, send) => {
    const chat = snapshot({ status, suggestion });
    expect(
      selectChatView("c1")(state({ entry: { summary, chat, sync: "ready" } }))
    ).toEqual(ready({ status, suggestion, send }));
  });

  describe("blocks sending", () => {
    const disconnected = blocked("Wait for the connection to come back");
    const stale = blocked("Reload this chat before sending");
    const responding = blocked("Wait for the assistant to finish");

    it.each<
      [ConnectionStatus, ChatEntry["sync"], ChatStatus, SendAvailability]
    >([
      ["connected", "ready", "idle", { ok: true }],
      ["connected", "ready", "responding", responding],
      ["connected", "failed", "idle", stale],
      ["connected", "failed", "responding", stale],
      ["reconnecting", "ready", "idle", disconnected],
      ["reconnecting", "failed", "responding", disconnected],
      ["unavailable", "failed", "responding", disconnected],
      ["connecting", "ready", "idle", disconnected],
    ])("while %s, %s and %s", (connection, sync, status, send) => {
      const chat = snapshot({ status });
      const view = selectChatView("c1")(
        state({ connection, entry: { summary, chat, sync } })
      );
      expect(view).toMatchObject({ kind: "ready", send });
    });
  });

  it("stays shallow-equal while a response streams in", () => {
    const view = (text: string) =>
      selectChatView("c1")(
        state({
          entry: {
            summary,
            chat: snapshot({
              status: "responding",
              suggestion: null,
              messages: [
                {
                  id: "m1",
                  role: "assistant",
                  status: "streaming",
                  blocks: [{ id: "b1", type: "markdown", text }],
                  createdAt: summary.updatedAt,
                },
              ],
            }),
            sync: "ready",
          },
        })
      );

    expect(shallow(view("Hello"), view("Hello there"))).toBe(true);
  });
});

describe("selectConnectionView", () => {
  it.each<[ConnectionStatus, boolean, ConnectionView]>([
    ["connecting", false, "ok"],
    ["connected", false, "ok"],
    ["reconnecting", false, "unreachable"],
    ["unavailable", false, "unreachable"],
    ["connecting", true, "ok"],
    ["connected", true, "ok"],
    ["reconnecting", true, "reconnecting"],
    ["unavailable", true, "refresh-failed"],
  ])("%s, listed: %s → %s", (connection, listed, expected) => {
    expect(selectConnectionView(state({ connection, listed }))).toBe(expected);
  });
});
