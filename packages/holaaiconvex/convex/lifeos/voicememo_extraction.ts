import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireUser, getAuthUserId } from "../_lib/auth";
import { Id, Doc } from "../_generated/dataModel";

// ==================== CONSTANTS ====================

export const DEFAULT_EXTRACTION_SYSTEM_PROMPT = `You are an AI assistant that analyzes voice memo transcripts and extracts structured insights.

Analyze the provided transcript and extract:
1. A brief summary (1-2 sentences capturing the main point)
2. Relevant labels/tags (3-7 keywords that categorize the content)
3. Action items (any tasks, to-dos, or follow-ups mentioned). Make sure to capture ALL action items from the transcript.
4. Key points (main ideas or important information)
5. Overall sentiment (positive, neutral, or negative tone)

IMPORTANT: Return ONLY a raw JSON object with NO markdown formatting, NO code blocks, NO backticks, NO explanation. Just the JSON:
{"summary":"string","labels":["string"],"actionItems":["string"],"keyPoints":["string"],"sentiment":"positive"|"neutral"|"negative"}`;

// ==================== TYPES ====================

const extractionOutputSchema = v.object({
  summary: v.string(),
  labels: v.array(v.string()),
  actionItems: v.array(v.string()),
  keyPoints: v.array(v.string()),
  sentiment: v.union(
    v.literal("positive"),
    v.literal("neutral"),
    v.literal("negative")
  ),
});

// ==================== QUERIES ====================

/**
 * Get extraction history for a voice memo (all versions)
 */
export const getExtractionHistory = query({
  args: {
    voiceMemoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const extractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user_voiceMemo", (q) =>
        q.eq("userId", user._id).eq("voiceMemoId", args.voiceMemoId)
      )
      .order("desc")
      .collect();

    return extractions;
  },
});

/**
 * Get the latest extraction for a voice memo
 */
export const getLatestExtraction = query({
  args: {
    voiceMemoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const extraction = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user_voiceMemo", (q) =>
        q.eq("userId", user._id).eq("voiceMemoId", args.voiceMemoId)
      )
      .order("desc")
      .first();

    return extraction;
  },
});

/**
 * Get a single extraction by ID
 */
export const getExtraction = query({
  args: {
    extractionId: v.id("life_voiceMemoExtractions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const extraction = await ctx.db.get(args.extractionId);

    if (!extraction || extraction.userId !== user._id) {
      return null;
    }

    return extraction;
  },
});

/**
 * Get all enhanced memos (memos with completed extractions)
 * Optionally filter by labels
 */
export const getEnhancedMemos = query({
  args: {
    labels: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    // Get all completed extractions for user
    const extractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .order("desc")
      .collect();

    // Group by voiceMemoId and keep only the latest extraction for each
    const latestByMemo = new Map<Id<"life_voiceMemos">, Doc<"life_voiceMemoExtractions">>();
    for (const ext of extractions) {
      if (!latestByMemo.has(ext.voiceMemoId)) {
        latestByMemo.set(ext.voiceMemoId, ext);
      }
    }

    let results = Array.from(latestByMemo.values());

    // Filter by labels if provided
    if (args.labels && args.labels.length > 0) {
      const filterLabels = new Set(args.labels.map((l) => l.toLowerCase()));
      results = results.filter((ext) =>
        ext.labels.some((label) => filterLabels.has(label.toLowerCase()))
      );
    }

    // Limit results
    results = results.slice(0, limit);

    // Get the corresponding voice memos
    const enhancedMemos = await Promise.all(
      results.map(async (extraction) => {
        const memo = await ctx.db.get(extraction.voiceMemoId);
        if (!memo) return null;

        return {
          memo: {
            ...memo,
            audioUrl: memo.storageId ? await ctx.storage.getUrl(memo.storageId) : null,
          },
          extraction,
        };
      })
    );

    return enhancedMemos.filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

/**
 * Get all unique labels with counts for the sidebar
 */
export const getAllLabels = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get all completed extractions
    const extractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .collect();

    // Group by voiceMemoId and keep only the latest extraction for each
    const latestByMemo = new Map<Id<"life_voiceMemos">, Doc<"life_voiceMemoExtractions">>();
    for (const ext of extractions) {
      if (!latestByMemo.has(ext.voiceMemoId)) {
        latestByMemo.set(ext.voiceMemoId, ext);
      }
    }

    // Aggregate label counts from latest extractions only
    const labelCounts = new Map<string, number>();
    for (const ext of latestByMemo.values()) {
      for (const label of ext.labels) {
        const normalizedLabel = label.toLowerCase();
        labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1);
      }
    }

    // Convert to array and sort by count
    return Array.from(labelCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  },
});

/**
 * Check if a memo has any extraction (for showing badge)
 */
export const getMemoExtractionStatus = query({
  args: {
    voiceMemoIds: v.array(v.id("life_voiceMemos")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const result: Record<string, { hasExtraction: boolean; latestStatus: string | null }> = {};

    for (const memoId of args.voiceMemoIds) {
      const extraction = await ctx.db
        .query("life_voiceMemoExtractions")
        .withIndex("by_user_voiceMemo", (q) =>
          q.eq("userId", user._id).eq("voiceMemoId", memoId)
        )
        .order("desc")
        .first();

      result[memoId] = {
        hasExtraction: !!extraction,
        latestStatus: extraction?.status ?? null,
      };
    }

    return result;
  },
});

// ==================== SETTINGS ====================

/**
 * Get user's voice memo extraction settings
 * Returns the custom system prompt if set, otherwise returns the default
 * Returns null if user is not authenticated (to avoid throwing during initial load)
 */
export const getExtractionSettings = query({
  args: {},
  handler: async (ctx) => {
    // Use getAuthUserId to avoid throwing when not authenticated
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Return default settings for unauthenticated users
      return {
        extractionSystemPrompt: DEFAULT_EXTRACTION_SYSTEM_PROMPT,
        isCustom: false,
        defaultPrompt: DEFAULT_EXTRACTION_SYSTEM_PROMPT,
      };
    }

    const settings = await ctx.db
      .query("life_voiceMemoSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      extractionSystemPrompt: settings?.extractionSystemPrompt ?? DEFAULT_EXTRACTION_SYSTEM_PROMPT,
      isCustom: !!settings?.extractionSystemPrompt,
      defaultPrompt: DEFAULT_EXTRACTION_SYSTEM_PROMPT,
    };
  },
});

/**
 * Update user's voice memo extraction settings
 */
export const updateExtractionSettings = mutation({
  args: {
    extractionSystemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existingSettings = await ctx.db
      .query("life_voiceMemoSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        extractionSystemPrompt: args.extractionSystemPrompt,
        updatedAt: now,
      });
      return existingSettings._id;
    } else {
      return await ctx.db.insert("life_voiceMemoSettings", {
        userId: user._id,
        extractionSystemPrompt: args.extractionSystemPrompt,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Reset user's extraction settings to default
 */
export const resetExtractionSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const settings = await ctx.db
      .query("life_voiceMemoSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, {
        extractionSystemPrompt: undefined,
        updatedAt: Date.now(),
      });
    }
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a new extraction record (pending status)
 */
export const createExtraction = mutation({
  args: {
    voiceMemoId: v.id("life_voiceMemos"),
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify user owns the memo
    const memo = await ctx.db.get(args.voiceMemoId);
    if (!memo || memo.userId !== user._id) {
      throw new Error("Voice memo not found or access denied");
    }

    // Check that memo has a transcript
    if (!memo.transcript) {
      throw new Error("Voice memo has no transcript. Please transcribe it first.");
    }

    // Get the next version number
    const existingExtractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user_voiceMemo", (q) =>
        q.eq("userId", user._id).eq("voiceMemoId", args.voiceMemoId)
      )
      .collect();

    const nextVersion = existingExtractions.length + 1;
    const now = Date.now();

    const extractionId = await ctx.db.insert("life_voiceMemoExtractions", {
      userId: user._id,
      voiceMemoId: args.voiceMemoId,
      version: nextVersion,
      customPrompt: args.customPrompt,
      model: "openai/gpt-4o-mini", // Will be set by action
      summary: "",
      labels: [],
      actionItems: [],
      keyPoints: [],
      sentiment: "neutral",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return extractionId;
  },
});

/**
 * Internal mutation to update extraction with AI results
 */
export const updateExtractionInternal = internalMutation({
  args: {
    extractionId: v.id("life_voiceMemoExtractions"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    model: v.optional(v.string()),
    summary: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    actionItems: v.optional(v.array(v.string())),
    keyPoints: v.optional(v.array(v.string())),
    sentiment: v.optional(
      v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative"))
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Partial<Doc<"life_voiceMemoExtractions">> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.model !== undefined) updates.model = args.model;
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.labels !== undefined) updates.labels = args.labels;
    if (args.actionItems !== undefined) updates.actionItems = args.actionItems;
    if (args.keyPoints !== undefined) updates.keyPoints = args.keyPoints;
    if (args.sentiment !== undefined) updates.sentiment = args.sentiment;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.extractionId, updates);
  },
});

/**
 * Delete an extraction
 */
export const deleteExtraction = mutation({
  args: {
    extractionId: v.id("life_voiceMemoExtractions"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const extraction = await ctx.db.get(args.extractionId);

    if (!extraction || extraction.userId !== user._id) {
      throw new Error("Extraction not found or access denied");
    }

    await ctx.db.delete(args.extractionId);
  },
});

// ==================== ACTIONS ====================

/**
 * Run AI extraction on a voice memo
 */
export const runExtraction = action({
  args: {
    extractionId: v.id("life_voiceMemoExtractions"),
  },
  handler: async (ctx, args) => {
    // Get the extraction record
    const extraction = await ctx.runQuery(
      api.lifeos.voicememo_extraction.getExtraction,
      { extractionId: args.extractionId }
    );

    if (!extraction) {
      throw new Error("Extraction not found");
    }

    // Get the voice memo
    const memo = await ctx.runQuery(api.lifeos.voicememo.getMemo, {
      memoId: extraction.voiceMemoId,
    });

    if (!memo) {
      throw new Error("Voice memo not found");
    }

    if (!memo.transcript) {
      throw new Error("Voice memo has no transcript");
    }

    // Mark as processing
    await ctx.runMutation(internal.lifeos.voicememo_extraction.updateExtractionInternal, {
      extractionId: args.extractionId,
      status: "processing",
    });

    try {
      // Get user's custom system prompt (or default)
      const settings = await ctx.runQuery(
        api.lifeos.voicememo_extraction.getExtractionSettings,
        {}
      );
      const systemPrompt = settings.extractionSystemPrompt;

      let userPrompt = `TRANSCRIPT:\n${memo.transcript}`;

      if (extraction.customPrompt) {
        userPrompt += `\n\nADDITIONAL INSTRUCTIONS:\n${extraction.customPrompt}`;
      }

      // Use Gemini via Vercel AI Gateway
      const model = "google/gemini-2.5-flash";

      // Call AI via the metered executeAICall
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          responseFormat: "json",
          temperature: 0.3,
          maxTokens: 16384, // Generous limit to avoid truncation
        },
        context: {
          feature: "voice_memo_extraction",
          description: `Extract insights from: ${memo.name}`,
        },
      });

      // Parse the JSON response
      let parsed: {
        summary: string;
        labels: string[];
        actionItems: string[];
        keyPoints: string[];
        sentiment: "positive" | "neutral" | "negative";
      };

      try {
        // Try to extract JSON from markdown code blocks if present
        let jsonContent = result.content.trim();

        // Remove markdown code blocks if present
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }

        parsed = JSON.parse(jsonContent);
      } catch {
        throw new Error(`Failed to parse AI response as JSON: ${result.content.substring(0, 200)}`);
      }

      // Validate sentiment value
      if (!["positive", "neutral", "negative"].includes(parsed.sentiment)) {
        parsed.sentiment = "neutral";
      }

      // Update extraction with results
      await ctx.runMutation(internal.lifeos.voicememo_extraction.updateExtractionInternal, {
        extractionId: args.extractionId,
        status: "completed",
        model,
        summary: parsed.summary || "",
        labels: parsed.labels || [],
        actionItems: parsed.actionItems || [],
        keyPoints: parsed.keyPoints || [],
        sentiment: parsed.sentiment,
      });

      return { success: true, extraction: parsed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.lifeos.voicememo_extraction.updateExtractionInternal, {
        extractionId: args.extractionId,
        status: "failed",
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Convenience action to create and run extraction in one call
 */
export const extractVoiceMemo = action({
  args: {
    voiceMemoId: v.id("life_voiceMemos"),
    customPrompt: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    extractionId: Id<"life_voiceMemoExtractions">;
    success: boolean;
    extraction?: {
      summary: string;
      labels: string[];
      actionItems: string[];
      keyPoints: string[];
      sentiment: "positive" | "neutral" | "negative";
    };
    error?: string;
  }> => {
    // Create extraction record
    const extractionId: Id<"life_voiceMemoExtractions"> = await ctx.runMutation(
      api.lifeos.voicememo_extraction.createExtraction,
      {
        voiceMemoId: args.voiceMemoId,
        customPrompt: args.customPrompt,
      }
    );

    // Run extraction
    const result: { success: boolean; extraction?: object; error?: string } =
      await ctx.runAction(api.lifeos.voicememo_extraction.runExtraction, {
        extractionId,
      });

    return {
      extractionId,
      success: result.success,
      extraction: result.extraction as
        | {
            summary: string;
            labels: string[];
            actionItems: string[];
            keyPoints: string[];
            sentiment: "positive" | "neutral" | "negative";
          }
        | undefined,
      error: result.error,
    };
  },
});
