import { expect, test } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import { BACKEND_URL, getChat } from "./backend.ts";

// Nothing here is accepted by the script, so the Chat is left as it was.
const CHAT_ID = "new-hire-setup";

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

test("completes the Suggestion with Tab and keeps a Rejected Message with an error", async ({
  page,
}) => {
  const { suggestion, status } = await getChat(socket, CHAT_ID);
  if (suggestion === null) {
    throw new Error(`${CHAT_ID} has no Suggestion (status ${status})`);
  }
  await page.goto(`/?chat=${CHAT_ID}`);
  const box = page.getByRole("textbox", { name: "Message" });
  const rejected = page.getByText("Sorry, that's not the message I expected.");

  await box.fill("This is not in the script");
  await box.press("Enter");

  await expect(rejected).toBeVisible();
  await expect(box).toHaveValue("This is not in the script");
  await expect(box).toBeEditable();

  await box.fill(suggestion.slice(0, 5));

  await expect(
    page.getByText(suggestion.slice(5), { exact: true })
  ).toBeVisible();
  await expect(rejected).toBeHidden();

  await box.press("Tab");

  await expect(box).toHaveValue(suggestion);
  await expect(box).toBeFocused();
});
