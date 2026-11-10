import { describe, expect, it } from "vitest";
import type { Chat, Message } from "./protocol.ts";
import { applyEvent } from "./reducer.ts";

const assistantMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "c-m1",
  role: "assistant",
  status: "completed",
  blocks: [{ id: "c-m1-b1", type: "markdown", text: "Hello" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const chat = (overrides: Partial<Chat> = {}): Chat => ({
  id: "c",
  title: "Chat",
  status: "idle",
  updatedAt: "2026-01-01T00:00:00.000Z",
  messages: [assistantMessage()],
  suggestion: "Next please",
  seq: 10,
  ...overrides,
});

const statusEvent = (seq: number) =>
  ({
    name: "chat:status",
    chatId: "c",
    seq,
    status: "responding",
    updatedAt: "2026-01-01T00:01:00.000Z",
  }) as const;

describe("sequence gate", () => {
  it("applies the event that follows the chat's sequence number", () => {
    const result = applyEvent(chat({ seq: 10 }), statusEvent(11));

    expect(result).toEqual({
      kind: "applied",
      chat: chat({
        seq: 11,
        status: "responding",
        updatedAt: "2026-01-01T00:01:00.000Z",
      }),
    });
  });

  it("treats events already reflected in the chat as stale", () => {
    expect(applyEvent(chat({ seq: 10 }), statusEvent(10))).toEqual({
      kind: "stale",
    });
    expect(applyEvent(chat({ seq: 10 }), statusEvent(3))).toEqual({
      kind: "stale",
    });
  });

  it("reports a gap when events were skipped", () => {
    expect(applyEvent(chat({ seq: 10 }), statusEvent(12))).toEqual({
      kind: "gap",
    });
  });
});

const applied = (result: ReturnType<typeof applyEvent>): Chat => {
  if (result.kind !== "applied") {
    throw new Error(`Expected the event to apply, got ${result.kind}`);
  }
  return result.chat;
};

describe("chat events", () => {
  it("clears and sets the suggestion", () => {
    const cleared = applied(
      applyEvent(chat(), {
        name: "chat:suggestion",
        chatId: "c",
        seq: 11,
        suggestion: null,
      })
    );
    expect(cleared.suggestion).toBeNull();

    const next = applied(
      applyEvent(cleared, {
        name: "chat:suggestion",
        chatId: "c",
        seq: 12,
        suggestion: "Thanks!",
      })
    );
    expect(next.suggestion).toBe("Thanks!");
  });

  it("appends a created message after the existing ones", () => {
    const userMessage: Message = {
      id: "c-m2",
      role: "user",
      status: "completed",
      blocks: [{ id: "c-m2-b1", type: "markdown", text: "Next please" }],
      createdAt: "2026-01-01T00:01:00.000Z",
    };

    const next = applied(
      applyEvent(chat(), {
        name: "message:created",
        chatId: "c",
        seq: 11,
        message: userMessage,
      })
    );

    expect(next.messages).toEqual([assistantMessage(), userMessage]);
  });
});

describe("streaming an assistant message", () => {
  const streaming = chat({
    seq: 20,
    messages: [
      assistantMessage(),
      assistantMessage({ id: "c-m2", status: "streaming", blocks: [] }),
    ],
  });

  it("appends created blocks and streams text into a markdown block", () => {
    let current = applied(
      applyEvent(streaming, {
        name: "block:created",
        chatId: "c",
        seq: 21,
        messageId: "c-m2",
        block: { id: "c-m2-b1", type: "markdown", text: "" },
      })
    );
    current = applied(
      applyEvent(current, {
        name: "block:delta",
        chatId: "c",
        seq: 22,
        messageId: "c-m2",
        blockId: "c-m2-b1",
        text: "Checking ",
      })
    );
    current = applied(
      applyEvent(current, {
        name: "block:delta",
        chatId: "c",
        seq: 23,
        messageId: "c-m2",
        blockId: "c-m2-b1",
        text: "now.",
      })
    );

    expect(current.messages[1]?.blocks).toEqual([
      { id: "c-m2-b1", type: "markdown", text: "Checking now." },
    ]);
  });

  it("replaces an updated block in place", () => {
    const running = applied(
      applyEvent(streaming, {
        name: "block:created",
        chatId: "c",
        seq: 21,
        messageId: "c-m2",
        block: {
          id: "c-m2-b1",
          type: "tool_call",
          title: "Reset password",
          status: "running",
          summary: null,
        },
      })
    );
    const done = applied(
      applyEvent(running, {
        name: "block:updated",
        chatId: "c",
        seq: 22,
        messageId: "c-m2",
        block: {
          id: "c-m2-b1",
          type: "tool_call",
          title: "Reset password",
          status: "succeeded",
          summary: "Password reset.",
        },
      })
    );

    expect(done.messages[1]?.blocks).toEqual([
      {
        id: "c-m2-b1",
        type: "tool_call",
        title: "Reset password",
        status: "succeeded",
        summary: "Password reset.",
      },
    ]);
  });

  it("marks a message completed", () => {
    const done = applied(
      applyEvent(streaming, {
        name: "message:completed",
        chatId: "c",
        seq: 21,
        messageId: "c-m2",
      })
    );

    expect(done.messages[1]?.status).toBe("completed");
  });

  it("keeps untouched messages as the same objects", () => {
    const next = applied(
      applyEvent(streaming, {
        name: "message:completed",
        chatId: "c",
        seq: 21,
        messageId: "c-m2",
      })
    );

    expect(next.messages[0]).toBe(streaming.messages[0]);
  });

  it("reports a gap when an event targets a message or block it does not have", () => {
    const unknownMessage = applyEvent(streaming, {
      name: "message:completed",
      chatId: "c",
      seq: 21,
      messageId: "c-m9",
    });
    const unknownBlock = applyEvent(streaming, {
      name: "block:delta",
      chatId: "c",
      seq: 21,
      messageId: "c-m2",
      blockId: "c-m2-b9",
      text: "lost",
    });

    expect(unknownMessage).toEqual({ kind: "gap" });
    expect(unknownBlock).toEqual({ kind: "gap" });
  });

  it("reports a gap when text is streamed into a block that is not markdown", () => {
    const withTable = chat({
      seq: 20,
      messages: [
        assistantMessage({
          blocks: [{ id: "c-m1-b1", type: "table", columns: [], rows: [] }],
        }),
      ],
    });

    expect(
      applyEvent(withTable, {
        name: "block:delta",
        chatId: "c",
        seq: 21,
        messageId: "c-m1",
        blockId: "c-m1-b1",
        text: "oops",
      })
    ).toEqual({ kind: "gap" });
  });
});
