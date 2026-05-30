import { expect, test } from "@playwright/test";

test("engineering shell renders core workbench panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Engineering Shell")).toBeVisible();
  await expect(page.getByText("Tag Management")).toBeVisible();
  await expect(page.getByText("Graphics Designer")).toBeVisible();
});
