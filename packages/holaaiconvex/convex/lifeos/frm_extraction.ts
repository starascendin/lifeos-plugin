import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ==================== SYSTEM PROMPT ====================

const PEOPLE_EXTRACTION_PROMPT = `You are an AI assistant that extracts information about people mentioned in voice memo transcripts.

Analyze the transcript and extract:

1. **People Mentioned**: List all people mentioned by name, including:
   - Full names when available
   - Nicknames or informal names ("my friend Dave", "Dr. Smith")
   - Relationships mentioned ("my mom", "my boss") - use generic names if no name given

2. **Labels/Tags**: Categorize what this memo is about:
   - Type: "phone call", "meeting notes", "random thoughts", "coffee chat", "family update", etc.
   - Topics: relevant topics discussed

Return ONLY a raw JSON object with NO markdown formatting:
{
  "people": [
    {
      "name": "string (the person's name)",
      "context": "string (relationship/context: 'mom', 'coworker', 'friend from college', etc.)",
      "confidence": "high | medium | low"
    }
  ],
  "labels": ["string (categorization tags)"],
  "summary": "string (1-2 sentence summary of the memo)"
}

RULES:
- Only extract people who are actually discussed, not just mentioned in passing
- If a name is unclear, use your best guess with low confidence
- If only a relationship is mentioned with no name ("my brother"), use "Unknown [relationship]" as name
- Be conservative - only include people you're reasonably sure about
- labels should be lowercase and concise`;

// ==================== TYPES ====================

interface ExtractedPerson {
  name: string;
  context?: string;
  confidence: "high" | "medium" | "low";
}

interface ExtractionResult {
  people: ExtractedPerson[];
  labels: string[];
  summary: string;
}

// ==================== INTERNAL QUERIES ====================

/**
 * Get voice memo by ID (internal)
 */
export const getVoiceMemoInternal = internalQuery({
  args: {
    memoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memoId);
  },
});

/**
 * Get user's FRM people for matching (internal)
 */
export const getUserPeopleInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ==================== INTERNAL MUTATIONS ====================

/**
 * Create a new person (internal)
 */
export const createPersonInternal = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("lifeos_frmPeople", {
      userId: args.userId,
      name: args.name,
      notes: args.context ? `Context: ${args.context}` : undefined,
      memoCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Link a memo to a person (internal)
 */
export const linkMemoToPersonInternal = internalMutation({
  args: {
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    voiceMemoId: v.id("life_voiceMemos"),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if link already exists
    const existingLink = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .filter((q) => q.eq(q.field("voiceMemoId"), args.voiceMemoId))
      .first();

    if (existingLink) {
      return existingLink._id;
    }

    // Create the link
    const linkId = await ctx.db.insert("lifeos_frmPersonMemos", {
      userId: args.userId,
      personId: args.personId,
      voiceMemoId: args.voiceMemoId,
      context: args.context,
      createdAt: Date.now(),
    });

    // Update person's memo count and last interaction
    const person = await ctx.db.get(args.personId);
    if (person) {
      await ctx.db.patch(args.personId, {
        memoCount: person.memoCount + 1,
        lastInteractionAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return linkId;
  },
});

/**
 * Create timeline entry for linked memo (internal)
 */
export const createTimelineEntryInternal = internalMutation({
  args: {
    userId: v.id("users"),
    personId: v.id("lifeos_frmPeople"),
    voiceMemoId: v.id("life_voiceMemos"),
    personName: v.string(),
    title: v.string(),
    preview: v.optional(v.string()),
    interactionAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if timeline entry already exists for this memo/person
    const existing = await ctx.db
      .query("lifeos_frmTimeline")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .filter((q) => q.eq(q.field("voiceMemoId"), args.voiceMemoId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("lifeos_frmTimeline", {
      userId: args.userId,
      personId: args.personId,
      entryType: "voice_memo",
      voiceMemoId: args.voiceMemoId,
      personName: args.personName,
      title: args.title,
      preview: args.preview,
      interactionAt: args.interactionAt,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create a new extraction history entry (versioned) - internal
 */
export const createExtractionHistoryInternal = internalMutation({
  args: {
    userId: v.id("users"),
    voiceMemoId: v.id("life_voiceMemos"),
    labels: v.array(v.string()),
    summary: v.optional(v.string()),
    extractedPeople: v.array(
      v.object({
        name: v.string(),
        context: v.optional(v.string()),
        confidence: v.string(),
        matched: v.boolean(),
        personId: v.optional(v.id("lifeos_frmPeople")),
      })
    ),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the current latest version number
    const latestEntry = await ctx.db
      .query("lifeos_frmMemoExtractions")
      .withIndex("by_memo_latest", (q) =>
        q.eq("voiceMemoId", args.voiceMemoId).eq("isLatest", true)
      )
      .first();

    const nextVersion = latestEntry ? latestEntry.version + 1 : 1;

    // Mark previous latest as not latest
    if (latestEntry) {
      await ctx.db.patch(latestEntry._id, { isLatest: false });
    }

    // Create new extraction history entry
    const entryId = await ctx.db.insert("lifeos_frmMemoExtractions", {
      userId: args.userId,
      voiceMemoId: args.voiceMemoId,
      version: nextVersion,
      isLatest: true,
      labels: args.labels,
      summary: args.summary,
      extractedPeople: args.extractedPeople,
      extractedAt: now,
      model: args.model,
    });

    // Also update the legacy metadata table for backward compatibility
    const existingMetadata = await ctx.db
      .query("lifeos_frmMemoMetadata")
      .withIndex("by_memo", (q) => q.eq("voiceMemoId", args.voiceMemoId))
      .first();

    if (existingMetadata) {
      await ctx.db.patch(existingMetadata._id, {
        labels: args.labels,
        summary: args.summary,
        extractedAt: now,
        model: args.model,
      });
    } else {
      await ctx.db.insert("lifeos_frmMemoMetadata", {
        userId: args.userId,
        voiceMemoId: args.voiceMemoId,
        labels: args.labels,
        summary: args.summary,
        extractedAt: now,
        model: args.model,
      });
    }

    return { entryId, version: nextVersion };
  },
});

/**
 * Clear existing links for a memo (for regeneration) - internal
 */
export const clearMemoLinksInternal = internalMutation({
  args: {
    voiceMemoId: v.id("life_voiceMemos"),
  },
  handler: async (ctx, args) => {
    // Get all existing links for this memo
    const links = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_memo", (q) => q.eq("voiceMemoId", args.voiceMemoId))
      .collect();

    // Delete links and update person memo counts
    for (const link of links) {
      const person = await ctx.db.get(link.personId);
      if (person && person.memoCount > 0) {
        await ctx.db.patch(link.personId, {
          memoCount: person.memoCount - 1,
          updatedAt: Date.now(),
        });
      }
      await ctx.db.delete(link._id);
    }

    // Delete timeline entries for this memo
    const timelineEntries = await ctx.db
      .query("lifeos_frmTimeline")
      .filter((q) => q.eq(q.field("voiceMemoId"), args.voiceMemoId))
      .collect();

    for (const entry of timelineEntries) {
      await ctx.db.delete(entry._id);
    }

    return { linksRemoved: links.length, timelineEntriesRemoved: timelineEntries.length };
  },
});

// ==================== ACTIONS ====================

/**
 * Extract people from a voice memo and link them
 * @param regenerate - If true, clears existing links before re-extracting
 */
export const extractPeopleFromMemo = action({
  args: {
    voiceMemoId: v.id("life_voiceMemos"),
    regenerate: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    extracted: v.optional(
      v.object({
        people: v.array(
          v.object({
            name: v.string(),
            context: v.optional(v.string()),
            confidence: v.string(),
          })
        ),
        labels: v.array(v.string()),
        summary: v.string(),
      })
    ),
    linkedPeople: v.optional(v.array(v.string())),
    newPeople: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args) => {
    try {
      // Get the voice memo
      const memo = await ctx.runQuery(internal.lifeos.frm_extraction.getVoiceMemoInternal, {
        memoId: args.voiceMemoId,
      });

      if (!memo) {
        return { success: false, error: "Voice memo not found" };
      }

      if (!memo.transcript) {
        return { success: false, error: "Voice memo has no transcript. Please wait for transcription to complete." };
      }

      const userId = memo.userId;

      // If regenerating, clear existing links first
      if (args.regenerate) {
        console.log(`[FRM Extraction] Regenerating - clearing existing links for memo ${args.voiceMemoId}`);
        await ctx.runMutation(internal.lifeos.frm_extraction.clearMemoLinksInternal, {
          voiceMemoId: args.voiceMemoId,
        });
      }

      // Get existing people for matching
      const existingPeople = await ctx.runQuery(
        internal.lifeos.frm_extraction.getUserPeopleInternal,
        { userId }
      );

      // Call AI to extract people
      const model = "google/gemini-2.5-flash";
      console.log(`[FRM Extraction] Processing memo ${args.voiceMemoId}, transcript length: ${memo.transcript.length}`);

      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model,
          messages: [
            { role: "system", content: PEOPLE_EXTRACTION_PROMPT },
            { role: "user", content: memo.transcript },
          ],
          responseFormat: "json",
          temperature: 0.3,
          maxTokens: 4096,
        },
        context: {
          feature: "frm_people_extraction",
          description: `Extract people from voice memo`,
        },
      });

      // Parse AI response
      let extracted: ExtractionResult;
      try {
        let jsonContent = result.content.trim();
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }
        extracted = JSON.parse(jsonContent);
      } catch {
        console.error(`[FRM Extraction] Failed to parse AI response:`, result.content.substring(0, 200));
        return { success: false, error: "Failed to parse AI response" };
      }

      console.log(`[FRM Extraction] Extracted ${extracted.people.length} people:`, extracted.people.map(p => p.name));

      // Match extracted people to existing or create new
      const linkedPeople: string[] = [];
      const newPeople: string[] = [];
      const extractedPeopleForHistory: Array<{
        name: string;
        context?: string;
        confidence: string;
        matched: boolean;
        personId?: Id<"lifeos_frmPeople">;
      }> = [];

      for (const extractedPerson of extracted.people) {
        // Skip low confidence extractions for linking, but still record them
        if (extractedPerson.confidence === "low") {
          extractedPeopleForHistory.push({
            name: extractedPerson.name,
            context: extractedPerson.context,
            confidence: extractedPerson.confidence,
            matched: false,
          });
          continue;
        }

        // Try to match to existing person (case-insensitive)
        const normalizedName = extractedPerson.name.toLowerCase().trim();
        let matchedPerson = existingPeople.find((p) => {
          const pName = p.name.toLowerCase().trim();
          const pNickname = p.nickname?.toLowerCase().trim();
          return (
            pName === normalizedName ||
            pNickname === normalizedName ||
            pName.includes(normalizedName) ||
            normalizedName.includes(pName)
          );
        });

        let personId: Id<"lifeos_frmPeople">;
        let matched = false;

        if (matchedPerson) {
          // Use existing person
          personId = matchedPerson._id;
          matched = true;
          linkedPeople.push(matchedPerson.name);
          console.log(`[FRM Extraction] Matched "${extractedPerson.name}" to existing person "${matchedPerson.name}"`);
        } else {
          // Create new person
          personId = await ctx.runMutation(internal.lifeos.frm_extraction.createPersonInternal, {
            userId,
            name: extractedPerson.name,
            context: extractedPerson.context,
          });
          newPeople.push(extractedPerson.name);
          console.log(`[FRM Extraction] Created new person "${extractedPerson.name}"`);
        }

        // Track for history
        extractedPeopleForHistory.push({
          name: extractedPerson.name,
          context: extractedPerson.context,
          confidence: extractedPerson.confidence,
          matched,
          personId,
        });

        // Link memo to person
        await ctx.runMutation(internal.lifeos.frm_extraction.linkMemoToPersonInternal, {
          userId,
          personId,
          voiceMemoId: args.voiceMemoId,
          context: extracted.labels.join(", "),
        });

        // Create timeline entry
        await ctx.runMutation(internal.lifeos.frm_extraction.createTimelineEntryInternal, {
          userId,
          personId,
          voiceMemoId: args.voiceMemoId,
          personName: matchedPerson?.name || extractedPerson.name,
          title: memo.name || "Voice Memo",
          preview: memo.transcript.substring(0, 200),
          interactionAt: memo.clientCreatedAt || memo.createdAt,
        });
      }

      // Save extraction history (versioned)
      await ctx.runMutation(internal.lifeos.frm_extraction.createExtractionHistoryInternal, {
        userId,
        voiceMemoId: args.voiceMemoId,
        labels: extracted.labels || [],
        summary: extracted.summary,
        extractedPeople: extractedPeopleForHistory,
        model,
      });

      return {
        success: true,
        extracted: {
          people: extracted.people.map((p) => ({
            name: p.name,
            context: p.context,
            confidence: p.confidence,
          })),
          labels: extracted.labels,
          summary: extracted.summary,
        },
        linkedPeople: [...linkedPeople, ...newPeople],
        newPeople,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[FRM Extraction] Error:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});
