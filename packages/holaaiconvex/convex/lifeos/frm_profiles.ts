import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";

// ==================== SYSTEM PROMPT ====================

const PROFILE_EXTRACTION_PROMPT = `You are an expert relationship analyst building a psychological profile of a person based on voice memo transcripts and intel files.

Analyze ALL provided sources (voice memos and uploaded files) and extract comprehensive insights about this person. Think like a CIA analyst building a dossier - look for patterns across multiple interactions.

SOURCES are labeled as:
- MEMO-1, MEMO-2, etc. for voice memos
- FILE-1, FILE-2, etc. for uploaded intel files

From the sources, extract:

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
- Only include insights you can actually infer from the sources
- If there isn't enough information for a field, omit it or return an empty array
- Be specific and actionable, not generic
- Look for patterns across multiple sources
- Consider context mentioned about interactions (phone calls, meetups, etc.)
- CITE YOUR SOURCES for each insight using the source labels (MEMO-1, FILE-2, etc.)

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
  "summary": "string",
  "citations": {
    "communicationStyle": [
      {"insight": "The actual insight text from above", "sources": ["MEMO-1", "FILE-2"], "excerpts": ["relevant quote from source"]}
    ],
    "personality": [
      {"insight": "The actual insight text", "sources": ["MEMO-2"], "excerpts": ["supporting quote"]}
    ],
    "tips": [
      {"insight": "The tip text", "sources": ["MEMO-1", "MEMO-3"], "excerpts": ["supporting evidence"]}
    ],
    "summary": ["MEMO-1", "MEMO-2", "FILE-1"]
  }
}`;

// ==================== TYPES ====================

interface CitationFromAI {
  insight: string;
  sources: string[]; // e.g., ["MEMO-1", "FILE-2"]
  excerpts?: string[];
}

interface CitationsFromAI {
  communicationStyle?: CitationFromAI[];
  personality?: CitationFromAI[];
  tips?: CitationFromAI[];
  summary?: string[]; // Just source labels for summary
}

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
  citations?: CitationsFromAI;
}

// Source mapping for converting AI labels to actual IDs
interface SourceMapping {
  label: string; // e.g., "MEMO-1"
  type: "memo" | "file";
  id: string;
  name: string;
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

// Validator for citation source
const citationSourceValidator = v.object({
  type: v.union(v.literal("memo"), v.literal("file")),
  id: v.string(),
  name: v.string(),
  excerpt: v.optional(v.string()),
});

// Validator for citation entry
const citationEntryValidator = v.object({
  insight: v.string(),
  sources: v.array(citationSourceValidator),
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
    citations: v.optional(
      v.object({
        communicationStyle: v.optional(v.array(citationEntryValidator)),
        personality: v.optional(v.array(citationEntryValidator)),
        tips: v.optional(v.array(citationEntryValidator)),
        summary: v.optional(v.array(citationSourceValidator)),
      })
    ),
    fileIdsAnalyzed: v.optional(v.array(v.id("lifeos_frmFiles"))),
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
    if (args.citations !== undefined) {
      updates.citations = args.citations;
    }
    if (args.fileIdsAnalyzed !== undefined) {
      updates.fileIdsAnalyzed = args.fileIdsAnalyzed;
    }
    if (args.error !== undefined) {
      updates.error = args.error;
    }

    await ctx.db.patch(args.profileId, updates);
  },
});

// ==================== ACTIONS ====================

/**
 * Helper function to transform AI citations to schema format
 */
function transformCitations(
  aiCitations: CitationsFromAI | undefined,
  sourceMapping: SourceMapping[]
): Doc<"lifeos_frmProfiles">["citations"] | undefined {
  if (!aiCitations) return undefined;

  const getSourceFromLabel = (label: string) => {
    const mapping = sourceMapping.find((m) => m.label === label);
    if (!mapping) return null;
    return {
      type: mapping.type as "memo" | "file",
      id: mapping.id,
      name: mapping.name,
    };
  };

  const transformCitationArray = (citations: CitationFromAI[] | undefined) => {
    if (!citations) return undefined;
    return citations
      .map((c) => ({
        insight: c.insight,
        sources: c.sources
          .map((label) => {
            const source = getSourceFromLabel(label);
            if (!source) return null;
            // Find the excerpt for this source if available
            const excerptIndex = c.sources.indexOf(label);
            const excerpt = c.excerpts?.[excerptIndex];
            return {
              ...source,
              excerpt,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null),
      }))
      .filter((c) => c.sources.length > 0);
  };

  const transformSummaryCitations = (sources: string[] | undefined) => {
    if (!sources) return undefined;
    return sources
      .map((label) => {
        const source = getSourceFromLabel(label);
        if (!source) return null;
        return source;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  };

  return {
    communicationStyle: transformCitationArray(aiCitations.communicationStyle),
    personality: transformCitationArray(aiCitations.personality),
    tips: transformCitationArray(aiCitations.tips),
    summary: transformSummaryCitations(aiCitations.summary),
  };
}

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

      // Get all files for this person
      const files = await ctx.runQuery(api.lifeos.frm_files.getFilesForPerson, {
        personId: profileRecord.personId,
      });

      // Filter to only memos with transcripts
      type LinkedMemo = NonNullable<typeof linkedMemos[number]>;
      console.log(`[FRM Profile] Found ${linkedMemos.length} linked memos`);

      const memosWithTranscripts = linkedMemos.filter(
        (memo): memo is LinkedMemo => memo !== null && !!memo.transcript && memo.transcript.trim().length > 0
      );

      console.log(`[FRM Profile] ${memosWithTranscripts.length} memos have transcripts`);
      console.log(`[FRM Profile] Found ${files.length} intel files`);

      // Check if we have any sources at all
      if (memosWithTranscripts.length === 0 && files.length === 0) {
        linkedMemos.forEach((memo, i) => {
          if (memo) {
            console.log(`[FRM Profile] Memo ${i}: transcript=${memo.transcript ? 'yes' : 'no'}, status=${memo.transcriptionStatus || 'unknown'}`);
          }
        });
        throw new Error("No transcribed voice memos or intel files found. Please add some data first.");
      }

      // Build source mapping for citations
      const sourceMapping: SourceMapping[] = [];

      // Build the context for AI - Voice Memos
      const transcriptSections = memosWithTranscripts.map((memo: LinkedMemo, i: number) => {
        const label = `MEMO-${i + 1}`;
        sourceMapping.push({
          label,
          type: "memo",
          id: memo._id,
          name: memo.name,
        });

        const date = new Date(memo.clientCreatedAt || memo.createdAt).toLocaleDateString();
        const context = memo.context ? ` (Context: ${memo.context})` : "";
        return `--- ${label}: "${memo.name}" [${date}]${context} ---\n${memo.transcript}`;
      });

      // Build the context for AI - Intel Files (text-based files only for now)
      const textFileTypes = ["text/plain", "text/markdown", "application/json"];
      const textFiles = files.filter((f) => textFileTypes.some((t) => f.mimeType.startsWith(t)));

      const fileSections: string[] = [];
      for (let i = 0; i < textFiles.length; i++) {
        const file = textFiles[i];
        const label = `FILE-${i + 1}`;
        sourceMapping.push({
          label,
          type: "file",
          id: file._id,
          name: file.name,
        });

        // Try to fetch file content
        if (file.url) {
          try {
            const response = await fetch(file.url);
            if (response.ok) {
              const content = await response.text();
              // Limit content to prevent huge prompts
              const truncatedContent = content.length > 10000
                ? content.substring(0, 10000) + "\n... [truncated]"
                : content;
              fileSections.push(`--- ${label}: "${file.name}" ---\n${truncatedContent}`);
            }
          } catch (e) {
            console.log(`[FRM Profile] Failed to fetch file ${file.name}:`, e);
          }
        }
      }

      // Build the full user prompt
      let userPrompt = `SUBJECT: ${person.name}${person.nickname ? ` (aka "${person.nickname}")` : ""}
${person.relationshipType ? `Relationship: ${person.relationshipType}` : ""}
${person.notes ? `Background Notes: ${person.notes}` : ""}

=== SOURCES ===
`;

      if (memosWithTranscripts.length > 0) {
        userPrompt += `
== VOICE MEMOS (${memosWithTranscripts.length} total) ==

${transcriptSections.join("\n\n")}
`;
      }

      if (fileSections.length > 0) {
        userPrompt += `
== INTEL FILES (${fileSections.length} total) ==

${fileSections.join("\n\n")}
`;
      }

      // Call AI via the metered executeAICall
      const model = "google/gemini-2.5-flash";
      console.log(`[FRM Profile] Calling AI with ${memosWithTranscripts.length} transcripts, ${fileSections.length} files, total chars: ${userPrompt.length}`);

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

      // Debug: Log what AI returned for citations
      console.log(`[FRM Profile] AI returned citations:`, JSON.stringify(parsed.citations, null, 2));
      console.log(`[FRM Profile] Source mapping:`, JSON.stringify(sourceMapping, null, 2));

      // Transform AI citations to schema format
      const transformedCitations = transformCitations(parsed.citations, sourceMapping);
      console.log(`[FRM Profile] Transformed citations:`, JSON.stringify(transformedCitations, null, 2));

      // Get file IDs for tracking
      const fileIdsAnalyzed = textFiles.map((f) => f._id) as Id<"lifeos_frmFiles">[];

      // Update profile with results
      await ctx.runMutation(internal.lifeos.frm_profiles.updateProfileInternal, {
        profileId: args.profileId,
        status: "completed",
        communicationStyle: parsed.communicationStyle,
        personality: parsed.personality,
        tips: parsed.tips,
        summary: parsed.summary,
        citations: transformedCitations,
        fileIdsAnalyzed: fileIdsAnalyzed.length > 0 ? fileIdsAnalyzed : undefined,
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
