import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Chat, ChatStatus } from "@/chat/protocol.ts";
import type { ChatEntry, ChatStore } from "@/chat/store.ts";
import { renderApp } from "@/test/renderApp.tsx";

const entry = (id: string, status: ChatStatus = "idle"): ChatEntry => {
  const summary = {
    id,
    title: `Chat ${id}`,
    status,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    summary,
    chat: { ...summary, messages: [], suggestion: null, seq: 0 },
    sync: "ready",
  };
};

/** Opens Chat `c1`, next to an unselected `c2`. */
const renderPane = (status: ChatStatus = "idle") =>
  renderApp({
    url: "/?chat=c1",
    chats: { c1: entry("c1", status), c2: entry("c2") },
  }).store;

const setStatus = (store: ChatStore, chatId: string, status: ChatStatus) =>
  act(() =>
    store.setState(({ chats }) => {
      const current = chats[chatId]!;
      const chat: Chat = { ...current.chat!, status };
      return { chats: { ...chats, [chatId]: { ...current, chat } } };
    })
  );

describe("finished Chat", () => {
  it("replaces the message input with a footer", () => {
    const store = renderPane();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeVisible();

    setStatus(store, "c1", "finished");

    expect(
      screen.queryByRole("textbox", { name: "Message" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("This chat is finished")).toBeVisible();
  });
});

describe("response announcements", () => {
  const announced = (text: string) => screen.queryByText(text);

  it("announces when the assistant starts and finishes responding", () => {
    const store = renderPane();

    setStatus(store, "c1", "responding");
    expect(announced("Assistant is responding")).toHaveRole("status");

    setStatus(store, "c1", "idle");
    expect(announced("Assistant finished responding")).toHaveRole("status");
    expect(announced("Assistant is responding")).not.toBeInTheDocument();
  });

  it("stays quiet about a response already under way when the Chat opens", () => {
    renderPane("responding");

    expect(announced("Assistant is responding")).not.toBeInTheDocument();
  });

  it("stays quiet about a response under way in a Chat switched to", async () => {
    const store = renderPane();
    setStatus(store, "c2", "responding");

    await userEvent.click(screen.getByRole("button", { name: /Chat c2/ }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Chat c2" })
    ).toBeInTheDocument();
    expect(announced("Assistant is responding")).not.toBeInTheDocument();
  });

  it("stays quiet about responses in other Chats", () => {
    const store = renderPane();

    setStatus(store, "c2", "responding");
    setStatus(store, "c2", "idle");

    expect(announced("Assistant is responding")).not.toBeInTheDocument();
    expect(announced("Assistant finished responding")).not.toBeInTheDocument();
  });
});
