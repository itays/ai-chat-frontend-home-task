import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Block, Message } from "@/chat/protocol.ts";
import { renderApp } from "@/test/renderApp.tsx";

const message = (
  id: string,
  role: Message["role"],
  blocks: Block[]
): Message => ({
  id,
  role,
  status: "completed",
  blocks,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const assistant = (...blocks: Block[]) => message("m-a", "assistant", blocks);

/** Opens a Chat whose Snapshot holds `messages`. */
const renderChat = (...messages: Message[]) =>
  renderChatWithStore(...messages).log;

const renderChatWithStore = (...messages: Message[]) => {
  const summary = {
    id: "c1",
    title: "Chat one",
    status: "idle" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const { store } = renderApp({
    url: "/?chat=c1",
    chats: {
      c1: {
        summary,
        chat: { ...summary, messages, suggestion: null, seq: 0 },
        sync: "ready",
      },
    },
  });
  return { log: within(screen.getByRole("log", { name: "Messages" })), store };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("messages", () => {
  it("renders assistant markdown and user text as typed", () => {
    const log = renderChat(
      assistant({ id: "b1", type: "markdown", text: "Hi **Dana**" }),
      message("m-u", "user", [
        { id: "b2", type: "markdown", text: "**not bold**\nsecond line" },
      ])
    );

    expect(log.getByText("Dana").tagName).toBe("STRONG");
    const userText = log.getByText(/\*\*not bold\*\*/);
    expect(userText.textContent).toBe("**not bold**\nsecond line");
    expect(userText).toHaveClass("whitespace-pre-wrap");
  });

  it("does not announce streamed text word by word", () => {
    renderChat(assistant({ id: "b1", type: "markdown", text: "Hi" }));

    expect(screen.getByRole("log", { name: "Messages" })).toHaveAttribute(
      "aria-live",
      "off"
    );
  });

  it("shows raw HTML in markdown as text instead of rendering it", () => {
    const log = renderChat(
      assistant({
        id: "b1",
        type: "markdown",
        text: `> Pay <img src=x onerror="alert('xss')"> and done`,
      })
    );

    expect(log.getByRole("blockquote")).toHaveTextContent(
      `Pay <img src=x onerror="alert('xss')"> and done`
    );
    expect(document.querySelector("[role=log] img")).toBeNull();
  });

  it("drops script links and opens other links in a new tab", () => {
    const log = renderChat(
      assistant({
        id: "b1",
        type: "markdown",
        text: "[bad](javascript:alert(1)) and https://example.com/notes",
      })
    );

    expect(log.getByText("bad").closest("a")).not.toHaveAttribute(
      "href",
      expect.stringContaining("javascript")
    );
    const link = log.getByRole("link", { name: "https://example.com/notes" });
    expect(link).toHaveAttribute("href", "https://example.com/notes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a Tool Call's title, status, and summary", () => {
    const log = renderChat(
      assistant(
        {
          id: "b1",
          type: "tool_call",
          title: "Check sign-ins",
          status: "running",
          summary: null,
        },
        {
          id: "b2",
          type: "tool_call",
          title: "Send password",
          status: "succeeded",
          summary: "Sent to phone ending in 4821",
        },
        {
          id: "b3",
          type: "tool_call",
          title: "Push update",
          status: "failed",
          summary: "Laptop offline",
        }
      )
    );

    const toolCall = (title: string) => log.getByRole("group", { name: title });
    expect(toolCall("Check sign-ins")).toHaveTextContent(
      /^Check sign-ins.*Running$/
    );
    expect(toolCall("Send password")).toHaveTextContent(
      /^Send password.*Succeeded.*Sent to phone ending in 4821$/
    );
    expect(toolCall("Push update")).toHaveTextContent(
      /^Push update.*Failed.*Laptop offline$/
    );
  });

  it("shows a table with its column headers, filling missing cells with a dash", () => {
    const log = renderChat(
      assistant({
        id: "b1",
        type: "table",
        columns: [
          { key: "id", label: "Ticket" },
          { key: "state", label: "State" },
        ],
        rows: [{ state: "New", id: "INC1" }, { id: "INC2" }],
      })
    );

    const rows = within(log.getByRole("table")).getAllByRole("row");
    expect(
      rows.map((row) =>
        [
          ...within(row).queryAllByRole("columnheader"),
          ...within(row).queryAllByRole("cell"),
        ].map((cell) => cell.textContent)
      )
    ).toEqual([
      ["Ticket", "State"],
      ["INC1", "New"],
      ["INC2", "—"],
    ]);
  });

  it("shows an Unknown Block as unsupported content with its raw data collapsed", () => {
    const log = renderChat(
      assistant(
        { id: "b1", type: "chart", title: "<b>Error rate</b>" },
        { id: "b2", type: "tool_call", title: "Malformed" }
      )
    );

    const [chart, malformed] = log.getAllByText(/^Unsupported content/);
    expect(chart).toHaveTextContent("Unsupported content · chart");
    expect(malformed).toHaveTextContent("Unsupported content · tool_call");

    const details = chart!.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(
      within(details).getByText(/"title": "<b>Error rate<\/b>"/)
    ).toBeInTheDocument();
    expect(details.querySelector("b")).toBeNull();
  });

  it("contains a Block that fails to render, keeping the rest of the Message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const log = renderChat(
      assistant(
        // Untrusted data: `type` is promised to be a string, but is an object here.
        { id: "b1", type: { name: "chart" } as unknown as string },
        { id: "b2", type: "markdown", text: "Still here" }
      )
    );

    expect(
      log.getByText("This content couldn't be displayed.")
    ).toBeInTheDocument();
    expect(log.getByText("Still here")).toBeInTheDocument();
  });

  it("follows Block updates and new Messages as they arrive", () => {
    const toolCall = {
      id: "b1",
      type: "tool_call",
      title: "Check sign-ins",
      status: "running",
      summary: null,
    };
    const { log, store } = renderChatWithStore(
      assistant(toolCall, { id: "b2", type: "markdown", text: "Look" })
    );

    act(() =>
      store.setState(({ chats }) => {
        const chat = chats.c1!.chat!;
        return {
          chats: {
            c1: {
              ...chats.c1!,
              chat: {
                ...chat,
                messages: [
                  assistant(
                    { ...toolCall, status: "succeeded", summary: "All clear" },
                    { id: "b2", type: "markdown", text: "Looks fine" }
                  ),
                  message("m-u", "user", [
                    { id: "b3", type: "markdown", text: "Thanks" },
                  ]),
                ],
              },
            },
          },
        };
      })
    );

    expect(
      log.getByRole("group", { name: "Check sign-ins" })
    ).toHaveTextContent(/Succeeded.*All clear/);
    expect(log.getByText("Looks fine")).toBeInTheDocument();
    expect(log.getByText("Thanks")).toBeInTheDocument();
  });
});
