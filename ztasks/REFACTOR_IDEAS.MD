# Refactor Ideas (Tauri LifeOS app + Convex backend)

Scope:
- Tauri app (React + TS + Rust): `apps/lifeos/taurireact-macapp`
- Convex backend: `packages/holaaiconvex/convex`

Goals:
- Reduce duplication (DRY)
- Improve readability + separation of concerns (clean code)
- Move toward clear DDD boundaries (domain/application/infrastructure/presentation)

---

## 1) High-signal duplication (best ROI)

### 1.1 Duplicate “conversation CRUD” patterns (ChatNexus + LLMCouncil)

Where:
- Frontend contexts:
  - `apps/lifeos/taurireact-macapp/src/lib/contexts/ChatNexusContext.tsx`
  - `apps/lifeos/taurireact-macapp/src/lib/contexts/LLMCouncilContext.tsx`
- Convex “public APIs”:
  - `packages/holaaiconvex/convex/lifeos/chatnexus.ts`
  - `packages/holaaiconvex/convex/lifeos/llmcouncil.ts`
- Convex HTTP streaming endpoints (big monolith):
  - `packages/holaaiconvex/convex/http.ts`

Symptoms:
- Same flow repeated: list conversations → load messages → create → update title → archive → delete (+ delete messages).
- Similar SSE client logic in the React contexts (auth token, site URL conversion, stream parsing, error handling).
- Similar authorization/ownership checks repeated across Convex functions and again in `http.ts`.

Proposal:
- Introduce a shared “Conversation” core in both frontend + backend:
  - **Backend (Convex)**: extract reusable helpers into `packages/holaaiconvex/convex/lifeos/_shared/conversations.ts`:
    - `assertConversationOwner(ctx, conversationId, tableName)`
    - `deleteConversationCascade(ctx, conversationId, messageTableName)`
    - `archiveById(ctx, tableName, id)`
    - shared “update patch” builder (see 2.2)
  - **Frontend (Tauri React)**: create `apps/lifeos/taurireact-macapp/src/lib/convex/streaming.ts`:
    - `getConvexSiteUrl(VITE_CONVEX_URL)`
    - `fetchWithClerkToken(getToken, url, body)`
    - `consumeSSE(reader, onEvent)` (support both “data-only” and “event/data”)
  - Keep “ChatNexus specific” and “LLMCouncil specific” logic (panel layouts vs 3-stage deliberation) as feature-level code, but move the shared plumbing out of the contexts.

DDD angle:
- “Conversation” and “Message” are entities; “streaming” and “HTTP endpoints” are infrastructure concerns.
- Contexts should orchestrate use-cases, not embed protocol parsing.

---

### 1.2 Duplicate PM logic in public APIs vs AI/internal APIs

Where:
- PM public endpoints:
  - `packages/holaaiconvex/convex/lifeos/pm_projects.ts`
  - `packages/holaaiconvex/convex/lifeos/pm_issues.ts`
  - `packages/holaaiconvex/convex/lifeos/pm_cycles.ts`
- PM internal/AI endpoints:
  - `packages/holaaiconvex/convex/lifeos/pm_ai_internal.ts`
- PM agent tools:
  - `packages/holaaiconvex/convex/lifeos/lib/pm_tools.ts`

Symptoms:
- Same business rules duplicated (e.g. `generateProjectKey` appears in both `pm_projects.ts` and `pm_ai_internal.ts`).
- Same “update patch” patterns repeated across many mutations.
- Same enum sets (status/priority/etc) repeated in:
  - Convex validators (`pm_schema.ts`)
  - frontend PM types (`PMContext.tsx`)
  - zod tool schemas (`pm_tools.ts`)

Proposal:
- Create a single **PM domain module** and have both the public API + internal AI API call it:
  - `packages/holaaiconvex/convex/lifeos/pm/domain/*` (pure-ish helpers: identifiers, status transitions, sort order, date handling)
  - `packages/holaaiconvex/convex/lifeos/pm/repos/*` (db access patterns)
  - `packages/holaaiconvex/convex/lifeos/pm/api/*` (thin query/mutation wrappers)
- Centralize PM enums as constants once, then derive:
  - TS literal unions
  - Convex `v.union(v.literal(...))` validators
  - Zod enums for tools
  - UI display config maps
  - Suggested shape:
    - `const ISSUE_STATUSES = [...] as const; type IssueStatus = ...`

DDD angle:
- PM is a bounded context; avoid scattering its invariants across “web API” + “AI API” + “UI”.

---

### 1.3 Repeated “build mode / bundle id / app paths” in Rust

Where:
- `apps/lifeos/taurireact-macapp/src-tauri/src/notes.rs`
- `apps/lifeos/taurireact-macapp/src-tauri/src/screentime.rs`
- `apps/lifeos/taurireact-macapp/src-tauri/src/voicememos.rs`
- `apps/lifeos/taurireact-macapp/src-tauri/src/council_server/persistence.rs`

Symptoms:
- Multiple copies of `fn get_bundle_id() -> &'static str`.
- Similar “build env → data dir” logic repeated with slightly different locations.

Proposal:
- Create `apps/lifeos/taurireact-macapp/src-tauri/src/config.rs`:
  - `pub fn bundle_id() -> &'static str`
  - `pub fn app_support_dir() -> PathBuf`
  - `pub fn local_db_dir(feature: &str) -> PathBuf`
- Have each module call into `config` rather than duplicating env logic.

DDD angle:
- “Build mode” and filesystem layout are infrastructure; isolate them in a single place.

---

## 2) Cross-cutting cleanup for DRY + safety

### 2.1 Centralize `isTauri` + environment branching

Where:
- Many files define `const isTauri = typeof window !== "undefined" && "__TAURI__" in window;` (e.g. `src/main.tsx`, `src/App.tsx`, `src/LifeOSApp.tsx`, many `src/lib/services/*.ts`)

Proposal:
- Create `apps/lifeos/taurireact-macapp/src/lib/env.ts` exporting:
  - `export const isTauri = ...`
  - optionally `export const isWeb = !isTauri`
- Replace scattered checks with a single import.
- Bonus: consolidate the duplicated “hide on close” window behavior into `useHideOnClose()` used by both `App.tsx` and `LifeOSApp.tsx`.

---

### 2.2 Standardize “ownership + patch” helpers in Convex

Where:
- Many files repeat:
  - `const user = await requireUser(ctx);`
  - `const doc = await ctx.db.get(id); if (!doc || doc.userId !== user._id) throw ...`
  - `const updates: Partial<Doc<...>> = { updatedAt: now }; if (args.x !== undefined) updates.x = args.x; ...`

Proposal:
- Add small helpers in `packages/holaaiconvex/convex/_lib` or `packages/holaaiconvex/convex/lifeos/_shared`:
  - `requireOwned(ctx, table, id)` → returns doc (typed) or throws standardized error
  - `buildPatch(args, fields)` or `setIfDefined(updates, args, "field")`
  - `now()` wrapper if you want consistent timestamps and easier testing
- Prefer throwing `ConvexError` (with codes) for predictable client behavior instead of many ad-hoc `new Error(...)`.

---

### 2.3 Fix “query by X then filter by user” with better indexes

Observed pattern:
- Query uses an index that doesn’t include `userId`, then filters in memory:
  - `pm_issues.ts`: `by_project`, `by_cycle`, `by_project_status` + `.filter(i => i.userId === user._id)`
  - `pm_cycles.ts`: `by_project` then filter by user
  - `pm_labels.ts`: `by_project` then filter by user
  - `habits.ts`: `by_category` then filter by user
  - `chatnexus.ts`: `getMessagesByBroadcast` uses `by_broadcast` then filter by user

Why it matters:
- Wastes reads and can become a performance problem as the app becomes multi-user.
- It’s also easier to accidentally forget the post-filter and leak data.

Proposal:
- Add composite indexes that include `userId` for multi-tenant safety, e.g.:
  - `lifeos_pmIssues`: `by_user_project`, `by_user_cycle`, `by_user_project_status`
  - `lifeos_pmCycles`: `by_user_project` (and optionally `by_user_project_status`)
  - `lifeos_pmLabels`: `by_user_project`
  - `lifeos_habits`: `by_user_category`
  - `lifeos_chatnexusMessages`: `by_user_broadcast`
- Update the queries to use those indexes so “filter-by-user” is done by the database/index, not in JS.

---

## 3) File/module size and boundaries (clean code)

### 3.1 Break up the Convex HTTP router

Where:
- `packages/holaaiconvex/convex/http.ts` (~1000+ lines) mixes:
  - routing
  - auth/identity
  - CORS
  - chat streaming logic
  - API-key testing
  - etc.

Proposal:
- Keep `convex/http.ts` as the composition root only:
  - `import { registerChatNexusRoutes } from "./lifeos/chatnexus/http";`
  - `import { registerLLMCouncilRoutes } from "./lifeos/llmcouncil/http";`
  - `import { registerCommonRoutes } from "./common/http";` (if needed)
- Add a shared `http/_lib`:
  - `corsHeaders()`
  - `requireHttpUser(ctx)` (identity → `internal.common.users.getUserByTokenIdentifier`)
  - `jsonError(status, message, cors)`
  - `sseResponse(stream, cors)`

Outcome:
- Easier to reason about per-bounded-context APIs and avoid accidental coupling.

---

### 3.2 Split very large Convex domain files into `queries.ts` + `mutations.ts` + `services.ts`

Where (examples):
- `packages/holaaiconvex/convex/lifeos/pm_cycles.ts` (large; contains heavy computed breakdown logic)
- `packages/holaaiconvex/convex/lifeos/habits_checkins.ts` (contains business logic + multiple helpers)

Proposal:
- Move pure computations to domain services:
  - e.g. `pm/domain/cycle_breakdowns.ts`, `habits/domain/streaks.ts`, `habits/domain/schedule.ts`
- Keep query/mutation files thin and readable.

---

### 3.3 Restructure Tauri React app into “feature modules”

Current shape:
- `src/components/*` + `src/lib/contexts/*` + `src/lib/services/*`

Proposal target:
- `src/app/*` (routing + provider composition root)
- `src/features/*` (bounded contexts):
  - `features/sync-jobs/*` (YouTube/ScreenTime/Notes/VoiceMemos/Council server tab UI)
  - `features/pm/*`
  - `features/habits/*`
  - `features/chatnexus/*`
  - `features/llmcouncil/*`
- `src/shared/*` (UI primitives, hooks like `useAutoScroll`, generic components)
- `src/infra/*` (Convex client helpers, Tauri invoke wrappers, SSE client)

Outcome:
- Clearer DDD-ish separation: domain UI stays in features; infrastructure stays in `infra`.

---

## 4) Type consistency across Rust ↔ TS ↔ Convex

### 4.1 Prefer camelCase at boundaries (or isolate snake_case)

Where:
- TS “Rust struct mirror” types use snake_case fields (e.g. `duration_seconds`) in:
  - `apps/lifeos/taurireact-macapp/src/lib/services/screentime.ts`
  - `apps/lifeos/taurireact-macapp/src/lib/services/voicememos.ts`
  - `apps/lifeos/taurireact-macapp/src/lib/services/notes.ts`

Proposal options:
1) Rust emits camelCase JSON via serde attributes:
   - `#[serde(rename_all = "camelCase")]`
   - TS types become normal camelCase and match Convex fields more naturally.
2) Keep Rust snake_case, but create explicit mappers in a single “bridge” module:
   - `infra/tauri/mappers.ts`
   - This prevents snake_case from spreading through the app.

---

### 4.2 Single source of truth for model IDs/tier config

Where:
- Frontend uses `src/lib/constants/models.ts`
- Backend hardcodes some defaults (e.g. `DEFAULT_COUNCIL_MODELS` in `packages/holaaiconvex/convex/lifeos/llmcouncil.ts`)
- ChatNexus and LLMCouncil each have their own assumptions about providers/models.

Proposal:
- Create a shared “model registry” package (or a shared module under `packages/`):
  - exports `WHITELISTED_MODELS`, `PROVIDERS`, `TIERS`, defaults
  - imported by:
    - frontend contexts/components
    - Convex actions that need defaults/validation
- Bonus: validate incoming model IDs server-side against the registry (avoid arbitrary model usage).

---

## 5) Smaller “quality of life” refactors

- Consolidate repeated “auto-scroll to bottom” logic into `useAutoScrollToBottom(ref, deps)` used by chat panels.
- Replace “magic strings” for localStorage keys with a `storageKeys.ts`.
- Normalize date handling (`YYYY-MM-DD`) into a single value-object-like helper:
  - avoid scattered `toLocaleDateString('en-CA')`, `"YYYY-MM-31"`, etc.
- In Convex, use existing indexes consistently (e.g. conversation “sorted by updatedAt” comments should match the index actually used; consider adding `by_user_archived_updated` where needed).

---

## Suggested implementation order

1) Convex: add shared helpers for ownership + patch building; add missing composite indexes; refactor the worst “query then filter” sites.
2) Convex: split `convex/http.ts` into per-domain route modules with shared auth/CORS helpers.
3) LifeOS (React): extract `isTauri`, `useHideOnClose`, and shared SSE client helpers; reduce duplication in ChatNexus + LLMCouncil contexts.
4) LifeOS (Rust): centralize bundle id + app paths; consider serde casing strategy.
5) PM: unify enums/types and consolidate duplicated PM business logic into a domain module used by both public + internal AI endpoints.

