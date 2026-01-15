# Plan: Web-Based Coder Agent Delegation for LIFEos

## Summary

Add the ability to delegate issues to Coder agents from the **web app** (Vercel deployment), not just the Tauri desktop app. Uses **per-user OAuth** so each user authenticates with their own Coder account and tasks are attributed to them.

## Current State

- **Tauri**: Works via local `coder` CLI (`coder task create`)
  - `src-tauri/src/coder.rs` - Rust backend executing CLI commands
  - `src/lib/services/coder.ts` - Frontend service (Tauri-only)
  - `src/components/pm/issue/IssueProperties.tsx` - UI with `isCoderAvailable()` check

- **Web**: No support - `isCoderAvailable()` returns `false` on web

## Solution: Per-User OAuth + Convex Action + Coder REST API

Coder v2.27+ has REST API support for Tasks at `POST /api/v2/tasks`.

**Your Coder Server**: `https://coder-production-coder2.rocketjump.tech/`

**Auth Flow**: User creates their own API token in Coder → saves to LIFEos → stored in Convex per-user

---

## Implementation Plan

### Step 1: Add Schema for User Coder Tokens

**File**: `packages/holaaiconvex/convex/lifeos/pm_schema.ts`

Add new table to store per-user Coder credentials:

```typescript
lifeos_coderIntegration: defineTable({
  userId: v.id("users"),
  coderUrl: v.string(),           // e.g., "https://coder-production-coder2.rocketjump.tech"
  coderApiToken: v.string(),      // User's personal API token (encrypted ideally)
  coderUsername: v.optional(v.string()),
  connectedAt: v.number(),
  lastUsedAt: v.optional(v.number()),
}).index("by_user", ["userId"]),
```

### Step 2: Create Convex Actions for Coder API

**File**: `packages/holaaiconvex/convex/lifeos/pm_coder.ts`

```typescript
"use node";

import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireUser } from "../_lib/auth";

const DEFAULT_CODER_URL = "https://coder-production-coder2.rocketjump.tech";

// ==================== QUERIES ====================

// Check if user has Coder connected
export const isConnected = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const integration = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return !!integration;
  },
});

// Get user's Coder integration (without exposing full token)
export const getIntegration = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const integration = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!integration) return null;
    return {
      coderUrl: integration.coderUrl,
      coderUsername: integration.coderUsername,
      connectedAt: integration.connectedAt,
      lastUsedAt: integration.lastUsedAt,
      hasToken: !!integration.coderApiToken,
    };
  },
});

// ==================== MUTATIONS ====================

// Save user's Coder API token
export const connectCoder = mutation({
  args: {
    coderUrl: v.optional(v.string()),
    coderApiToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const coderUrl = args.coderUrl || DEFAULT_CODER_URL;
    const now = Date.now();

    // Check if already connected
    const existing = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        coderUrl,
        coderApiToken: args.coderApiToken,
        connectedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("lifeos_coderIntegration", {
      userId: user._id,
      coderUrl,
      coderApiToken: args.coderApiToken,
      connectedAt: now,
    });
  },
});

// Disconnect Coder
export const disconnectCoder = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("lifeos_coderIntegration")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ==================== ACTIONS ====================

// List templates (uses user's token)
export const listTemplates = action({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const integration = await ctx.runQuery(internal.lifeos.pm_coder.getIntegrationInternal, {
      userId: user._id,
    });

    if (!integration) {
      throw new Error("Coder not connected. Please connect your Coder account first.");
    }

    const response = await fetch(`${integration.coderUrl}/api/v2/templates`, {
      headers: { "Coder-Session-Token": integration.coderApiToken },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Coder token invalid or expired. Please reconnect.");
      }
      throw new Error(`Coder API error: ${response.status}`);
    }

    const templates = await response.json();
    return templates.map((t: any) => ({
      name: t.name,
      display_name: t.display_name || t.name,
    }));
  },
});

// List presets for a template
export const listPresets = action({
  args: { template: v.string() },
  handler: async (_, args) => {
    // Presets are defined in template's main.tf
    // Return known presets for now
    if (args.template === "testtaskdocker") {
      return [
        { name: "hola-monorepo" },
        { name: "hola-monorepo (Sonnet)" },
        { name: "mindworks-kortex-monorepo" },
        { name: "mindworks-kortex (Sonnet)" },
      ];
    }
    return [{ name: "default" }];
  },
});

// Create a Coder task
export const createTask = action({
  args: {
    template: v.string(),
    preset: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const integration = await ctx.runQuery(internal.lifeos.pm_coder.getIntegrationInternal, {
      userId: user._id,
    });

    if (!integration) {
      return { success: false, error: "Coder not connected" };
    }

    try {
      const response = await fetch(`${integration.coderUrl}/api/v2/tasks`, {
        method: "POST",
        headers: {
          "Coder-Session-Token": integration.coderApiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_name: args.template,
          preset_name: args.preset,
          prompt: args.prompt,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `API error: ${response.status} - ${error}` };
      }

      const task = await response.json();

      // Update last used timestamp
      await ctx.runMutation(internal.lifeos.pm_coder.updateLastUsed, {
        userId: user._id,
      });

      return {
        success: true,
        taskId: task.id,
        taskUrl: `${integration.coderUrl}/@me/${task.workspace_name}`,
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
});
```

### Step 3: Create "Connect to Coder" Settings UI

**File**: `apps/lifeos/taurireact-macapp/src/components/pm/settings/CoderIntegrationSettings.tsx` (NEW)

A settings component where users can:
1. Enter their Coder server URL (default provided)
2. Enter their API token (with link to create one)
3. Test the connection
4. Disconnect if needed

```typescript
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Check, X, Loader2 } from "lucide-react";

export function CoderIntegrationSettings() {
  const integration = useQuery(api.lifeos.pm_coder.getIntegration);
  const connectCoder = useMutation(api.lifeos.pm_coder.connectCoder);
  const disconnectCoder = useMutation(api.lifeos.pm_coder.disconnectCoder);
  const listTemplates = useAction(api.lifeos.pm_coder.listTemplates);

  const [coderUrl, setCoderUrl] = useState("https://coder-production-coder2.rocketjump.tech");
  const [apiToken, setApiToken] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleConnect = async () => {
    setIsTesting(true);
    try {
      await connectCoder({ coderUrl, coderApiToken: apiToken });
      // Test the connection
      await listTemplates();
      setTestResult("success");
    } catch (e) {
      setTestResult("error");
    } finally {
      setIsTesting(false);
    }
  };

  if (integration?.hasToken) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="h-4 w-4" />
          <span>Connected to Coder</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Server: {integration.coderUrl}
        </p>
        <Button variant="outline" size="sm" onClick={() => disconnectCoder()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Coder Server URL</label>
        <Input value={coderUrl} onChange={(e) => setCoderUrl(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">API Token</label>
        <Input
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="coder_xxx..."
        />
        <a
          href={`${coderUrl}/settings/tokens`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 flex items-center gap-1 mt-1"
        >
          Create token in Coder <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <Button onClick={handleConnect} disabled={!apiToken || isTesting}>
        {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Connect
      </Button>
    </div>
  );
}
```

### Step 4: Update IssueProperties Component

**File**: `apps/lifeos/taurireact-macapp/src/components/pm/issue/IssueProperties.tsx`

Key changes:
1. Show delegation UI on both web and Tauri
2. On web: Check if user has Coder connected
3. On web: Use Convex actions instead of Tauri commands
4. Show "Connect to Coder" prompt if not connected on web

```typescript
// Add hooks
const isCoderConnected = useQuery(api.lifeos.pm_coder.isConnected);
const createTaskAction = useAction(api.lifeos.pm_coder.createTask);
const listTemplatesAction = useAction(api.lifeos.pm_coder.listTemplates);
const listPresetsAction = useAction(api.lifeos.pm_coder.listPresets);

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
const isWeb = !isTauri;

// Show delegation section if:
// - Running in Tauri (existing behavior), OR
// - Running on web AND user has Coder connected
const showDelegation = isTauri || (isWeb && isCoderConnected);

// Load templates - different source depending on platform
useEffect(() => {
  if (showDelegation) {
    if (isTauri) {
      // Existing Tauri code
      getCoderTemplates().then(setTemplates);
    } else {
      // Web: use Convex action
      listTemplatesAction().then(setTemplates);
    }
  }
}, [showDelegation, isTauri]);

const handleDelegate = async () => {
  if (isWeb) {
    // Web: use Convex action
    const result = await createTaskAction({
      template: selectedTemplate,
      preset: selectedPreset,
      prompt: formatIssuePrompt(issue),
    });
    if (result.success) {
      onDelegateSuccess?.();
      // Optionally open task URL
      if (result.taskUrl) {
        window.open(result.taskUrl, "_blank");
      }
    } else {
      setDelegateError(result.error);
    }
  } else {
    // Tauri: existing code
    const result = await delegateToCoder({ ... });
    // ...
  }
};

// In JSX: Show connect prompt for web users without Coder
{isWeb && !isCoderConnected && (
  <div className="pt-3 border-t border-border mt-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
      <Bot className="h-4 w-4" />
      <span>Delegate to Agent</span>
    </div>
    <p className="text-xs text-muted-foreground mb-2">
      Connect your Coder account to delegate issues to AI agents.
    </p>
    <Button size="sm" variant="outline" asChild>
      <Link to="/settings/integrations">Connect Coder</Link>
    </Button>
  </div>
)}
```

### Step 5: Add Settings Page Route

Add the Coder integration settings to your settings page (likely in `src/pages/Settings.tsx` or similar).

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/holaaiconvex/convex/lifeos/pm_schema.ts` | Add `lifeos_coderIntegration` table |
| `packages/holaaiconvex/convex/lifeos/pm_coder.ts` | **NEW** - Convex queries/mutations/actions |
| `apps/lifeos/.../components/pm/settings/CoderIntegrationSettings.tsx` | **NEW** - Settings UI |
| `apps/lifeos/.../components/pm/issue/IssueProperties.tsx` | Web mode support |
| `apps/lifeos/.../pages/Settings.tsx` | Add Coder integration section |

---

## User Flow (Web)

1. User opens LIFEos web app → Settings → Integrations
2. Clicks "Connect Coder" → Opens Coder in new tab → Creates API token
3. Pastes token in LIFEos → Clicks Connect → Connection tested
4. Now user sees delegation UI on issues
5. Selects template/preset → Clicks Delegate → Task created in Coder

---

## Verification

1. **Deploy schema**: `npx convex dev --once`
2. **Test connection flow**: Connect with API token in settings
3. **Test delegation**: Open issue → Select template/preset → Delegate
4. **Check Coder**: Verify task appears under your account in Coder Tasks UI
5. **Test disconnect**: Disconnect in settings → Delegation UI should show "Connect Coder"

---

## Security Notes

- API tokens are stored per-user in Convex (not shared)
- Tokens should be treated as secrets (consider encryption at rest)
- Each user's tasks are created under their own Coder account
- Tokens can be revoked in Coder UI at any time

---

## API Reference

- [Coder Tasks Docs](https://coder.com/docs/ai-coder/tasks)
- [Coder REST API](https://coder.com/docs/reference/api)
- [Automate Tasks Blog](https://coder.com/blog/automate-coder-tasks-via-cli-and-api)
