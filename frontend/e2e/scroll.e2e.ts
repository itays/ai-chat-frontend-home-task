import { expect, test, type Locator, type Page } from "@playwright/test";

// Short enough that every Chat's history overflows the message list.
test.use({ viewport: { width: 1024, height: 360 } });

const pageErrors: Error[] = [];

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

/** The scrolling container around the Messages log. */
const scroller = (page: Page) => page.getByRole("region", { name: "Messages" });

const expectAtLatestMessage = async (messages: Locator) => {
  await expect
    .poll(() =>
      messages.evaluate(
        (element) =>
          element.scrollHeight - element.scrollTop - element.clientHeight
      )
    )
    .toBeLessThanOrEqual(1);
};

const scrollUp = async (page: Page, messages: Locator) => {
  await messages.hover();
  await page.mouse.wheel(0, -5000);
  await expect
    .poll(() => messages.evaluate((element) => element.scrollTop))
    .toBe(0);
};

test("opens a Chat at its latest Message", async ({ page }) => {
  await page.goto("/?chat=vpn-access");
  const messages = scroller(page);
  await expect(messages.getByRole("log")).not.toBeEmpty();

  expect(
    await messages.evaluate(
      (element) => element.scrollHeight > element.clientHeight
    )
  ).toBe(true);
  await expectAtLatestMessage(messages);
});

test("jumps back to the latest Message after scrolling up", async ({
  page,
}) => {
  await page.goto("/?chat=vpn-access");
  const messages = scroller(page);
  const jump = page.getByRole("button", { name: "Scroll to end" });
  await expectAtLatestMessage(messages);
  await expect(jump).toHaveAttribute("data-active", "false");

  await scrollUp(page, messages);
  await expect(jump).toHaveAttribute("data-active", "true");
  await jump.click();

  await expectAtLatestMessage(messages);
  await expect(jump).toHaveAttribute("data-active", "false");
});

test("lands at the latest Message when switching Chats", async ({ page }) => {
  await page.goto("/?chat=vpn-access");
  const messages = scroller(page);
  await expectAtLatestMessage(messages);
  await scrollUp(page, messages);

  await page
    .getByRole("navigation", { name: "Chats" })
    .getByRole("button", { name: /New hire setup/ })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "New hire setup" })
  ).toBeVisible();
  await expectAtLatestMessage(scroller(page));
});
