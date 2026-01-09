import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { api } from "../_generated/api";
import { requireUser } from "../_lib/auth";
import { Id } from "../_generated/dataModel";

// ==================== MUTATIONS ====================

/**
 * Generate a URL to upload an audio file to Convex storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new synced voice memo
 */
export const createMemo = mutation({
  args: {
    localId: v.string(),
    name: v.string(),
    storageId: v.id("_storage"),
    duration: v.number(),
    clientCreatedAt: v.number(),
    clientUpdatedAt: v.number(),
    autoTranscribe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if memo already exists (idempotent)
    const existing = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_localId", (q) =>
        q.eq("userId", user._id).eq("localId", args.localId)
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    const memoId = await ctx.db.insert("life_voiceMemos", {
      userId: user._id,
      localId: args.localId,
      name: args.name,
      storageId: args.storageId,
      duration: args.duration,
      transcriptionStatus: "pending",
      clientCreatedAt: args.clientCreatedAt,
      clientUpdatedAt: args.clientUpdatedAt,
      createdAt: now,
      updatedAt: now,
    });

    return memoId;
  },
});

/**
 * Update memo metadata (e.g., rename)
 */
export const updateMemo = mutation({
  args: {
    memoId: v.id("life_voiceMemos"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const memo = await ctx.db.get(args.memoId);

    if (!memo || memo.userId !== user._id) {
      throw new Error("Memo not found or access denied");
    }

    await ctx.db.patch(args.memoId, {
      ...(args.name !== undefined && { name: args.name }),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a memo and its audio file from storage
 */
export const deleteMemo = mutation({
  args: {
    memoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const memo = await ctx.db.get(args.memoId);

    if (!memo || memo.userId !== user._id) {
      throw new Error("Memo not found or access denied");
    }

    // Delete storage file if it exists
    if (memo.storageId) {
      await ctx.storage.delete(memo.storageId);
    }

    // Delete memo record
    await ctx.db.delete(args.memoId);
  },
});

/**
 * Internal mutation to update transcription status and results
 */
export const updateTranscription = mutation({
  args: {
    memoId: v.id("life_voiceMemos"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    transcript: v.optional(v.string()),
    segments: v.optional(
      v.array(
        v.object({
          start: v.number(),
          duration: v.number(),
          text: v.string(),
        })
      )
    ),
    language: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoId, {
      transcriptionStatus: args.status,
      transcript: args.transcript,
      segments: args.segments,
      language: args.language,
      transcriptionError: args.error,
      updatedAt: Date.now(),
    });
  },
});

// ==================== QUERIES ====================

/**
 * Get all memos for the authenticated user
 */
export const getMemos = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    // Generate URLs for audio files (if they exist)
    return Promise.all(
      memos.map(async (memo) => ({
        ...memo,
        audioUrl: memo.storageId ? await ctx.storage.getUrl(memo.storageId) : null,
      }))
    );
  },
});

/**
 * Get a single memo by ID
 */
export const getMemo = query({
  args: {
    memoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const memo = await ctx.db.get(args.memoId);

    if (!memo || memo.userId !== user._id) {
      return null;
    }

    return {
      ...memo,
      audioUrl: memo.storageId ? await ctx.storage.getUrl(memo.storageId) : null,
    };
  },
});

/**
 * Get memos for a specific date (used by Daily View)
 */
export const getMemosForDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Parse date to timestamps (start of day and end of day)
    const startTimestamp = new Date(args.date).setHours(0, 0, 0, 0);
    const endTimestamp = new Date(args.date).setHours(23, 59, 59, 999);

    // Fetch all memos ordered by creation date
    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Filter to the specific date
    const filteredMemos = memos.filter((memo) => {
      return (
        memo.clientCreatedAt >= startTimestamp &&
        memo.clientCreatedAt <= endTimestamp
      );
    });

    // Generate URLs for audio files
    return Promise.all(
      filteredMemos.map(async (memo) => ({
        ...memo,
        audioUrl: memo.storageId
          ? await ctx.storage.getUrl(memo.storageId)
          : null,
      }))
    );
  },
});

/**
 * Get memos for a date range (used by Week View)
 */
export const getMemosForDateRange = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Parse dates to timestamps (start of day and end of day)
    const startTimestamp = new Date(args.startDate).setHours(0, 0, 0, 0);
    const endTimestamp = new Date(args.endDate).setHours(23, 59, 59, 999);

    // Fetch all memos ordered by creation date
    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Filter to date range
    const filteredMemos = memos.filter((memo) => {
      return (
        memo.clientCreatedAt >= startTimestamp &&
        memo.clientCreatedAt <= endTimestamp
      );
    });

    // Generate URLs for audio files
    return Promise.all(
      filteredMemos.map(async (memo) => ({
        ...memo,
        audioUrl: memo.storageId
          ? await ctx.storage.getUrl(memo.storageId)
          : null,
      }))
    );
  },
});

/**
 * Find a synced memo by its local ID
 */
export const getMemoByLocalId = query({
  args: {
    localId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const memo = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_localId", (q) =>
        q.eq("userId", user._id).eq("localId", args.localId)
      )
      .unique();

    if (!memo) {
      return null;
    }

    return {
      ...memo,
      audioUrl: memo.storageId ? await ctx.storage.getUrl(memo.storageId) : null,
    };
  },
});

/**
 * Get all localIds that have been synced (for deduplication check)
 */
export const getSyncedLocalIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return memos.map((m) => m.localId);
  },
});

/**
 * Get synced memos with their Convex IDs and extraction status
 * Used by VoiceMemosTab to show extraction button/status
 */
export const getSyncedMemosWithStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get all synced memos
    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get extraction status for all memos
    const extractions = await ctx.db
      .query("life_voiceMemoExtractions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .collect();

    // Build set of memoIds that have completed extractions
    const extractedMemoIds = new Set(extractions.map((e) => e.voiceMemoId.toString()));

    // Return mapping with status
    return memos.map((m) => ({
      localId: m.localId,
      convexId: m._id,
      name: m.name,
      hasExtraction: extractedMemoIds.has(m._id.toString()),
      hasTranscript: !!m.transcript,
    }));
  },
});

/**
 * Batch upsert transcribed voice memos (transcript only, no audio)
 * Creates or updates memos based on localId (deduplication)
 */
export const upsertTranscriptBatch = mutation({
  args: {
    memos: v.array(
      v.object({
        localId: v.string(),
        name: v.string(),
        duration: v.number(),
        transcript: v.string(),
        language: v.optional(v.string()),
        clientCreatedAt: v.number(),
        clientUpdatedAt: v.number(),
        transcribedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const memo of args.memos) {
      // Check if memo already exists (deduplication by localId)
      const existing = await ctx.db
        .query("life_voiceMemos")
        .withIndex("by_user_localId", (q) =>
          q.eq("userId", user._id).eq("localId", memo.localId)
        )
        .unique();

      if (existing) {
        // Update if transcript changed or is newer
        if (memo.clientUpdatedAt > existing.clientUpdatedAt) {
          await ctx.db.patch(existing._id, {
            name: memo.name,
            transcript: memo.transcript,
            language: memo.language,
            transcriptionStatus: "completed",
            clientUpdatedAt: memo.clientUpdatedAt,
            updatedAt: now,
          });
          updatedCount++;
        }
      } else {
        // Insert new memo (transcript-only, no storageId)
        await ctx.db.insert("life_voiceMemos", {
          userId: user._id,
          localId: memo.localId,
          name: memo.name,
          duration: memo.duration,
          transcriptionStatus: "completed",
          transcript: memo.transcript,
          language: memo.language,
          clientCreatedAt: memo.clientCreatedAt,
          clientUpdatedAt: memo.clientUpdatedAt,
          createdAt: now,
          updatedAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount };
  },
});

// ==================== ACTIONS ====================

/**
 * Transcribe a voice memo using Groq's Whisper API
 */
export const transcribeMemo = action({
  args: {
    memoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; transcript?: string; error?: string }> => {
    // Get memo details
    const memo = await ctx.runQuery(api.lifeos.voicememo.getMemo, {
      memoId: args.memoId,
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    if (!memo.audioUrl) {
      throw new Error("Audio URL not available");
    }

    // Mark as processing
    await ctx.runMutation(api.lifeos.voicememo.updateTranscription, {
      memoId: args.memoId,
      status: "processing",
    });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(api.lifeos.voicememo.updateTranscription, {
        memoId: args.memoId,
        status: "failed",
        error: "GROQ_API_KEY not configured",
      });
      return { success: false, error: "GROQ_API_KEY not configured" };
    }

    try {
      // Download the audio file
      const audioResponse = await fetch(memo.audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio file: ${audioResponse.status}`);
      }
      const audioBlob = await audioResponse.blob();

      // Create form data for Groq API
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.m4a");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "segment");

      // Call Groq Whisper API
      const response = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Parse segments from verbose_json response
      const segments = result.segments?.map((seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        duration: seg.end - seg.start,
        text: seg.text.trim(),
      })) ?? [];

      // Update with transcription
      await ctx.runMutation(api.lifeos.voicememo.updateTranscription, {
        memoId: args.memoId,
        status: "completed",
        transcript: result.text,
        segments,
        language: result.language,
      });

      return { success: true, transcript: result.text };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(api.lifeos.voicememo.updateTranscription, {
        memoId: args.memoId,
        status: "failed",
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});
