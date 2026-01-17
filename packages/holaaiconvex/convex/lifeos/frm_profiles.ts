import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";

// ==================== SYSTEM PROMPT ====================

const PROFILE_EXTRACTION_PROMPT = `You are an expert relationship analyst building a psychological profile of a person based on voice memo transcripts.

Analyze ALL provided transcripts and extract comprehensive insights about this person. Think like a CIA analyst building a dossier - look for patterns across multiple interactions.

From the transcripts, extract:

1. **Communication Style**
   - preferredChannels: How they prefer to communicate (text, call, in-person, email)
   - responsePatterns: How quickly/thoroughly they respond ("Quick responder", "Takes time to think", "Brief and direct")
   - conflictApproach: How they handle disagreements ("Direct confrontation", "Avoidant", "Collaborative problem-solver")
   - expressionStyle: How they express themselves ("Verbose storyteller", "Concise and factual", "Emotionally expressive")

2. **Personality**
   - coreValues: What they care most about (family, achievement, adventure, security, creativity, etc.)
   - motivations: What drives their decisions and actions
   - strengths: Their positive traits and capabilities
   - frictionPoints: Topics or behaviors that cause tension or should be avoided
   - interests: Hobbies, topics they enjoy discussing, passions

3. **Relationship Tips**
   - doList: Specific actions that work well with this person
   - avoidList: Things to avoid doing or saying
   - conversationStarters: Topics they'd enjoy discussing
   - giftIdeas: Based on their interests (if enough info available)

4. **Summary**: A 2-3 sentence executive summary of who this person is and how to interact with them effectively.

IMPORTANT RULES:
- Only include insights you can actually infer from the transcripts
- If there isn't enough information for a field, omit it or return an empty array
- Be specific and actionable, not generic
- Look for patterns across multiple transcripts
- Consider context mentioned about interactions (phone calls, meetups, etc.)

Return ONLY a raw JSON object with NO markdown formatting, NO code blocks, NO backticks:
{
  "communicationStyle": {
    "preferredChannels": ["string"],
    "responsePatterns": "string",
    "conflictApproach": "string",
    "expressionStyle": "string"
  },
  "personality": {
    "coreValues": ["string"],
    "motivations": ["string"],
    "strengths": ["string"],
    "frictionPoints": ["string"],
    "interests": ["string"]
  },
  "tips": {
    "doList": ["string"],
    "avoidList": ["string"],
    "conversationStarters": ["string"],
    "giftIdeas": ["string"]
  },
  "summary": "string"
}`;

// ==================== TYPES ====================

interface ProfileExtractionResult {
  communicationStyle?: {
    preferredChannels?: string[];
    responsePatterns?: string;
    conflictApproach?: string;
    expressionStyle?: string;
  };
  personality?: {
    coreValues?: string[];
    motivations?: string[];
    strengths?: string[];
    frictionPoints?: string[];
    interests?: string[];
  };
  tips?: {
    doList?: string[];
    avoidList?: string[];
    conversationStarters?: string[];
    giftIdeas?: string[];
  };
  summary?: string;
}

// ==================== QUERIES ====================

/**
 * Get the latest profile for a person
 */
export const getLatestProfile = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return null;
    }

    // Get the latest completed profile
    const profile = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .order("desc")
      .first();

    return profile;
  },
});

/**
 * Get profile generation status (for showing loading state)
 */
export const getProfileStatus = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get latest profile of any status
    const profile = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .order("desc")
      .first();

    if (!profile) {
      return { status: "none" as const, profile: null };
    }

    return { status: profile.status, profile };
  },
});

/**
 * Get all profile versions for a person (for history view)
 */
export const getProfileHistory = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      return [];
    }

    // Get all profiles ordered by version descending
    const profiles = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person_version", (q) => q.eq("personId", args.personId))
      .order("desc")
      .collect();

    return profiles;
  },
});

// ==================== MUTATIONS ====================

/**
 * Create a pending profile record (called before running extraction)
 */
export const createPendingProfile = mutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Verify person belongs to user
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== user._id) {
      throw new Error("Person not found or access denied");
    }

    // Get memo count for this person
    const links = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    if (links.length === 0) {
      throw new Error("No voice memos linked to this person. Record some intel first.");
    }

    // Determine confidence based on memo count
    let confidence: "low" | "medium" | "high" = "low";
    if (links.length >= 6) confidence = "high";
    else if (links.length >= 3) confidence = "medium";

    // Get next version number
    const existingProfiles = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person", (q) => q.eq("personId", args.personId))
      .collect();

    const nextVersion = existingProfiles.length + 1;

    // Create pending profile with memo IDs for version tracking
    const memoIds = links.map(l => l.voiceMemoId);
    const profileId = await ctx.db.insert("lifeos_frmProfiles", {
      userId: user._id,
      personId: args.personId,
      version: nextVersion,
      confidence,
      memosAnalyzed: links.length,
      memoIdsAnalyzed: memoIds,
      model: "google/gemini-2.5-flash",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return profileId;
  },
});

/**
 * Internal mutation to update profile with extraction results
 */
export const updateProfileInternal = internalMutation({
  args: {
    profileId: v.id("lifeos_frmProfiles"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    communicationStyle: v.optional(
      v.object({
        preferredChannels: v.optional(v.array(v.string())),
        responsePatterns: v.optional(v.string()),
        conflictApproach: v.optional(v.string()),
        expressionStyle: v.optional(v.string()),
      })
    ),
    personality: v.optional(
      v.object({
        coreValues: v.optional(v.array(v.string())),
        motivations: v.optional(v.array(v.string())),
        strengths: v.optional(v.array(v.string())),
        frictionPoints: v.optional(v.array(v.string())),
        interests: v.optional(v.array(v.string())),
      })
    ),
    tips: v.optional(
      v.object({
        doList: v.optional(v.array(v.string())),
        avoidList: v.optional(v.array(v.string())),
        conversationStarters: v.optional(v.array(v.string())),
        giftIdeas: v.optional(v.array(v.string())),
      })
    ),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Partial<Doc<"lifeos_frmProfiles">> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.communicationStyle !== undefined) {
      updates.communicationStyle = args.communicationStyle;
    }
    if (args.personality !== undefined) {
      updates.personality = args.personality;
    }
    if (args.tips !== undefined) {
      updates.tips = args.tips;
    }
    if (args.summary !== undefined) {
      updates.summary = args.summary;
    }
    if (args.error !== undefined) {
      updates.error = args.error;
    }

    await ctx.db.patch(args.profileId, updates);
  },
});

// ==================== ACTIONS ====================

/**
 * Run AI profile extraction for a person
 */
export const runProfileExtraction = action({
  args: {
    profileId: v.id("lifeos_frmProfiles"),
  },
  handler: async (ctx, args) => {
    // Get the profile record
    const profileRecord = await ctx.runQuery(internal.lifeos.frm_profiles.getProfileById, {
      profileId: args.profileId,
    });

    if (!profileRecord) {
      throw new Error("Profile not found");
    }

    // Mark as processing immediately
    await ctx.runMutation(internal.lifeos.frm_profiles.updateProfileInternal, {
      profileId: args.profileId,
      status: "processing",
    });

    try {
      console.log(`[FRM Profile] Starting extraction for profile ${args.profileId}`);
      // Get person info
      const person = await ctx.runQuery(api.lifeos.frm_people.getPerson, {
        personId: profileRecord.personId,
      });

      if (!person) {
        throw new Error("Person not found");
      }

      // Get all linked memos with transcripts
      const linkedMemos = await ctx.runQuery(api.lifeos.frm_memos.getMemosForPerson, {
        personId: profileRecord.personId,
        limit: 100, // Get all memos
      });

      // Filter to only memos with transcripts
      type LinkedMemo = NonNullable<typeof linkedMemos[number]>;
      console.log(`[FRM Profile] Found ${linkedMemos.length} linked memos`);

      const memosWithTranscripts = linkedMemos.filter(
        (memo): memo is LinkedMemo => memo !== null && !!memo.transcript && memo.transcript.trim().length > 0
      );

      console.log(`[FRM Profile] ${memosWithTranscripts.length} memos have transcripts`);

      if (memosWithTranscripts.length === 0) {
        // Log which memos don't have transcripts for debugging
        linkedMemos.forEach((memo, i) => {
          if (memo) {
            console.log(`[FRM Profile] Memo ${i}: transcript=${memo.transcript ? 'yes' : 'no'}, status=${memo.transcriptionStatus || 'unknown'}`);
          }
        });
        throw new Error("No transcribed voice memos found. Please wait for transcription to complete, then try again.");
      }

      // Build the context for AI
      const transcriptSections = memosWithTranscripts.map((memo: LinkedMemo, i: number) => {
        const date = new Date(memo.clientCreatedAt || memo.createdAt).toLocaleDateString();
        const context = memo.context ? ` (Context: ${memo.context})` : "";
        return `--- Memo ${i + 1} [${date}]${context} ---\n${memo.transcript}`;
      });

      const userPrompt = `SUBJECT: ${person.name}${person.nickname ? ` (aka "${person.nickname}")` : ""}
${person.relationshipType ? `Relationship: ${person.relationshipType}` : ""}
${person.notes ? `Background Notes: ${person.notes}` : ""}

TOTAL VOICE MEMOS: ${memosWithTranscripts.length}

${transcriptSections.join("\n\n")}`;

      // Call AI via the metered executeAICall
      const model = "google/gemini-2.5-flash";
      console.log(`[FRM Profile] Calling AI with ${memosWithTranscripts.length} transcripts, total chars: ${userPrompt.length}`);

      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model,
          messages: [
            { role: "system", content: PROFILE_EXTRACTION_PROMPT },
            { role: "user", content: userPrompt },
          ],
          responseFormat: "json",
          temperature: 0.4,
          maxTokens: 16384,
        },
        context: {
          feature: "frm_profile_extraction",
          description: `Build profile for: ${person.name}`,
        },
      });

      console.log(`[FRM Profile] AI response received, length: ${result.content.length}`);

      // Parse the JSON response
      let parsed: ProfileExtractionResult;
      try {
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

      // Update profile with results
      await ctx.runMutation(internal.lifeos.frm_profiles.updateProfileInternal, {
        profileId: args.profileId,
        status: "completed",
        communicationStyle: parsed.communicationStyle,
        personality: parsed.personality,
        tips: parsed.tips,
        summary: parsed.summary,
      });

      // Create a timeline entry for the profile update
      await ctx.runMutation(internal.lifeos.frm_profiles.createProfileTimelineEntry, {
        personId: profileRecord.personId,
        personName: person.name,
      });

      return { success: true, profile: parsed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.lifeos.frm_profiles.updateProfileInternal, {
        profileId: args.profileId,
        status: "failed",
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Convenience action: Create profile and run extraction in one call
 */
export const generateProfile = action({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args): Promise<{
    profileId: Id<"lifeos_frmProfiles">;
    success: boolean;
    profile?: ProfileExtractionResult;
    error?: string;
  }> => {
    // Create pending profile
    const profileId: Id<"lifeos_frmProfiles"> = await ctx.runMutation(
      api.lifeos.frm_profiles.createPendingProfile,
      { personId: args.personId }
    );

    // Run extraction
    const result: { success: boolean; profile?: ProfileExtractionResult; error?: string } = await ctx.runAction(
      api.lifeos.frm_profiles.runProfileExtraction,
      { profileId }
    );

    return {
      profileId,
      ...result,
    };
  },
});

// ==================== INTERNAL QUERIES ====================

/**
 * Internal query to get profile by ID
 */
export const getProfileById = internalQuery({
  args: {
    profileId: v.id("lifeos_frmProfiles"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

// ==================== INTERNAL MUTATIONS ====================

/**
 * Create a timeline entry when profile is updated
 */
export const createProfileTimelineEntry = internalMutation({
  args: {
    personId: v.id("lifeos_frmPeople"),
    personName: v.string(),
  },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) return;

    await ctx.db.insert("lifeos_frmTimeline", {
      userId: person.userId,
      personId: args.personId,
      entryType: "profile_update",
      personName: args.personName,
      title: "Profile Updated",
      preview: "AI analysis completed with new insights",
      interactionAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});
