import { expect, test, type Page } from "@playwright/test";
import { CHAT_IDS, FAKE_SERVER_URL, NOW } from "./fixtures.ts";

const pageErrors: Error[] = [];

const control = async (
  page: Page,
  action: "reset" | "drop" | "emit",
  data?: object
) => {
  const response = await page.request.post(
    `${FAKE_SERVER_URL}/control/${action}`,
    { data }
  );
  expect(response.ok()).toBe(true);
};

const openChat = async (page: Page, chatId: string) => {
  await page.goto(`/?chat=${chatId}`);
  await expect(page.getByRole("log", { name: "Messages" })).not.toBeEmpty();
};

test.describe("visual", { tag: "@visual" }, () => {
  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on("pageerror", (error) => pageErrors.push(error));
    await control(page, "reset");
    await page.clock.setFixedTime(NOW);
  });

  test.afterEach(() => {
    expect(pageErrors).toEqual([]);
  });

  test("empty state", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Select a chat" })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Chats" }).getByRole("button")
    ).toHaveCount(4);

    await expect(page).toHaveScreenshot("empty-state.png");
  });

  test("every Block type", async ({ page }) => {
    // Tall enough to show the whole Chat without scrolling.
    await page.setViewportSize({ width: 1280, height: 1100 });
    await openChat(page, CHAT_IDS.blocks);
    const log = page.getByRole("log", { name: "Messages" });

    await expect(
      log.getByText('<img src="x" onerror="alert(1)">')
    ).toBeVisible();
    await expect(log.locator("img")).toHaveCount(0);
    await expect(log.getByText("Unsupported content ·")).toHaveCount(3);

    await expect(page).toHaveScreenshot("blocks.png");
  });

  test("typing indicator while responding", async ({ page }) => {
    await openChat(page, CHAT_IDS.typing);
    await expect(page.getByText("Assistant is typing")).toBeAttached();

    await expect(page).toHaveScreenshot("responding-typing.png");
  });

  test("half-streamed Message", async ({ page }) => {
    await openChat(page, CHAT_IDS.streaming);
    await expect(page.locator("[aria-busy=true]")).toHaveCount(1);

    await expect(page).toHaveScreenshot("responding-streaming.png");
  });

  test("ghost-text Suggestion", async ({ page }) => {
    await openChat(page, CHAT_IDS.blocks);
    await page.getByRole("textbox", { name: "Message" }).fill("Thanks");
    await expect(
      page.getByText(", that's all I needed.", { exact: true })
    ).toBeVisible();

    await expect(page).toHaveScreenshot("ghost-text.png");
  });

  test("Rejected Message error", async ({ page }) => {
    await openChat(page, CHAT_IDS.blocks);
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("Can you also order me a monitor?");
    await box.press("Enter");
    await expect(
      page.getByText("Sorry, that's not the message I expected.")
    ).toBeVisible();

    await expect(page).toHaveScreenshot("rejected-message.png");
  });

  test("finished footer", async ({ page }) => {
    await openChat(page, CHAT_IDS.finished);
    await expect(page.getByText("This chat is finished")).toBeVisible();

    await expect(page).toHaveScreenshot("finished.png");
  });

  test("disconnected banner", async ({ page }) => {
    await openChat(page, CHAT_IDS.blocks);

    await control(page, "drop");

    await expect(
      page.getByRole("status").filter({ hasText: "Reconnecting to server…" })
    ).toBeVisible();
    await expect(page).toHaveScreenshot("reconnecting.png");
  });

  test("server unreachable on first connect", async ({ page }) => {
    await control(page, "drop");

    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Can't reach the server" })
    ).toBeVisible();
    await expect(page).toHaveScreenshot("server-unavailable.png");
  });

  test("sidebar with every Chat Status and an unread Chat", async ({
    page,
  }) => {
    await openChat(page, CHAT_IDS.finished);
    const chatId = CHAT_IDS.typing;
    const messageId = `${chatId}-reply`;
    // The reply completes while another Chat is open, so it stays unread.
    await control(page, "emit", {
      name: "message:created",
      chatId,
      message: {
        id: messageId,
        role: "assistant",
        status: "streaming",
        blocks: [],
        createdAt: NOW.toISOString(),
      },
    });
    await control(page, "emit", {
      name: "block:created",
      chatId,
      messageId,
      block: {
        id: `${messageId}-b1`,
        type: "markdown",
        text: "Queue cleared.",
      },
    });
    await control(page, "emit", {
      name: "message:completed",
      chatId,
      messageId,
    });
    await control(page, "emit", {
      name: "chat:status",
      chatId,
      status: "idle",
      updatedAt: NOW.toISOString(),
    });
    const sidebar = page.getByRole("navigation", { name: "Chats" });
    await expect(
      sidebar.getByRole("button", {
        name: /Printer queue stuck New response Idle/,
      })
    ).toBeVisible();

    await expect(sidebar).toHaveScreenshot("sidebar.png");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("half-streamed Message", async ({ page }) => {
      await openChat(page, CHAT_IDS.streaming);
      await expect(page.locator("[aria-busy=true]")).toHaveCount(1);

      await expect(page).toHaveScreenshot("mobile-streaming.png");
    });
  });
});
