import { expect, test, type WebSocketRoute } from "@playwright/test";

const SOCKET_IO = "**/socket.io/**";

const pageErrors: Error[] = [];

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test("shows an error when the server is unreachable, and connects on Retry once it is back", async ({
  page,
}) => {
  await page.route(SOCKET_IO, (route) => route.abort());
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Can't reach the server" })
  ).toBeVisible();

  await page.unroute(SOCKET_IO);
  await page.getByRole("button", { name: "Retry" }).click();

  // Faster than the socket's own reconnection backoff, so it was the Retry that connected.
  await expect(
    page.getByRole("navigation", { name: "Chats" }).getByRole("button")
  ).toHaveCount(3, { timeout: 1_000 });
});

test("shows a banner and holds sending while the connection is down, then recovers", async ({
  page,
}) => {
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    ws.connectToServer();
    sockets.push(ws);
  });
  // Socket.IO starts on long-polling and moves to the WebSocket once the
  // client sends Engine.IO's upgrade packet ("5").
  const upgraded = page
    .waitForEvent("websocket", (ws) => ws.url().includes("/socket.io/"))
    .then((ws) =>
      ws.waitForEvent("framesent", ({ payload }) => payload === "5")
    );
  await page.goto("/?chat=vpn-access");
  const message = page.getByRole("textbox", { name: "Message" });
  const send = page.getByRole("button", { name: "Send message" });
  await expect(message).toBeVisible();
  await upgraded;

  // Close the WebSocket and block the polling fallback, so reconnecting fails.
  await page.route(SOCKET_IO, (route) => route.abort());
  await Promise.all(sockets.map((ws) => ws.close()));

  await expect(page.getByText("Reconnecting to server…")).toBeVisible();
  await message.fill("Hello");
  await expect(send).toBeDisabled();
  await expect(
    page.getByText("Wait for the connection to come back")
  ).toBeVisible();

  await page.unroute(SOCKET_IO);

  await expect(page.getByText("Reconnecting to server…")).toBeHidden({
    timeout: 10_000,
  });
  await expect(send).toBeEnabled();
});
