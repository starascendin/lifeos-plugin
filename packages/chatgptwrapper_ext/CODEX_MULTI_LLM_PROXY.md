# CODEX Multi‑LLM “Proxy” (Chrome Extension)

This package is a **Chrome MV3 extension UI** that can talk to **ChatGPT (chatgpt.com)**, **Claude (claude.ai)**, and **Gemini (gemini.google.com)** by **reusing the user’s existing logged-in browser session** (cookies + site-issued tokens), instead of using official public APIs.

It is “proxy-like” in the sense that the extension:
- runs a local UI (`index.html` + React app),
- makes privileged cross-origin `fetch()` calls to each provider’s **web app endpoints**,
- includes the user’s session via `credentials: 'include'`,
- maintains just enough per-provider “conversation context” client-side to continue a thread.

## High-level structure

- **Extension entrypoints**
  - `public/manifest.json`: MV3 manifest (host permissions + DNR rules).
  - `public/background.js`: on toolbar click, opens the extension UI tab (`index.html`).
  - `index.html` + `src/main.tsx`: React UI.
- **Provider implementations**
  - `src/services/chatgpt.ts`
  - `src/services/claude.ts`
  - `src/services/gemini.ts`
  - `src/services/proof-of-work.ts` + `public/proof-worker.js` (ChatGPT “sentinel” proof/requirements tokens)
- **Council mode (multi-model orchestration)**
  - `src/services/councilRunner.ts`: headless council runner (parallel stage1 / stage2 / stage3).
- **Optional “remote council” server**
  - `server/src/server.ts`: HTTP + WebSocket server (e.g. phone over Tailscale).
  - `src/services/remoteCouncil.ts`: extension-side WebSocket client that receives `/prompt` requests and runs council inside the browser session.

## How “use the user’s session” works (common pattern)

All three providers are called from the extension UI via `fetch()` with:

- `credentials: 'include'` so the browser **attaches the user’s cookies** for the destination site.
- `host_permissions` in `public/manifest.json` so the extension is allowed to make those cross-origin requests.

This means **the user must already be signed in** to the provider in the same Chrome profile. If the provider challenges the browser (e.g. Cloudflare), the user may need to open the site normally first.

## ChatGPT (chatgpt.com) flow

Implemented in `src/services/chatgpt.ts`.

1) **Fetch session → obtain access token**
- Calls `GET https://chatgpt.com/api/auth/session` with `credentials: 'include'`.
- Expects JSON containing `accessToken` (fails if logged out or blocked by Cloudflare challenge).

2) **Fetch “chat requirements” (sentinel)**
- Calls `POST https://chatgpt.com/backend-api/sentinel/chat-requirements`
- Sends:
  - `Authorization: Bearer <accessToken>`
  - `Oai-Device-Id: <uuid>` (stored in `localStorage` under `oai_device_id`)
  - `OpenAI` “requirements token” derived from a lightweight proof.

3) **(Optional) compute proof-of-work**
- If requirements indicate `proofofwork.required`, computes `Openai-Sentinel-Proof-Token`.
- Proof is computed in a Web Worker (`public/proof-worker.js`) via `src/services/proof-of-work.ts`.
  - The worker brute-forces a base64-encoded JSON “config” until `sha3_512(seed + candidate)` satisfies a target string prefix constraint (or returns a fallback value after ~500k iterations).

4) **Send message (SSE streaming)**
- Calls `POST https://chatgpt.com/backend-api/conversation` with:
  - `Authorization: Bearer <accessToken>`
  - `Openai-Sentinel-Chat-Requirements-Token: <requirements.token>`
  - optional `Openai-Sentinel-Proof-Token`
  - `Accept: text/event-stream`
- Parses the SSE stream and updates:
  - `conversationId` from `conversation_id`
  - `parentMessageId` from `message.id`

5) **Header rewriting (important)**
- `public/rules/chatgpt.json` uses `declarativeNetRequest` to rewrite request headers for ChatGPT XHR/fetch:
  - `Origin: https://chatgpt.com`
  - `Referer: https://chatgpt.com/`

This is likely required because the extension’s true origin is `chrome-extension://...`, and some ChatGPT endpoints enforce origin/referrer expectations.

## Claude (claude.ai) flow

Implemented in `src/services/claude.ts`.

1) **Get organization UUID**
- Calls `GET https://claude.ai/api/organizations` with `credentials: 'include'`.
- Selects the first org that has `capabilities` including `"chat"` (fallback to `orgs[0]`).
- Caches `org.uuid` in-memory (`cachedOrgUuid`).

2) **Create a conversation (if needed)**
- Calls `POST https://claude.ai/api/organizations/:orgUuid/chat_conversations`
- Sends `{ uuid, model, is_temporary: false }` where `uuid` is locally generated.

3) **Send prompt (SSE streaming)**
- Calls `POST https://claude.ai/api/organizations/:orgUuid/chat_conversations/:conversationId/completion`
- Sends `Accept: text/event-stream`
- Parses `data: {...}` SSE JSON where `completion` is appended to build the final answer.
- Maintains `{ conversationId, claudeOrgUuid }` as Claude “context”.

## Gemini (gemini.google.com) flow

Implemented in `src/services/gemini.ts`.

Gemini is implemented as a **Google “batched RPC” style call** (not classic SSE).

1) **Fetch the Gemini homepage to extract request params**
- Calls `GET https://gemini.google.com/` with `credentials: 'include'`.
- Extracts:
  - `bl` from `"cfb2h":"..."`
  - `at` from `"SNlM0e":"..."` (may be absent)
- Caches `{ bl, at }` in-memory.

2) **Build the `f.req` payload**
- Builds a JSON structure that includes:
  - the prompt
  - prior `contextIds` (stored in panel state) to keep continuity

3) **Send the request**
- Calls:
  - `POST https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=<bl>&_reqid=<random>&rt=c`
- Uses `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`
- Body includes `f.req=<...>` and optional `at=<...>`.

4) **Parse the response**
- Gemini returns a multi-line response that includes JSON envelopes like `["wrb.fr", ...]`.
- `parseGeminiResponse()` extracts:
  - assistant text
  - updated `contextIds` for the next request

## Why `X-Frame-Options` / CSP stripping exists

`public/rules/x-frame-options.json` removes `X-Frame-Options` and `Content-Security-Policy` headers for `chatgpt.com` / `openai.com` on `sub_frame` and `main_frame` loads.

The current UI does not embed the provider sites, but this rule suggests an earlier (or planned) capability to iframe provider pages inside the extension UI.

## Remote council mode (server ↔ extension bridge)

When running the optional Node server (`server/`), the React app can run in “server mode” (no Chrome APIs) and delegate execution to the extension:

- `server/src/server.ts` accepts `POST /prompt` and forwards a `council_request` over WebSocket.
- `src/services/remoteCouncil.ts` connects to `ws://localhost:3456/ws` and runs `runCouncilHeadless()` inside the extension tab, so all provider calls still happen with the **browser’s logged-in sessions**.

## Practical requirements / troubleshooting

- Must be logged in to:
  - `https://chatgpt.com/`
  - `https://claude.ai/`
  - `https://gemini.google.com/`
- If ChatGPT returns 403, open `chatgpt.com` in a normal tab to satisfy Cloudflare / bot checks, then retry.
- These integrations depend on **private web endpoints** and may break when providers change their frontend APIs.

