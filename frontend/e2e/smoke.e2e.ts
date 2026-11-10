import { expect, test } from "@playwright/test";

test("app shell renders and accepts input @smoke", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  await expect(page).toHaveTitle("AI Chat");
  await expect(page.getByText("Start here")).toBeVisible();

  const message = page.getByRole("textbox", { name: "Message" });
  await message.fill("Hello from Playwright");
  await expect(message).toHaveValue("Hello from Playwright");

  expect(pageErrors).toEqual([]);
});
