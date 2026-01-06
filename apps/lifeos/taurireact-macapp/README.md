# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## E2E (Playwright, webapp mode)

1. Create `apps/lifeos/taurireact-macapp/.env.e2e` from `apps/lifeos/taurireact-macapp/.env.e2e.example` and fill in values.
2. Ensure your Clerk instance has Email/Password enabled and create an E2E test user matching `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD`.
3. Install deps + browsers:
   - `pnpm -C apps/lifeos/taurireact-macapp install`
   - `pnpm -C apps/lifeos/taurireact-macapp exec playwright install chromium`
4. Run:
   - `pnpm -C apps/lifeos/taurireact-macapp test:e2e`

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
