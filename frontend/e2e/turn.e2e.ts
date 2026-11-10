import { expect, test } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import { BACKEND_URL, getChat } from "./backend.ts";

// The only spec that plays Turns in this Chat; the others only read it, at any Turn.
const CHAT_ID = "vpn-access";

// How the reply to each scripted Turn ends, keyed by the Message that starts it.
// Keyed rather than fixed, so a retry or a reused backend plays the next Turn.
const REPLY_ENDINGS: Record<string, string> = {
  "Yes, please reset it.": "The temporary password expires in 15 minutes.",
  "I signed in, but the VPN disconnects every few minutes.":
    "Should I start the update?",
  "Go ahead and update it.": "the network team will have the full history.",
};

const pageErrors: Error[] = [];
let socket: Socket;

test.beforeAll(() => {
  socket = io(BACKEND_URL, { transports: ["websocket"] });
});

test.afterAll(() => {
  socket.close();
});

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test("sends the Suggestion, shows the reply, and restores the Chat on reload @smoke", async ({
  page,
}) => {
  // A retry can start while the failed attempt's Turn is still playing.
  await expect
    .poll(async () => (await getChat(socket, CHAT_ID)).status, {
      timeout: 15_000,
    })
    .not.toBe("responding");
  const { suggestion, status } = await getChat(socket, CHAT_ID);
  if (suggestion === null || !Object.hasOwn(REPLY_ENDINGS, suggestion)) {
    throw new Error(
      `${CHAT_ID} has no scripted Turn left (status ${status}, Suggestion ${JSON.stringify(suggestion)}); restart the E2E backend`
    );
  }
  const replyEnding = REPLY_ENDINGS[suggestion];
  await page.goto(`/?chat=${CHAT_ID}`);
  const log = page.getByRole("log", { name: "Messages" });
  const box = page.getByRole("textbox", { name: "Message" });

  await box.press("Tab");
  await expect(box).toHaveValue(suggestion);
  await box.press("Enter");

  await expect(page.getByText("Assistant finished responding")).toBeAttached();
  await expect(log.getByText(suggestion, { exact: true })).toBeVisible();
  await expect(log.getByText(replyEnding)).toBeVisible();
  const { suggestion: next } = await getChat(socket, CHAT_ID);
  // The next Suggestion as ghost text, or the footer once the script is done.
  const nextSuggestionOrFinished =
    next === null
      ? page.getByText("This chat is finished")
      : page.getByText(next, { exact: true });
  await expect(nextSuggestionOrFinished).toBeVisible();
  const logBeforeReload = await log.textContent();

  await page.reload();

  await expect(log).toHaveText(logBeforeReload ?? "");
  await expect(nextSuggestionOrFinished).toBeVisible();
});
