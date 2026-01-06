import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth (signed out)", () => {
  test("shows Google sign-in CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  });
});
