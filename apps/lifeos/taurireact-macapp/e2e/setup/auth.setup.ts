import { test as setup, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const authFile = path.join(projectRoot, "playwright/.clerk/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD");
  }

  await fs.mkdir(path.dirname(authFile), { recursive: true });

  // Inject Clerk testing token to bypass bot detection
  await setupClerkTestingToken({ page });

  // Clerk testing helper signs in without going through Google OAuth UI
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: email,
      password,
    },
  });

  // Hit a protected route and wait for the main app shell to render
  await page.goto("/#/lifeos");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: authFile });
});

