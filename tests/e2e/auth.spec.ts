import { expect, test } from "@playwright/test";

test.describe("authentication entry", () => {
  test("renders the Vietnamese sign-in form", async ({ page }) => {
    await page.goto("/vi/login");

    await expect(page).toHaveTitle(/SaaS POS/);
    await expect(page.getByRole("heading", { name: "SaaS POS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  });

  test("keeps the route while changing the UI locale", async ({ page }) => {
    await page.goto("/vi/login");
    await page.getByRole("button", { name: "EN" }).click();

    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
