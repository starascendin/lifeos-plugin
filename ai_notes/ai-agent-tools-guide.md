# AI Agent Tools Development Guide

How to create tools that allow AI agents (like LiveKit voice agent) to interact with user data stored in Convex.

## Architecture Overview

```
┌─────────────────────────────────┐
│  AI Agent (LiveKit/OpenAI)      │
│  - Defines tools via llm.tool() │
│  - Validates params with Zod    │
└────────────┬────────────────────┘
             │ POST /tool-call
             │ X-API-Key header
             ▼
┌─────────────────────────────────┐
│  Convex HTTP Endpoint           │
│  (convex/http.ts)               │
│  - Validates API key            │
│  - Routes to internal handler   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Tool Implementation            │
│  (convex/lifeos/tool_call.ts)   │
│  - internalQuery for reads      │
│  - internalMutation for writes  │
│  - Queries Convex database      │
└─────────────────────────────────┘
```

## Adding a New Tool (3 Files)

### Step 1: Backend - tool_call.ts

```typescript
// 1. Add to TOOL_DEFINITIONS (documentation)
export const TOOL_DEFINITIONS = {
  // ... existing tools
  my_new_tool: {
    description: "What this tool does",
    params: {
      requiredParam: "required - description",
      optionalParam: "optional - description",
    },
  },
};

// 2. Create internalQuery (read) or internalMutation (write)
export const myNewToolInternal = internalQuery({
  args: {
    userId: v.string(),
    requiredParam: v.string(),
    optionalParam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Query database
    const data = await ctx.db
      .query("your_table")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Return voice-friendly response
    return {
      data,
      summary: { count: data.length },
      generatedAt: new Date().toISOString(),
    };
  },
});
```

### Step 2: HTTP Routing - http.ts

```typescript
// 1. Add to AVAILABLE_TOOLS array
const AVAILABLE_TOOLS = [
  // ... existing
  "my_new_tool",
] as const;

// 2. Add case in switch statement
case "my_new_tool":
  result = await ctx.runQuery(internal.lifeos.tool_call.myNewToolInternal, {
    userId: auth.userId,
    requiredParam: params?.requiredParam as string,
    optionalParam: params?.optionalParam as string | undefined,
  });
  break;
```

### Step 3: Agent - agent.ts (LiveKit)

```typescript
// 1. Add to ToolName type
type ToolName =
  | 'existing_tool'
  | 'my_new_tool';

// 2. Add tool definition in tools object
my_new_tool: llm.tool({
  description: "Description for the LLM to understand when to use this tool",
  parameters: z.object({
    requiredParam: z.string().describe('What this param is for'),
    optionalParam: z.string().optional().describe('Optional parameter'),
  }),
  execute: async (params) => {
    if (!userId) {
      return { error: 'User not authenticated.' };
    }
    const response = await callConvexTool('my_new_tool', userId, params);
    if (!response.success) {
      return { error: response.error };
    }
    return response.result;
  },
}),
```

## Key Patterns

### Authentication
- Agent sends `X-API-Key` header with requests
- HTTP endpoint validates key and extracts userId
- All internal handlers receive userId to scope queries

### Response Format (Voice-Friendly)
```typescript
return {
  // Main data (simplified for voice)
  items: [...],

  // Summary stats
  summary: {
    total: items.length,
    byStatus: { todo: 3, done: 2 },
  },

  // Metadata
  generatedAt: new Date().toISOString(),
};
```

### Query vs Mutation
- `internalQuery` - Read-only operations (get tasks, search notes)
- `internalMutation` - Write operations (create note, update tags)

## Available Tools (Current)

| Tool | Type | Description |
|------|------|-------------|
| `get_todays_tasks` | Query | Tasks due today + top priority |
| `get_daily_agenda` | Query | Full daily agenda with voice note count |
| `get_weekly_agenda` | Query | 7-day task view + AI summary |
| `get_projects` | Query | Projects with completion stats |
| `get_tasks` | Query | Filtered task list |
| `search_notes` | Query | Full-text search voice notes |
| `get_recent_notes` | Query | Latest voice memos |
| `create_quick_note` | Mutation | Create text note |
| `add_tags_to_note` | Mutation | Add tags to existing note |

## Testing

```bash
# Deploy to dev
cd packages/holaaiconvex
npx convex dev --once

# Test tool via curl
curl -X POST https://your-convex-url.convex.site/tool-call \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tool-call-secret-key-2024" \
  -d '{"tool": "get_daily_agenda", "userId": "user-id-here"}'
```

## Files Reference

- `packages/holaaiconvex/convex/lifeos/tool_call.ts` - Tool implementations
- `packages/holaaiconvex/convex/http.ts` - HTTP routing (lines 1140-1355)
- `packages/livekit-voice-agent/agent.ts` - Voice agent tool definitions
