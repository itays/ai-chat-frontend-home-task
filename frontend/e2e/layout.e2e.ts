import { expect, test, type Page } from "@playwright/test";

const TITLES = ["VPN access issue", "New hire setup", "Incident triage"];

const chatList = (page: Page) =>
  page.getByRole("navigation", { name: "Chats" });

const chatButton = (page: Page, title: string) =>
  chatList(page).getByRole("button", { name: new RegExp(title) });

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

const pageErrors: Error[] = [];

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test("lists the chats, selects one into the URL, and restores it on reload @smoke", async ({
  page,
}) => {
  await page.goto("/");

  await expect(chatList(page).getByRole("button")).toHaveCount(3);
  for (const [index, title] of TITLES.entries()) {
    await expect(chatList(page).getByRole("button").nth(index)).toContainText(
      new RegExp(`${title}.*(Idle|Responding|Finished)`)
    );
  }
  await expect(page.getByText("Select a chat")).toBeVisible();

  await chatButton(page, "New hire setup").click();

  await expect(page).toHaveURL(/\?chat=new-hire-setup$/);
  await expect(heading(page)).toHaveText("New hire setup");
  await expect(chatButton(page, "New hire setup")).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.reload();

  await expect(heading(page)).toHaveText("New hire setup");
  await expect(chatButton(page, "New hire setup")).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("follows back and forward navigation between chats", async ({ page }) => {
  await page.goto("/?chat=vpn-access");
  await expect(heading(page)).toHaveText("VPN access issue");

  await chatButton(page, "Incident triage").click();
  await expect(heading(page)).toHaveText("Incident triage");

  await page.goBack();
  await expect(heading(page)).toHaveText("VPN access issue");
  await expect(chatButton(page, "VPN access issue")).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.goForward();
  await expect(heading(page)).toHaveText("Incident triage");
});

test("says the chat was not found for an unknown id", async ({ page }) => {
  await page.goto("/?chat=nope");

  await expect(page.getByText("Chat not found")).toBeVisible();
  await expect(chatList(page).getByRole("button")).toHaveCount(3);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens the chat list as a sheet and closes it after selecting", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(chatList(page)).toBeHidden();

    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await chatButton(page, "Incident triage").click();

    await expect(chatList(page)).toBeHidden();
    await expect(heading(page)).toHaveText("Incident triage");
  });
});
