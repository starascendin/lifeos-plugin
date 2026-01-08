# AI Feature Development Guide

## Architecture Overview

All AI calls go through a centralized layer that handles credit checking and deduction automatically.

```
convex/
├── _lib/ai/           # Domain layer (providers, types, token extraction)
├── common/ai.ts       # Application layer (executeAICall, createMeteredUsageHandler)
└── common/credits.ts  # Credit mutations for streaming
```

## For Simple AI Calls (Non-Agent)

Use `executeAICall` - handles credit check, provider routing, and deduction:

```typescript
import { internal } from "../_generated/api";

const result = await ctx.runAction(internal.common.ai.executeAICall, {
  request: {
    model: "gemini-2.5-flash",  // or "openai/gpt-4o-mini" for gateway
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    responseFormat: "json",  // optional: "text" | "json"
  },
  context: {
    feature: "my_feature_name",  // for credit tracking
    description: "Optional description",
  },
});

const content = result.content;  // string response
```

## For @convex-dev/agent

Use `createMeteredUsageHandler` in agent definition + credit check in action:

```typescript
import { createMeteredUsageHandler } from "../common/ai";

// Agent definition
export const myAgent = new Agent(components.agent, {
  languageModel: gateway("openai/gpt-4o-mini"),
  usageHandler: createMeteredUsageHandler("my_agent_feature"),
  // ... other config
});

// Action handler
export const sendMessage = action({
  handler: async (ctx, { threadId, message }) => {
    // Always check credits first (fail fast)
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    // Credit deduction handled by usageHandler
    const { thread } = await myAgent.continueThread(ctx, { threadId });
    return await thread.generateText({ prompt: message });
  },
});
```

## For HTTP Streaming

After streaming completes, deduct credits:

```typescript
// After collecting streamed content
if (!creditCheck.hasUnlimitedAccess && fullContent.length > 0) {
  await ctx.runMutation(internal.common.credits.deductStreamingCreditsFromText, {
    userId: user._id,
    feature: "my_streaming_feature",
    model: modelId,
    generatedText: fullContent,
    promptText: userMessage,  // optional
  });
}
```

## Supported Models

- **Gemini Direct**: `gemini-2.5-flash`, `gemini-2.0-flash` (uses `responseFormat: "json"`)
- **Gateway**: `openai/gpt-4o-mini`, `google/gemini-2.5-flash-lite`, etc.

## Key Rules

1. **Never make unmetered AI calls** - always use the centralized layer
2. **Check credits before agent calls** - agents deduct after, so check first
3. **Deduct after streaming** - streaming can't deduct mid-stream
4. **Use feature names consistently** - for credit tracking analytics
