import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SendResult } from "@/chat/chatSync.ts";
import type { Chat } from "@/chat/protocol.ts";
import type { ChatEntry } from "@/chat/store.ts";
import { renderApp } from "@/test/renderApp.tsx";

const SUGGESTION = "I signed in, but the VPN disconnects every few minutes.";

const entry = (
  id: string,
  {
    status = "idle",
    suggestion = SUGGESTION,
  }: Partial<Pick<Chat, "status" | "suggestion">> = {}
): ChatEntry => {
  const summary = {
    id,
    title: `Chat ${id}`,
    status,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    summary,
    chat: { ...summary, messages: [], suggestion, seq: 0 },
    sync: "ready",
  };
};

/** Opens Chat `c1` (plus `c2`, to switch to) and returns the fake sync. */
const renderComposer = (chat: Parameters<typeof entry>[1] = {}) => {
  const rendered = renderApp({
    url: "/?chat=c1",
    chats: { c1: entry("c1", chat), c2: entry("c2") },
  });
  return { ...rendered, user: userEvent.setup() };
};

/** Makes the next send wait; resolve it with the returned function. */
const holdNextSend = (sync: ReturnType<typeof renderApp>["sync"]) => {
  let answer: (result: SendResult) => void = () => {};
  sync.sendMessage.mockReturnValueOnce(
    new Promise((resolve) => {
      answer = resolve;
    })
  );
  return (result: SendResult) => act(async () => answer(result));
};

const messageBox = () => screen.getByRole("textbox", { name: "Message" });

describe("Suggestion", () => {
  it("shows the rest of the Suggestion after a matching draft and accepts it on Tab", async () => {
    const { user } = renderComposer();

    await user.type(messageBox(), "I signed in");

    expect(
      screen.getByText(", but the VPN disconnects every few minutes.")
    ).toBeInTheDocument();
    expect(screen.getByText("to accept")).toBeInTheDocument();

    await user.keyboard("{Tab}");

    expect(messageBox()).toHaveValue(SUGGESTION);
    expect(messageBox()).toHaveFocus();
  });

  it("tells screen reader users the Suggestion and how to accept it", () => {
    renderComposer();

    expect(messageBox()).toHaveAccessibleDescription(
      `Suggested message: “${SUGGESTION}” Tab to accept`
    );
  });

  it.each([
    ["there is no Suggestion", { suggestion: null }, ""],
    ["the draft already is the Suggestion", {}, SUGGESTION],
    ["the draft strayed from the Suggestion", {}, "I signed out"],
  ])("moves focus on Tab when %s", async (_, chat, draft) => {
    const { user } = renderComposer(chat);
    await user.click(messageBox());
    if (draft) await user.paste(draft);

    await user.keyboard("{Tab}");

    expect(messageBox()).not.toHaveFocus();
    expect(messageBox()).toHaveValue(draft);
    expect(screen.queryByText("to accept")).not.toBeInTheDocument();
  });

  it("follows the Suggestion when it changes", async () => {
    const { user, store } = renderComposer();
    await user.type(messageBox(), "Thanks");

    act(() =>
      store.setState(({ chats }) => ({
        chats: {
          ...chats,
          c1: entry("c1", { suggestion: "Thanks, that fixed it." }),
        },
      }))
    );

    expect(screen.getByText(", that fixed it.")).toBeInTheDocument();
  });
});

const sendButton = () => screen.getByRole("button", { name: "Send message" });

describe("sending", () => {
  it("sends the trimmed draft on Enter and clears it once accepted", async () => {
    const { user, sync } = renderComposer();
    sync.sendMessage.mockResolvedValue({ ok: true });

    await user.type(messageBox(), "  Hello  {Enter}");

    expect(sync.sendMessage).toHaveBeenCalledExactlyOnceWith("c1", "Hello");
    expect(messageBox()).toHaveValue("");
  });

  it("sends with the Send button, keeping focus in the message box", async () => {
    const { user, sync } = renderComposer();
    sync.sendMessage.mockResolvedValue({ ok: true });

    await user.type(messageBox(), "Hello");
    await user.click(sendButton());

    expect(sync.sendMessage).toHaveBeenCalledExactlyOnceWith("c1", "Hello");
    expect(messageBox()).toHaveFocus();
  });

  it("adds a new line on Shift+Enter instead of sending", async () => {
    const { user, sync } = renderComposer();

    await user.type(messageBox(), "one{Shift>}{Enter}{/Shift}two");

    expect(messageBox()).toHaveValue("one\ntwo");
    expect(sync.sendMessage).not.toHaveBeenCalled();
  });

  it("never sends a blank draft", async () => {
    const { user, sync } = renderComposer();

    await user.type(messageBox(), "   {Enter}");

    expect(sync.sendMessage).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();
  });

  it("lets the user type while the assistant responds, but not send", async () => {
    const { user, sync } = renderComposer({
      status: "responding",
      suggestion: null,
    });

    await user.type(messageBox(), "Hello{Enter}");

    expect(messageBox()).toHaveValue("Hello");
    expect(sync.sendMessage).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveAccessibleDescription(
      "Wait for the assistant to finish"
    );
  });

  it("locks the draft until the backend answers, without losing focus", async () => {
    const { user, sync } = renderComposer();
    const answer = holdNextSend(sync);

    await user.type(messageBox(), "Hello{Enter}");
    await user.type(messageBox(), " again{Enter}");

    expect(messageBox()).toHaveValue("Hello");
    expect(messageBox()).toHaveAttribute("readonly");
    expect(messageBox()).toHaveFocus();
    expect(sendButton()).toBeDisabled();
    expect(sync.sendMessage).toHaveBeenCalledOnce();

    await answer({ ok: true });

    expect(messageBox()).toHaveValue("");
    expect(messageBox()).not.toHaveAttribute("readonly");
  });

  it("keeps a Rejected Message and explains, until the draft is edited", async () => {
    const { user, sync } = renderComposer();
    sync.sendMessage.mockResolvedValue({
      ok: false,
      reason: "UNEXPECTED_MESSAGE",
    });

    await user.type(messageBox(), "Hello{Enter}");

    const error = "Sorry, that's not the message I expected.";
    expect(messageBox()).toHaveValue("Hello");
    expect(messageBox()).toBeInvalid();
    expect(messageBox()).toHaveAccessibleDescription(
      expect.stringContaining(error)
    );
    expect(screen.getByText(error)).toBeVisible();

    await user.type(messageBox(), "!");

    expect(screen.queryByText(error)).not.toBeInTheDocument();
    expect(messageBox()).toBeValid();
  });

  it.each(["TIMEOUT", "DISCONNECTED", "CHAT_RESPONDING"] as const)(
    "shows a generic error when sending fails with %s",
    async (reason) => {
      const { user, sync } = renderComposer();
      sync.sendMessage.mockResolvedValue({ ok: false, reason });

      await user.type(messageBox(), "Hello{Enter}");

      expect(messageBox()).toHaveValue("Hello");
      expect(
        screen.getByText("Couldn't send your message. Try again.")
      ).toBeVisible();
    }
  );

  it("limits a Message to 2,000 characters", () => {
    renderComposer();

    expect(messageBox()).toHaveAttribute("maxLength", "2000");
  });
});

describe("drafts", () => {
  const openChat = (user: ReturnType<typeof userEvent.setup>, id: string) =>
    user.click(screen.getByRole("button", { name: new RegExp(`Chat ${id}`) }));

  it("keeps each Chat's draft while switching between Chats", async () => {
    const { user } = renderComposer();

    await user.type(messageBox(), "first");
    await openChat(user, "c2");
    expect(messageBox()).toHaveValue("");
    await user.type(messageBox(), "second");
    await openChat(user, "c1");

    expect(messageBox()).toHaveValue("first");

    await openChat(user, "c2");

    expect(messageBox()).toHaveValue("second");
  });

  it("forgets a draft that was sent, even if accepted after switching away", async () => {
    const { user, sync } = renderComposer();
    const answer = holdNextSend(sync);

    await user.type(messageBox(), "Hello{Enter}");
    await openChat(user, "c2");
    await answer({ ok: true });
    await openChat(user, "c1");

    expect(messageBox()).toHaveValue("");
  });

  it("stays locked when switching away and back before the backend answers", async () => {
    const { user, sync } = renderComposer();
    const answer = holdNextSend(sync);

    await user.type(messageBox(), "Hello{Enter}");
    await openChat(user, "c2");
    await openChat(user, "c1");
    await user.type(messageBox(), "{Enter}");

    expect(messageBox()).toHaveValue("Hello");
    expect(messageBox()).toHaveAttribute("readonly");
    expect(sync.sendMessage).toHaveBeenCalledOnce();

    await answer({ ok: true });

    expect(messageBox()).toHaveValue("");
  });

  it("shows why a send failed after switching away, on return", async () => {
    const { user, sync } = renderComposer();
    const answer = holdNextSend(sync);

    await user.type(messageBox(), "Hello{Enter}");
    await openChat(user, "c2");
    await answer({ ok: false, reason: "UNEXPECTED_MESSAGE" });

    expect(
      screen.queryByText("Sorry, that's not the message I expected.")
    ).not.toBeInTheDocument();

    await openChat(user, "c1");

    expect(messageBox()).toHaveValue("Hello");
    expect(
      screen.getByText("Sorry, that's not the message I expected.")
    ).toBeVisible();
  });
});
