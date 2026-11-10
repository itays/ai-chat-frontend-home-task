import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ChatEntry } from "@/chat/store.ts";
import { renderApp } from "@/test/renderApp.tsx";

const entry = (id: string): ChatEntry => {
  const summary = {
    id,
    title: `Chat ${id}`,
    status: "idle" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    summary,
    chat: { ...summary, messages: [], suggestion: "Hi", seq: 0 },
    sync: "ready",
  };
};

describe("lost connection", () => {
  it("shows a banner and holds sending until the connection is back", async () => {
    const { store } = renderApp({
      url: "/?chat=c1",
      chats: { c1: entry("c1") },
      connection: "reconnecting",
    });
    const send = () => screen.getByRole("button", { name: "Send message" });

    expect(screen.getByText("Reconnecting to server…")).toHaveRole("status");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Hi"
    );
    expect(send()).toBeDisabled();
    expect(send()).toHaveAccessibleDescription(
      "Wait for the connection to come back"
    );

    act(() => store.setState({ connection: "connected" }));

    expect(
      screen.queryByText("Reconnecting to server…")
    ).not.toBeInTheDocument();
    expect(send()).toBeEnabled();
  });
});

describe("a Chat whose Snapshot failed to load", () => {
  it("shows an error with Retry in that Chat only", async () => {
    const { sync } = renderApp({
      url: "/?chat=c1",
      chats: {
        c1: { ...entry("c1"), chat: null, sync: "failed" },
        c2: entry("c2"),
      },
    });

    expect(
      screen.getByRole("heading", { name: "Couldn't load this chat" })
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(sync.retryChat).toHaveBeenCalledWith("c1");

    await userEvent.click(screen.getByRole("button", { name: /Chat c2/ }));
    expect(
      screen.queryByRole("heading", { name: "Couldn't load this chat" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeVisible();
  });

  it("keeps the messages it has and offers to reload them when a refresh fails", async () => {
    const { sync } = renderApp({
      url: "/?chat=c1",
      chats: { c1: { ...entry("c1"), sync: "failed" } },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This chat may be out of date"
    );
    // Its events are no longer applied, so a sent Message would never show.
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Hi"
    );
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription("Reload this chat before sending");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(sync.retryChat).toHaveBeenCalledWith("c1");
  });
});

describe("chat list that fails to load after a reconnect", () => {
  it("keeps the Chats and drafts on screen and offers to reload the list", async () => {
    const { store, sync } = renderApp({
      url: "/?chat=c1",
      chats: { c1: entry("c1") },
    });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Draft"
    );

    act(() => store.setState({ connection: "unavailable" }));

    expect(screen.getByText("Couldn't refresh your chats")).toHaveRole(
      "status"
    );
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Draft"
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(sync.retry).toHaveBeenCalledOnce();
  });

  it("shows the server error, not an empty app, while reconnecting before any Chat was listed", () => {
    renderApp({ chats: {}, listed: false, connection: "reconnecting" });

    expect(
      screen.getByRole("heading", { name: "Can't reach the server" })
    ).toBeVisible();
  });
});

describe("unavailable server", () => {
  it("replaces the app with an error and retries on request, showing progress until the attempt settles", async () => {
    const { sync } = renderApp({
      chats: {},
      listed: false,
      connection: "unavailable",
    });
    let settle = () => {};
    sync.retry.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        settle = resolve;
      })
    );

    expect(
      screen.getByRole("heading", { name: "Can't reach the server" })
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Chats" })
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(sync.retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();

    await act(async () => settle());

    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });
});
