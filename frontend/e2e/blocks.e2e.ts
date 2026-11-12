import { expect, test, type Page } from "@playwright/test";
import {
  connectToBackend,
  getChat as getChatFrom,
  type BackendConnection,
} from "./backend.ts";

const messages = (page: Page) => page.getByRole("log", { name: "Messages" });

const pageErrors: Error[] = [];

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
  // Any alert means markdown HTML was executed instead of shown as text.
  page.on("dialog", (dialog) => {
    pageErrors.push(new Error(`Unexpected dialog: ${dialog.message()}`));
    void dialog.dismiss();
  });
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test("renders markdown and a finished Tool Call from the Snapshot", async ({
  page,
}) => {
  await page.goto("/?chat=vpn-access");

  const log = messages(page);
  await expect(
    log.locator("strong", { hasText: "three failed VPN sign-ins" })
  ).toBeVisible();
  await expect(log.locator("code", { hasText: "LT-4471" })).toBeVisible();
  await expect(
    log.getByRole("group", { name: "Checking VPN sign-in logs" })
  ).toContainText(/Succeeded.*3 failed attempts: password expired/);
});

test.describe("Blocks streamed in Turns", () => {
  // One worker, so the Turns below are played once rather than raced by parallel workers.
  test.describe.configure({ mode: "serial" });

  // This spec advances this Chat on the shared backend; other specs that send messages must use another Chat.
  const CHAT_ID = "incident-triage";
  // The first two Turns bring a table, the escaped <img onerror> quote, and a `chart` Unknown Block.
  const TURNS = [
    "Yes, show me the related tickets.",
    "What changed before the failures started?",
  ];

  let backend: BackendConnection;

  const getChat = () => getChatFrom(backend, CHAT_ID);

  const waitUntilIdle = () =>
    expect
      .poll(async () => (await getChat()).status, { timeout: 15_000 })
      .toBe("idle");

  test.beforeAll(async () => {
    backend = await connectToBackend();
  });

  test.afterAll(() => {
    backend.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?chat=${CHAT_ID}`);
  });

  // Runs first: the later tests read the Blocks these Turns add.
  test("shows the user's Messages and the Blocks they bring into the open Chat", async ({
    page,
  }) => {
    const log = messages(page);
    await expect(
      log.getByText(/Customers are already reporting it/)
    ).toBeVisible();

    // Plays each Turn the Chat has not had yet, so reruns against a reused
    // backend still pass (then the Blocks come from the Snapshot instead).
    for (const text of TURNS) {
      await waitUntilIdle();
      if ((await getChat()).suggestion !== text) continue;
      const ack = await backend.request("message:send", {
        chatId: CHAT_ID,
        text,
      });
      expect(ack).toMatchObject({ ok: true });
    }
    await waitUntilIdle();

    for (const text of TURNS) {
      await expect(log.getByText(text, { exact: true })).toHaveCSS(
        "white-space",
        "pre-wrap"
      );
    }
    await expect(
      log.getByRole("group", { name: "Searching customer tickets" })
    ).toContainText(/Succeeded.*4 tickets found/);
    await expect(
      log.getByRole("group", { name: "Checking recent deployments" })
    ).toContainText("Succeeded");
  });

  test("shows raw HTML in markdown as text without running it", async ({
    page,
  }) => {
    const quote = messages(page).locator("blockquote");

    await expect(quote).toContainText(
      `Pay <img src=x onerror="alert('xss')"> and my card was charged twice.`
    );
    await expect(messages(page).locator("img")).toHaveCount(0);
  });

  test("shows a table with its columns", async ({ page }) => {
    const table = messages(page).getByRole("table");

    await expect(table.getByRole("columnheader")).toHaveText([
      "Ticket",
      "Opened (UTC)",
      "Customer",
      "Summary",
      "Priority",
    ]);
    await expect(table.getByRole("row").nth(1)).toContainText("INC0019876");
  });

  test("shows an unsupported Block with its raw data on request", async ({
    page,
  }) => {
    const unknown = messages(page).locator("details", {
      hasText: "Unsupported content · chart",
    });

    await expect(unknown).toBeVisible();
    await expect(
      unknown.getByText(/Checkout error rate, eu-west-1/)
    ).toBeHidden();

    await unknown.getByText("Unsupported content").click();

    await expect(
      unknown.getByText(/Checkout error rate, eu-west-1/)
    ).toBeVisible();
  });

  test("scrolls a wide table and code block sideways inside the Block, not the Chat", async ({
    page,
  }) => {
    const log = messages(page);
    const code = log.locator("pre", { hasText: "ETIMEDOUT" });
    // The shadcn Table wraps the <table> in its own scroll container.
    const tableScroller = log.getByRole("table").locator("..");
    await expect(code).toBeVisible();

    const scrollsSideways = (element: {
      scrollWidth: number;
      clientWidth: number;
    }) => element.scrollWidth > element.clientWidth;
    expect(await code.evaluate(scrollsSideways)).toBe(true);
    expect(await tableScroller.evaluate(scrollsSideways)).toBe(true);
    expect(await log.evaluate(scrollsSideways)).toBe(false);
  });
});
