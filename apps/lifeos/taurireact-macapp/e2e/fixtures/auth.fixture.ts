import { test as base, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

export const test = base.extend<{ clerkAuth: void }>({
  clerkAuth: [
    async ({ page }, use) => {
      await setupClerkTestingToken({ page });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

