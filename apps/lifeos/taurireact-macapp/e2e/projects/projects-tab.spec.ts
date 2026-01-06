import { test, expect } from "../fixtures/auth.fixture";

test("navigates to Projects tab", async ({ page }) => {
  await page.goto("/#/lifeos");

  // Ensure Projects section expanded (it is by default, but be defensive)
  const projectsLink = page.getByRole("link", { name: "Projects", exact: true });
  if (!(await projectsLink.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Projects", exact: true }).click();
  }

  await projectsLink.click();
  await page.waitForURL(/#\/lifeos\/pm\/projects/);

  await expect(page.getByRole("heading", { name: "Project Management" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
});

