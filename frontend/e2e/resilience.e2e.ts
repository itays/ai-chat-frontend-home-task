import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

const pageErrors: Error[] = [];

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

/** Passes the app's sockets through to the backend, or fails them while `refusing`. */
const routeSockets = async (page: Page) => {
  const route = { refusing: false, open: [] as WebSocketRoute[] };
  await page.routeWebSocket(/\/ws$/, async (ws) => {
    if (route.refusing) {
      // Closed before the handler returns, so the page never sees it open.
      await ws.close();
      return;
    }
    ws.connectToServer();
    route.open.push(ws);
  });
  return route;
};

test("shows an error when the server is unreachable, and connects on Retry once it is back", async ({
  page,
}) => {
  const sockets = await routeSockets(page);
  sockets.refusing = true;
  await page.clock.install();
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Can't reach the server" })
  ).toBeVisible();

  // Pausing stops the reconnection backoff timer, so only Retry can connect.
  await page.clock.pauseAt(Date.now() + 100);
  sockets.refusing = false;
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(
    page.getByRole("navigation", { name: "Chats" }).getByRole("button")
  ).toHaveCount(3);
});

test("shows a banner and holds sending while the connection is down, then recovers", async ({
  page,
}) => {
  const sockets = await routeSockets(page);
  // No spec plays a Turn here, so the Chat stays idle and Send can come back.
  await page.goto("/?chat=new-hire-setup");
  const message = page.getByRole("textbox", { name: "Message" });
  const send = page.getByRole("button", { name: "Send message" });
  await expect(message).toBeVisible();

  sockets.refusing = true;
  await Promise.all(sockets.open.map((ws) => ws.close()));

  await expect(page.getByText("Reconnecting to server…")).toBeVisible();
  await message.fill("Hello");
  await expect(send).toBeDisabled();
  await expect(
    page.getByText("Wait for the connection to come back")
  ).toBeVisible();

  sockets.refusing = false;

  await expect(page.getByText("Reconnecting to server…")).toBeHidden({
    timeout: 10_000,
  });
  await expect(send).toBeEnabled();
});
