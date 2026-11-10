import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chat, ChatSummary, Message } from "./chat/protocol.ts";
import type { ChatEntry, ChatStore } from "./chat/store.ts";
import { renderApp as renderWithChats } from "./test/renderApp.tsx";

/** Appends a completed assistant Message, as the sync layer would after a Turn. */
const completeReply = (store: ChatStore, chatId: string) =>
  act(() =>
    store.setState(({ chats }) => {
      const entry = chats[chatId]!;
      const chat = entry.chat!;
      const id = `${chatId}-m${chat.messages.length + 1}`;
      return {
        chats: {
          ...chats,
          [chatId]: {
            ...entry,
            chat: {
              ...chat,
              messages: [...chat.messages, assistantMessage({ id })],
            },
          },
        },
      };
    })
  );

const isUnread = (title: string) =>
  within(chatButton(title)).queryByText("New response") !== null;

const assistantMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  role: "assistant",
  status: "completed",
  blocks: [{ id: "m1-b1", type: "markdown", text: "Hello" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const summaries: ChatSummary[] = [
  {
    id: "vpn-access",
    title: "VPN access issue",
    status: "idle",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "new-hire-setup",
    title: "New hire setup",
    status: "responding",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "incident-triage",
    title: "Incident triage",
    status: "finished",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const snapshot = (summary: ChatSummary): Chat => ({
  ...summary,
  messages: [
    assistantMessage({ id: `${summary.id}-m1` }),
    assistantMessage({ id: `${summary.id}-m2` }),
  ],
  suggestion: null,
  seq: 2,
});

/** Every chat listed and its Snapshot loaded. */
const loadedEntries = (): Record<string, ChatEntry> =>
  Object.fromEntries(
    summaries.map((summary) => [
      summary.id,
      { summary, chat: snapshot(summary), sync: "ready" },
    ])
  );

const renderApp = ({
  url = "/",
  chats = loadedEntries(),
}: { url?: string; chats?: Record<string, ChatEntry> } = {}) =>
  renderWithChats({ url, chats });

const chatButton = (title: string) =>
  chatList().getByRole("button", { name: new RegExp(title) });

const chatList = () =>
  within(screen.getByRole("navigation", { name: "Chats" }));

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("sidebar", () => {
  it("lists the chats in protocol order with their title and status", () => {
    renderApp();

    const items = chatList().getAllByRole("button");

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/VPN access issue.*Idle/),
      expect.stringMatching(/New hire setup.*Responding/),
      expect.stringMatching(/Incident triage.*Finished/),
    ]);
  });

  it("selects a chat into the URL and marks it as current", async () => {
    renderApp();

    await userEvent.click(chatButton("New hire setup"));

    expect(window.location.search).toBe("?chat=new-hire-setup");
    expect(chatButton("New hire setup")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(chatButton("VPN access issue")).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("heading", { level: 1, name: "New hire setup" })
    ).toBeInTheDocument();
  });

  it("follows the URL on back and forward navigation", async () => {
    renderApp({ url: "/?chat=vpn-access" });

    await userEvent.click(chatButton("Incident triage"));
    act(() => {
      window.history.back();
    });

    await vi.waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "VPN access issue" })
      ).toBeInTheDocument()
    );
    expect(chatButton("VPN access issue")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

describe("chat pane", () => {
  it("shows an empty state when no chat is selected", () => {
    renderApp();

    expect(screen.getByText("Select a chat")).toBeInTheDocument();
  });

  it.each(["nope", "constructor"])(
    "says the chat was not found when the URL names an unknown chat (%s)",
    (chatId) => {
      renderApp({ url: `/?chat=${chatId}` });

      expect(screen.getByText("Chat not found")).toBeInTheDocument();
    }
  );

  it("shows a loading placeholder until the selected chat's Snapshot arrives", () => {
    const chats = loadedEntries();
    chats["vpn-access"] = {
      ...chats["vpn-access"]!,
      chat: null,
      sync: "loading",
    };
    renderApp({ url: "/?chat=vpn-access", chats });

    expect(
      screen.getByRole("status", { name: "Loading chat" })
    ).toBeInTheDocument();
  });

  it("shows a loading placeholder, not 'not found', before the chat list arrives", () => {
    renderApp({ url: "/?chat=vpn-access", chats: {} });

    expect(
      screen.getByRole("status", { name: "Loading chat" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Chat not found")).not.toBeInTheDocument();
  });
});

describe("unread indicator", () => {
  it("is not shown for messages already in the initial Snapshots", () => {
    renderApp();

    expect(isUnread("VPN access issue")).toBe(false);
    expect(isUnread("New hire setup")).toBe(false);
    expect(isUnread("Incident triage")).toBe(false);
  });

  it("marks a chat whose response completes while another chat is open, until it is opened", async () => {
    const { store } = renderApp({ url: "/?chat=vpn-access" });

    completeReply(store, "new-hire-setup");
    expect(isUnread("New hire setup")).toBe(true);

    await userEvent.click(chatButton("New hire setup"));
    expect(isUnread("New hire setup")).toBe(false);
  });

  it("is not shown for a response that completes in the open chat", () => {
    const { store } = renderApp({ url: "/?chat=vpn-access" });

    completeReply(store, "vpn-access");

    expect(isUnread("VPN access issue")).toBe(false);
  });
});
