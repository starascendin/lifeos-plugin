# Improved `CLAUDE.MD` instructions (DRY + Clean Code + DDD)

Use this as a template for what we want Claude to follow in this repo.

---

## Non‑negotiables (repo constraints)

- React Native exists in this monorepo: **do not update React Native package versions** unless explicitly asked.
- Prefer **Vercel AI Gateway** for AI calls whenever possible.
- LifeOS Tauri app: prefer **shadcn/ui** components whenever possible.
- Convex changes must keep repo healthy: **no new lint/build/typecheck issues**.

---

## DDD boundaries (how to organize code)

**Bounded contexts**
- Convex backend is multi-app: keep code **by domain** (`common/`, `holaai/`, `lifeos/`) and only share via `_lib/` or `lifeos/_shared/`.
- LifeOS Tauri app: keep features separate (PM, Habits, ChatNexus, LLMCouncil, Sync Jobs).

**Rule of thumb**
- Domain rules live in domain modules; UI/transport/storage code calls into them.
- Avoid “god files”: if a file is doing routing + auth + business logic + formatting, split it.

---

## DRY rules (what to extract)

Extract a shared helper when:
- The same logic exists in **2+ places** (or would appear in the next feature).
- A pattern repeats with only table names / ids / fields changing.
- A file’s main function is longer than ~150–200 lines.

Do **not** extract when:
- It hides domain intent (helpers should reduce noise, not obscure meaning).

---

## Backend (Convex) clean-code rules

### 1) Auth + ownership is not copy/paste

Prefer one helper for “fetch doc and verify owner” and reuse everywhere.

Example (conceptual):
```ts
const project = await requireOwned(ctx, "lifeos_pmProjects", args.projectId);
// project is guaranteed to exist and belong to user
```

### 2) Avoid “query then filter by user”

If you see:
```ts
const rows = await ctx.db.query("X").withIndex("by_something", ...).collect();
return rows.filter((r) => r.userId === user._id);
```
…then add/use a **composite index including `userId`** and query with it instead.

### 3) One source of truth for enums/validators

Statuses/priorities should be defined once and reused to derive:
- TS union types
- Convex validators (`v.union(v.literal(...))`)
- UI display configs
- Zod schemas (agent tools)

Example (conceptual):
```ts
export const ISSUE_STATUSES = ["backlog","todo","in_progress","done"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
```

### 4) Keep `convex/http.ts` as a composition root

`convex/http.ts` should mostly be:
- route registration
- shared HTTP utilities (CORS, auth extraction)

Route logic should live per bounded context, e.g.:
- `lifeos/chatnexus/http.ts`
- `lifeos/llmcouncil/http.ts`

### 5) Prefer typed errors and consistent messages

Use consistent error shapes/codes so the frontend can handle them predictably (avoid many ad-hoc `throw new Error("...")` strings).

---

## Frontend (Tauri React) clean-code rules

### 1) Context providers orchestrate; they shouldn’t implement protocols

Move “plumbing” out of contexts:
- SSE parsing
- `VITE_CONVEX_URL` → `.site` conversion
- fetch wrappers with Clerk token

Example:
```ts
const siteUrl = getConvexSiteUrl(import.meta.env.VITE_CONVEX_URL);
await postSSE({ url: `${siteUrl}/chatnexus/stream`, token, body, onEvent });
```

### 2) Centralize environment checks

Don’t repeat `const isTauri = ...` in many files—use one module:
```ts
import { isTauri } from "@/lib/env";
```

### 3) Prefer feature modules over global “components/” dumping

If adding/modifying a LifeOS feature, keep it contained:
- `features/pm/*`
- `features/habits/*`
- `features/chatnexus/*`
- `features/llmcouncil/*`
- `features/sync-jobs/*`

Shared UI/hooks go in `shared/` (not copied between features).

---

## Tauri (Rust) clean-code rules

- Centralize build-mode + bundle-id + app-data-path logic in one module (e.g. `config.rs`) and reuse it across `notes.rs`, `screentime.rs`, `voicememos.rs`, etc.
- Keep OS-specific details isolated; Rust commands should be small and delegate to internal helpers.

Example:
```rust
let db_path = config::local_db_path("screentime", "screentime.db");
```

---

## “Before you finish” checklist

- Did you introduce any duplicated logic? If yes, extract it now.
- Did you keep domain code inside its bounded context (lifeos vs holaai vs common)?
- Did you avoid query+filter patterns by adding/using composite indexes?
- Did you keep HTTP/SSE logic in shared infra instead of duplicating it in contexts?
- If Convex changed: does `pnpm -r lint` and `pnpm -r typecheck` stay clean?

