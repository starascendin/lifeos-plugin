import { test, expect } from "../fixtures/auth.fixture";

test("renders LifeOS shell when signed in", async ({ page }) => {
  await page.goto("/#/lifeos");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});

