import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { beeperThreadTypeValidator } from "./beeper_schema";

const AUTO_CONTACT_LINKING_PROMPT = `You are a CRM linking assistant.

Goal:
Match business chat contacts (from Beeper) to meeting notes (Granola/Fathom) automatically.

You will receive:
1) business contacts (thread names + optional notes)
2) meetings from granola/fathom (title + optional summary snippets)

Primary signal:
- Name matching between contact/chat names and people/company names in meeting title/summary.

Secondary signal:
- business note keywords, project/client context.

Return ONLY raw JSON (no markdown):
{
  "analysis": "short summary",
  "links": [
    {
      "threadConvexId": "string",
      "meetingSource": "granola" | "fathom",
      "meetingId": "string",
      "confidence": 0.0-1.0,
      "reason": "short reason"
    }
  ]
}

Rules:
- only include links with confidence >= 0.55
- prefer precision over recall
- max 5 links per contact
- do not fabricate IDs
`;

interface AutoLinkSuggestion {
  threadConvexId: string;
  meetingSource: "granola" | "fathom";
  meetingId: string;
  confidence: number;
  reason: string;
}

interface AutoLinkAIResult {
  analysis?: string;
  links?: AutoLinkSuggestion[];
}

type AutoLinkActionResult = {
  success: boolean;
  error?: string;
  analysis?: string;
  evaluatedThreads: number;
  evaluatedMeetings: number;
  aiSuggestedLinks: number;
  appliedLinks: number;
  granolaThreadLinksCreated: number;
  granolaPersonLinksCreated: number;
  unifiedMeetingLinksCreated: number;
  autoCreatedPeople: number;
};

type AutoLinkData = {
  businessThreads: Doc<"lifeos_beeperThreads">[];
  granolaMeetings: Doc<"life_granolaMeetings">[];
  fathomMeetings: Doc<"life_fathomMeetings">[];
};

// ==================== QUERIES ====================

/**
 * Get all business-marked threads for the authenticated user
 */
export const getBusinessThreads = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", user._id).eq("isBusinessChat", true)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get unified business contacts based on Beeper business threads.
 * Includes linked FRM person/client and associated AI-note meetings (Granola + Fathom).
 */
export const getBusinessContacts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", user._id).eq("isBusinessChat", true)
      )
      .order("desc")
      .collect();

    return await Promise.all(
      threads.map(async (thread) => {
        let linkedPerson: Doc<"lifeos_frmPeople"> | null = null;
        if (thread.linkedPersonId) {
          const person = await ctx.db.get(thread.linkedPersonId);
          if (person && person.userId === user._id) {
            linkedPerson = person;
          }
        }

        let linkedClient: Doc<"lifeos_pmClients"> | null = null;
        if (thread.linkedClientId) {
          const client = await ctx.db.get(thread.linkedClientId);
          if (client && client.userId === user._id) {
            linkedClient = client;
          }
        }

        type SourceKind = "granola" | "fathom";
        type Association = "thread" | "person";
        type UnifiedMeeting = {
          meetingId: string;
          source: SourceKind;
          title: string;
          meetingDate?: string;
          hasTranscript?: boolean;
          associatedVia: Association[];
          linkSource?: string;
          aiConfidence?: number;
          aiReason?: string;
          url?: string;
        };

        const unifiedMeetingMap = new Map<string, UnifiedMeeting>();
        const granolaCache = new Map<string, Doc<"life_granolaMeetings"> | null>();
        const fathomCache = new Map<string, Doc<"life_fathomMeetings"> | null>();

        const mergeMeeting = (
          key: string,
          meeting: UnifiedMeeting,
          association: Association
        ) => {
          const existing = unifiedMeetingMap.get(key);
          if (existing) {
            if (!existing.associatedVia.includes(association)) {
              existing.associatedVia.push(association);
            }
            if (!existing.linkSource && meeting.linkSource) {
              existing.linkSource = meeting.linkSource;
            }
            if (existing.aiConfidence === undefined && meeting.aiConfidence !== undefined) {
              existing.aiConfidence = meeting.aiConfidence;
            }
            if (!existing.aiReason && meeting.aiReason) {
              existing.aiReason = meeting.aiReason;
            }
            if (!existing.url && meeting.url) {
              existing.url = meeting.url;
            }
            return;
          }
          unifiedMeetingMap.set(key, {
            ...meeting,
            associatedVia: [association],
          });
        };

        const getGranolaMeeting = async (meetingId: Id<"life_granolaMeetings">) => {
          const cacheKey = meetingId as string;
          if (granolaCache.has(cacheKey)) {
            return granolaCache.get(cacheKey) ?? null;
          }
          const meeting = await ctx.db.get(meetingId);
          if (!meeting || meeting.userId !== user._id) {
            granolaCache.set(cacheKey, null);
            return null;
          }
          granolaCache.set(cacheKey, meeting);
          return meeting;
        };

        const getFathomMeeting = async (meetingId: Id<"life_fathomMeetings">) => {
          const cacheKey = meetingId as string;
          if (fathomCache.has(cacheKey)) {
            return fathomCache.get(cacheKey) ?? null;
          }
          const meeting = await ctx.db.get(meetingId);
          if (!meeting || meeting.userId !== user._id) {
            fathomCache.set(cacheKey, null);
            return null;
          }
          fathomCache.set(cacheKey, meeting);
          return meeting;
        };

        // Direct thread -> Granola meeting links
        const threadGranolaLinks = await ctx.db
          .query("life_granolaMeetingLinks")
          .withIndex("by_beeperThread", (q) => q.eq("beeperThreadId", thread._id))
          .collect();

        for (const link of threadGranolaLinks) {
          const meeting = await getGranolaMeeting(link.meetingId);
          if (!meeting) continue;
          mergeMeeting(
            `granola:${meeting._id as string}`,
            {
              meetingId: meeting._id as string,
              source: "granola",
              title: meeting.title,
              meetingDate: meeting.granolaCreatedAt,
              hasTranscript: meeting.hasTranscript,
              associatedVia: [],
              linkSource: link.linkSource,
              aiConfidence: link.aiConfidence,
              aiReason: link.aiReason,
            },
            "thread"
          );
        }

        if (linkedPerson) {
          // Legacy person -> Granola links
          const personGranolaLinks = await ctx.db
            .query("life_granolaMeetingPersonLinks")
            .withIndex("by_person", (q) => q.eq("personId", linkedPerson!._id))
            .collect();

          for (const link of personGranolaLinks) {
            const meeting = await getGranolaMeeting(link.meetingId);
            if (!meeting) continue;
            mergeMeeting(
              `granola:${meeting._id as string}`,
              {
                meetingId: meeting._id as string,
                source: "granola",
                title: meeting.title,
                meetingDate: meeting.granolaCreatedAt,
                hasTranscript: meeting.hasTranscript,
                associatedVia: [],
                linkSource: link.linkSource,
                aiConfidence: link.aiConfidence,
                aiReason: link.aiReason,
              },
              "person"
            );
          }

          // Unified person -> meeting links (Granola + Fathom)
          const unifiedLinks = await ctx.db
            .query("lifeos_meetingPersonLinks")
            .withIndex("by_person", (q) => q.eq("personId", linkedPerson!._id))
            .collect();

          for (const link of unifiedLinks) {
            if (link.meetingSource === "granola") {
              const meeting = await getGranolaMeeting(
                link.meetingId as Id<"life_granolaMeetings">
              );
              if (!meeting) continue;
              mergeMeeting(
                `granola:${meeting._id as string}`,
                {
                  meetingId: meeting._id as string,
                  source: "granola",
                  title: meeting.title,
                  meetingDate: meeting.granolaCreatedAt,
                  hasTranscript: meeting.hasTranscript,
                  associatedVia: [],
                  linkSource: link.linkSource,
                  aiConfidence: link.confidence,
                  aiReason: link.reason,
                },
                "person"
              );
            }

            if (link.meetingSource === "fathom") {
              const meeting = await getFathomMeeting(
                link.meetingId as Id<"life_fathomMeetings">
              );
              if (!meeting) continue;
              mergeMeeting(
                `fathom:${meeting._id as string}`,
                {
                  meetingId: meeting._id as string,
                  source: "fathom",
                  title: meeting.title,
                  meetingDate: meeting.fathomCreatedAt,
                  hasTranscript: meeting.hasTranscript,
                  associatedVia: [],
                  linkSource: link.linkSource,
                  aiConfidence: link.confidence,
                  aiReason: link.reason,
                  url: meeting.fathomUrl,
                },
                "person"
              );
            }
          }
        }

        const linkedMeetings = Array.from(unifiedMeetingMap.values()).sort((a, b) => {
          const aTime = a.meetingDate ? Date.parse(a.meetingDate) || 0 : 0;
          const bTime = b.meetingDate ? Date.parse(b.meetingDate) || 0 : 0;
          return bTime - aTime;
        });

        return {
          ...thread,
          linkedPerson: linkedPerson
            ? {
                _id: linkedPerson._id,
                name: linkedPerson.name,
                avatarEmoji: linkedPerson.avatarEmoji,
                relationshipType: linkedPerson.relationshipType,
                autoCreatedFrom: linkedPerson.autoCreatedFrom,
              }
            : null,
          linkedClient: linkedClient
            ? {
                _id: linkedClient._id,
                name: linkedClient.name,
                status: linkedClient.status,
              }
            : null,
          linkedMeetings,
          granolaMeetingCount: linkedMeetings.filter((m) => m.source === "granola").length,
          fathomMeetingCount: linkedMeetings.filter((m) => m.source === "fathom").length,
          linkedAIMeetingCount: linkedMeetings.length,
        };
      })
    );
  },
});

/**
 * Get all synced threads (both business and non-business)
 */
export const getAllThreads = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single thread by ID
 */
export const getThread = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();
  },
});

/**
 * Get all synced thread IDs (for deduplication check)
 */
export const getSyncedThreadIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return threads.map((t) => t.threadId);
  },
});

/**
 * Get messages for a specific thread
 */
export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .order("desc")
      .take(limit);
  },
});

/**
 * Get synced message IDs for a thread (for deduplication check)
 */
export const getSyncedMessageIds = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const messages = await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .collect();

    return messages.map((m) => m.messageId);
  },
});

/**
 * Search messages across all synced threads
 */
export const searchMessages = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    const results = await ctx.db
      .query("lifeos_beeperMessages")
      .withSearchIndex("search_text", (q) =>
        q.search("text", args.query).eq("userId", user._id)
      )
      .take(limit);

    return results;
  },
});

/**
 * Get threads linked to a specific person
 */
export const getThreadsForPerson = query({
  args: {
    personId: v.id("lifeos_frmPeople"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedPerson", (q) => q.eq("linkedPersonId", args.personId))
      .collect();

    // Filter by user (since linkedPerson index doesn't include userId)
    return threads.filter((t) => t.userId === user._id);
  },
});

/**
 * Get threads linked to a specific client
 */
export const getThreadsForClient = query({
  args: {
    clientId: v.id("lifeos_pmClients"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedClient", (q) => q.eq("linkedClientId", args.clientId))
      .collect();

    // Filter by user (since linkedClient index doesn't include userId)
    return threads.filter((t) => t.userId === user._id);
  },
});

// ==================== INTERNAL AUTO-LINK HELPERS ====================

export const getAutoLinkDataInternal = internalQuery({
  args: {
    userId: v.id("users"),
    maxGranolaMeetings: v.number(),
    maxFathomMeetings: v.number(),
  },
  handler: async (ctx, args) => {
    const businessThreads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", args.userId).eq("isBusinessChat", true)
      )
      .order("desc")
      .collect();

    const granolaMeetings = await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.maxGranolaMeetings);

    const fathomMeetings = await ctx.db
      .query("life_fathomMeetings")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.maxFathomMeetings);

    return {
      businessThreads,
      granolaMeetings,
      fathomMeetings,
    };
  },
});

export const ensurePersonForThreadInternal = internalMutation({
  args: {
    userId: v.id("users"),
    threadConvexId: v.id("lifeos_beeperThreads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadConvexId);
    if (!thread || thread.userId !== args.userId) {
      throw new Error("Thread not found or access denied");
    }

    if (thread.linkedPersonId) {
      return {
        personId: thread.linkedPersonId,
        created: false,
      };
    }

    const normalizedThreadName = thread.threadName.trim().toLowerCase();
    const existingPeople = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const existing = existingPeople.find(
      (p) =>
        !p.archivedAt &&
        p.name.trim().toLowerCase() === normalizedThreadName
    );

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(thread._id, {
        linkedPersonId: existing._id,
        updatedAt: now,
      });
      return {
        personId: existing._id,
        created: false,
      };
    }

    const personId = await ctx.db.insert("lifeos_frmPeople", {
      userId: args.userId,
      name: thread.threadName,
      relationshipType: "colleague",
      autoCreatedFrom: "beeper",
      memoCount: 0,
      lastInteractionAt: thread.lastMessageAt || undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(thread._id, {
      linkedPersonId: personId,
      updatedAt: now,
    });

    return {
      personId,
      created: true,
    };
  },
});

export const applyAutoLinkInternal = internalMutation({
  args: {
    userId: v.id("users"),
    threadConvexId: v.id("lifeos_beeperThreads"),
    personId: v.optional(v.id("lifeos_frmPeople")),
    meetingSource: v.union(v.literal("granola"), v.literal("fathom")),
    meetingId: v.string(),
    confidence: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    let granolaThreadLinksCreated = 0;
    let granolaPersonLinksCreated = 0;
    let unifiedMeetingLinksCreated = 0;
    const now = Date.now();

    if (args.meetingSource === "granola") {
      const meetingId = args.meetingId as Id<"life_granolaMeetings">;
      const meeting = await ctx.db.get(meetingId);
      if (!meeting || meeting.userId !== args.userId) {
        return {
          granolaThreadLinksCreated,
          granolaPersonLinksCreated,
          unifiedMeetingLinksCreated,
        };
      }

      const existingThreadLink = await ctx.db
        .query("life_granolaMeetingLinks")
        .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
        .filter((q) => q.eq(q.field("beeperThreadId"), args.threadConvexId))
        .first();

      if (!existingThreadLink) {
        await ctx.db.insert("life_granolaMeetingLinks", {
          userId: args.userId,
          meetingId,
          beeperThreadId: args.threadConvexId,
          linkSource: "ai_suggestion",
          aiConfidence: args.confidence,
          aiReason: args.reason,
          createdAt: now,
        });
        granolaThreadLinksCreated++;
      }

      if (args.personId) {
        const existingPersonLink = await ctx.db
          .query("life_granolaMeetingPersonLinks")
          .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
          .filter((q) => q.eq(q.field("personId"), args.personId))
          .first();

        if (!existingPersonLink) {
          await ctx.db.insert("life_granolaMeetingPersonLinks", {
            userId: args.userId,
            meetingId,
            personId: args.personId,
            linkSource: "ai_suggestion",
            aiConfidence: args.confidence,
            aiReason: args.reason,
            createdAt: now,
          });
          granolaPersonLinksCreated++;
        }

        const existingUnifiedLink = await ctx.db
          .query("lifeos_meetingPersonLinks")
          .withIndex("by_meeting", (q) =>
            q.eq("meetingSource", "granola").eq("meetingId", args.meetingId)
          )
          .filter((q) => q.eq(q.field("personId"), args.personId))
          .first();

        if (!existingUnifiedLink) {
          await ctx.db.insert("lifeos_meetingPersonLinks", {
            userId: args.userId,
            personId: args.personId,
            meetingSource: "granola",
            meetingId: args.meetingId,
            linkSource: "ai_suggestion",
            confidence: args.confidence,
            reason: args.reason,
            createdAt: now,
          });
          unifiedMeetingLinksCreated++;
        }
      }
    }

    if (args.meetingSource === "fathom" && args.personId) {
      const meetingId = args.meetingId as Id<"life_fathomMeetings">;
      const meeting = await ctx.db.get(meetingId);
      if (!meeting || meeting.userId !== args.userId) {
        return {
          granolaThreadLinksCreated,
          granolaPersonLinksCreated,
          unifiedMeetingLinksCreated,
        };
      }

      const existingUnifiedLink = await ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_meeting", (q) =>
          q.eq("meetingSource", "fathom").eq("meetingId", args.meetingId)
        )
        .filter((q) => q.eq(q.field("personId"), args.personId))
        .first();

      if (!existingUnifiedLink) {
        await ctx.db.insert("lifeos_meetingPersonLinks", {
          userId: args.userId,
          personId: args.personId,
          meetingSource: "fathom",
          meetingId: args.meetingId,
          linkSource: "ai_suggestion",
          confidence: args.confidence,
          reason: args.reason,
          createdAt: now,
        });
        unifiedMeetingLinksCreated++;
      }
    }

    return {
      granolaThreadLinksCreated,
      granolaPersonLinksCreated,
      unifiedMeetingLinksCreated,
    };
  },
});

// ==================== ACTIONS ====================

/**
 * Automatically link Beeper business contacts to Granola/Fathom meetings via AI.
 * Uses chat/thread names and meeting titles/summaries for matching.
 */
export const autoLinkBusinessContacts = action({
  args: {
    minConfidence: v.optional(v.number()),
    maxGranolaMeetings: v.optional(v.number()),
    maxFathomMeetings: v.optional(v.number()),
    maxLinksToApply: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    analysis: v.optional(v.string()),
    evaluatedThreads: v.number(),
    evaluatedMeetings: v.number(),
    aiSuggestedLinks: v.number(),
    appliedLinks: v.number(),
    granolaThreadLinksCreated: v.number(),
    granolaPersonLinksCreated: v.number(),
    unifiedMeetingLinksCreated: v.number(),
    autoCreatedPeople: v.number(),
  }),
  handler: async (ctx, args): Promise<AutoLinkActionResult> => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return {
          success: false,
          error: "Not authenticated",
          evaluatedThreads: 0,
          evaluatedMeetings: 0,
          aiSuggestedLinks: 0,
          appliedLinks: 0,
          granolaThreadLinksCreated: 0,
          granolaPersonLinksCreated: 0,
          unifiedMeetingLinksCreated: 0,
          autoCreatedPeople: 0,
        };
      }

      const user = (await ctx.runQuery(
        internal.common.users.getUserByTokenIdentifier,
        { tokenIdentifier: identity.tokenIdentifier }
      )) as Doc<"users"> | null;

      if (!user) {
        return {
          success: false,
          error: "User not found in database",
          evaluatedThreads: 0,
          evaluatedMeetings: 0,
          aiSuggestedLinks: 0,
          appliedLinks: 0,
          granolaThreadLinksCreated: 0,
          granolaPersonLinksCreated: 0,
          unifiedMeetingLinksCreated: 0,
          autoCreatedPeople: 0,
        };
      }

      const maxGranolaMeetings = args.maxGranolaMeetings ?? 120;
      const maxFathomMeetings = args.maxFathomMeetings ?? 120;
      const minConfidence = args.minConfidence ?? 0.65;
      const maxLinksToApply = args.maxLinksToApply ?? 120;

      const data = (await ctx.runQuery(internal.lifeos.beeper.getAutoLinkDataInternal, {
        userId: user._id,
        maxGranolaMeetings,
        maxFathomMeetings,
      })) as AutoLinkData;

      if (data.businessThreads.length === 0) {
        return {
          success: true,
          analysis: "No business chats found.",
          evaluatedThreads: 0,
          evaluatedMeetings: 0,
          aiSuggestedLinks: 0,
          appliedLinks: 0,
          granolaThreadLinksCreated: 0,
          granolaPersonLinksCreated: 0,
          unifiedMeetingLinksCreated: 0,
          autoCreatedPeople: 0,
        };
      }

      const meetingCandidates = [
        ...data.granolaMeetings.map((meeting) => ({
          source: "granola" as const,
          meetingId: meeting._id as string,
          title: meeting.title,
          date: meeting.granolaCreatedAt,
          summary: meeting.resumeMarkdown?.slice(0, 260),
        })),
        ...data.fathomMeetings.map((meeting) => ({
          source: "fathom" as const,
          meetingId: meeting._id as string,
          title: meeting.title,
          date: meeting.fathomCreatedAt,
          summary: meeting.summaryMarkdown?.slice(0, 260),
        })),
      ];

      if (meetingCandidates.length === 0) {
        return {
          success: true,
          analysis: "No Granola/Fathom meetings found to link.",
          evaluatedThreads: data.businessThreads.length,
          evaluatedMeetings: 0,
          aiSuggestedLinks: 0,
          appliedLinks: 0,
          granolaThreadLinksCreated: 0,
          granolaPersonLinksCreated: 0,
          unifiedMeetingLinksCreated: 0,
          autoCreatedPeople: 0,
        };
      }

      const threadsPayload = data.businessThreads.map((thread) => ({
        threadConvexId: thread._id as string,
        threadName: thread.threadName,
        threadType: thread.threadType,
        businessNote: thread.businessNote ?? "",
      }));

      const aiPrompt = `BUSINESS CONTACTS (BEEPER):
${JSON.stringify(threadsPayload, null, 2)}

MEETING CANDIDATES (GRANOLA + FATHOM):
${JSON.stringify(meetingCandidates, null, 2)}

Return high-confidence links. Focus on name/company matching in titles and summaries.`;

      const aiResult = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: AUTO_CONTACT_LINKING_PROMPT },
            { role: "user", content: aiPrompt },
          ],
          responseFormat: "json",
          temperature: 0.1,
          maxTokens: 4096,
        },
        context: {
          feature: "beeper_business_contact_autolink",
          description: "Auto-link Beeper business contacts to Granola/Fathom meetings",
        },
      });

      let parsed: AutoLinkAIResult;
      try {
        let jsonContent = aiResult.content.trim();
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }
        parsed = JSON.parse(jsonContent) as AutoLinkAIResult;
      } catch {
        return {
          success: false,
          error: "Failed to parse AI auto-link response",
          evaluatedThreads: data.businessThreads.length,
          evaluatedMeetings: meetingCandidates.length,
          aiSuggestedLinks: 0,
          appliedLinks: 0,
          granolaThreadLinksCreated: 0,
          granolaPersonLinksCreated: 0,
          unifiedMeetingLinksCreated: 0,
          autoCreatedPeople: 0,
        };
      }

      const threadById = new Map(
        data.businessThreads.map((thread) => [thread._id as string, thread])
      );
      const granolaMeetingIds = new Set(
        data.granolaMeetings.map((meeting) => meeting._id as string)
      );
      const fathomMeetingIds = new Set(
        data.fathomMeetings.map((meeting) => meeting._id as string)
      );

      const validSuggestions = (parsed.links ?? [])
        .filter((item) => item.confidence >= minConfidence)
        .filter((item) => {
          const threadExists = threadById.has(item.threadConvexId);
          if (!threadExists) return false;
          if (item.meetingSource === "granola") {
            return granolaMeetingIds.has(item.meetingId);
          }
          return fathomMeetingIds.has(item.meetingId);
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxLinksToApply);

      let appliedLinks = 0;
      let autoCreatedPeople = 0;
      let granolaThreadLinksCreated = 0;
      let granolaPersonLinksCreated = 0;
      let unifiedMeetingLinksCreated = 0;

      const personIdCache = new Map<string, Id<"lifeos_frmPeople"> | undefined>();

      for (const suggestion of validSuggestions) {
        const thread = threadById.get(suggestion.threadConvexId);
        if (!thread) continue;

        let personId: Id<"lifeos_frmPeople"> | undefined = thread.linkedPersonId;
        if (!personIdCache.has(thread._id as string)) {
          personIdCache.set(thread._id as string, personId);
        } else {
          personId = personIdCache.get(thread._id as string) ?? undefined;
        }

        // Fathom links are person-based. For Granola, we also keep person links in sync.
        if (!personId) {
          const ensured = await ctx.runMutation(
            internal.lifeos.beeper.ensurePersonForThreadInternal,
            {
              userId: user._id,
              threadConvexId: thread._id,
            }
          );
          personId = ensured.personId;
          personIdCache.set(thread._id as string, personId);
          if (ensured.created) {
            autoCreatedPeople++;
          }
        }

        const result = await ctx.runMutation(
          internal.lifeos.beeper.applyAutoLinkInternal,
          {
            userId: user._id,
            threadConvexId: thread._id,
            personId,
            meetingSource: suggestion.meetingSource,
            meetingId: suggestion.meetingId,
            confidence: suggestion.confidence,
            reason: suggestion.reason || "Auto-linked by AI from contact/meeting name match",
          }
        );

        const insertedCount =
          result.granolaThreadLinksCreated +
          result.granolaPersonLinksCreated +
          result.unifiedMeetingLinksCreated;
        if (insertedCount > 0) {
          appliedLinks++;
        }
        granolaThreadLinksCreated += result.granolaThreadLinksCreated;
        granolaPersonLinksCreated += result.granolaPersonLinksCreated;
        unifiedMeetingLinksCreated += result.unifiedMeetingLinksCreated;
      }

      return {
        success: true,
        analysis: parsed.analysis,
        evaluatedThreads: data.businessThreads.length,
        evaluatedMeetings: meetingCandidates.length,
        aiSuggestedLinks: validSuggestions.length,
        appliedLinks,
        granolaThreadLinksCreated,
        granolaPersonLinksCreated,
        unifiedMeetingLinksCreated,
        autoCreatedPeople,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown auto-link error";
      return {
        success: false,
        error: message,
        evaluatedThreads: 0,
        evaluatedMeetings: 0,
        aiSuggestedLinks: 0,
        appliedLinks: 0,
        granolaThreadLinksCreated: 0,
        granolaPersonLinksCreated: 0,
        unifiedMeetingLinksCreated: 0,
        autoCreatedPeople: 0,
      };
    }
  },
});

// ==================== MUTATIONS ====================

/**
 * Mark a thread as business (or unmark)
 */
export const markThreadAsBusiness = mutation({
  args: {
    threadId: v.string(),
    isBusinessChat: v.boolean(),
    businessNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find existing thread
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        isBusinessChat: args.isBusinessChat,
        businessNote: args.businessNote,
        updatedAt: now,
      });
      return existing._id;
    }

    // Thread doesn't exist in Convex yet - return null
    // (caller should upsert the thread first)
    return null;
  },
});

/**
 * Link a thread to a person (for DM business chats)
 */
export const linkThreadToPerson = mutation({
  args: {
    threadId: v.string(),
    personId: v.optional(v.id("lifeos_frmPeople")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find existing thread
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (!existing) {
      throw new Error("Thread not found. Sync the thread first.");
    }

    // If personId provided, verify it belongs to user
    if (args.personId) {
      const person = await ctx.db.get(args.personId);
      if (!person || person.userId !== user._id) {
        throw new Error("Person not found or access denied");
      }
    }

    await ctx.db.patch(existing._id, {
      linkedPersonId: args.personId,
      updatedAt: now,
    });

    return existing._id;
  },
});

/**
 * Link a thread to a client (for business chats)
 */
export const linkThreadToClient = mutation({
  args: {
    threadId: v.string(),
    clientId: v.optional(v.id("lifeos_pmClients")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Find existing thread
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (!existing) {
      throw new Error("Thread not found. Sync the thread first.");
    }

    // If clientId provided, verify it belongs to user
    if (args.clientId) {
      const client = await ctx.db.get(args.clientId);
      if (!client || client.userId !== user._id) {
        throw new Error("Client not found or access denied");
      }
    }

    await ctx.db.patch(existing._id, {
      linkedClientId: args.clientId,
      updatedAt: now,
    });

    return existing._id;
  },
});

/**
 * Unlink an AI meeting note from a business contact.
 * Removes link records tied to this Beeper thread and its linked person (if any).
 */
export const unlinkMeetingFromBusinessContact = mutation({
  args: {
    threadConvexId: v.id("lifeos_beeperThreads"),
    meetingSource: v.union(v.literal("granola"), v.literal("fathom")),
    meetingId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const thread = await ctx.db.get(args.threadConvexId);
    if (!thread || thread.userId !== user._id) {
      throw new Error("Business contact not found or access denied");
    }

    let deletedGranolaThreadLinks = 0;
    let deletedGranolaPersonLinks = 0;
    let deletedUnifiedPersonLinks = 0;

    if (args.meetingSource === "granola") {
      const threadLinks = await ctx.db
        .query("life_granolaMeetingLinks")
        .withIndex("by_beeperThread", (q) => q.eq("beeperThreadId", thread._id))
        .collect();

      for (const link of threadLinks) {
        if (link.userId !== user._id) continue;
        if ((link.meetingId as string) !== args.meetingId) continue;
        await ctx.db.delete(link._id);
        deletedGranolaThreadLinks++;
      }

      if (thread.linkedPersonId) {
        const legacyPersonLinks = await ctx.db
          .query("life_granolaMeetingPersonLinks")
          .withIndex("by_person", (q) => q.eq("personId", thread.linkedPersonId!))
          .collect();

        for (const link of legacyPersonLinks) {
          if (link.userId !== user._id) continue;
          if ((link.meetingId as string) !== args.meetingId) continue;
          await ctx.db.delete(link._id);
          deletedGranolaPersonLinks++;
        }

        const unifiedLinks = await ctx.db
          .query("lifeos_meetingPersonLinks")
          .withIndex("by_person_source", (q) =>
            q.eq("personId", thread.linkedPersonId!).eq("meetingSource", "granola")
          )
          .collect();

        for (const link of unifiedLinks) {
          if (link.userId !== user._id) continue;
          if (link.meetingId !== args.meetingId) continue;
          await ctx.db.delete(link._id);
          deletedUnifiedPersonLinks++;
        }
      }
    }

    if (args.meetingSource === "fathom" && thread.linkedPersonId) {
      const unifiedLinks = await ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_person_source", (q) =>
          q.eq("personId", thread.linkedPersonId!).eq("meetingSource", "fathom")
        )
        .collect();

      for (const link of unifiedLinks) {
        if (link.userId !== user._id) continue;
        if (link.meetingId !== args.meetingId) continue;
        await ctx.db.delete(link._id);
        deletedUnifiedPersonLinks++;
      }
    }

    return {
      success: true,
      deletedGranolaThreadLinks,
      deletedGranolaPersonLinks,
      deletedUnifiedPersonLinks,
      totalDeleted:
        deletedGranolaThreadLinks +
        deletedGranolaPersonLinks +
        deletedUnifiedPersonLinks,
    };
  },
});

/**
 * Upsert a single thread (create or update based on threadId)
 */
export const upsertThread = mutation({
  args: {
    threadId: v.string(),
    threadName: v.string(),
    threadType: beeperThreadTypeValidator,
    participantCount: v.number(),
    messageCount: v.number(),
    lastMessageAt: v.number(),
    isBusinessChat: v.boolean(),
    businessNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if thread already exists
    const existing = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (existing) {
      // Update existing thread
      await ctx.db.patch(existing._id, {
        threadName: args.threadName,
        threadType: args.threadType,
        participantCount: args.participantCount,
        messageCount: args.messageCount,
        lastMessageAt: args.lastMessageAt,
        isBusinessChat: args.isBusinessChat,
        businessNote: args.businessNote,
        lastSyncedAt: now,
        updatedAt: now,
      });
      return { id: existing._id, isNew: false };
    }

    // Insert new thread
    const id = await ctx.db.insert("lifeos_beeperThreads", {
      userId: user._id,
      threadId: args.threadId,
      threadName: args.threadName,
      threadType: args.threadType,
      participantCount: args.participantCount,
      messageCount: args.messageCount,
      lastMessageAt: args.lastMessageAt,
      isBusinessChat: args.isBusinessChat,
      businessNote: args.businessNote,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { id, isNew: true };
  },
});

/**
 * Batch upsert threads (create or update based on threadId)
 */
export const upsertThreadBatch = mutation({
  args: {
    threads: v.array(
      v.object({
        threadId: v.string(),
        threadName: v.string(),
        threadType: beeperThreadTypeValidator,
        participantCount: v.number(),
        messageCount: v.number(),
        lastMessageAt: v.number(),
        isBusinessChat: v.boolean(),
        businessNote: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const thread of args.threads) {
      // Check if thread already exists
      const existing = await ctx.db
        .query("lifeos_beeperThreads")
        .withIndex("by_user_threadId", (q) =>
          q.eq("userId", user._id).eq("threadId", thread.threadId)
        )
        .unique();

      if (existing) {
        // Update existing thread
        await ctx.db.patch(existing._id, {
          threadName: thread.threadName,
          threadType: thread.threadType,
          participantCount: thread.participantCount,
          messageCount: thread.messageCount,
          lastMessageAt: thread.lastMessageAt,
          isBusinessChat: thread.isBusinessChat,
          businessNote: thread.businessNote,
          lastSyncedAt: now,
          updatedAt: now,
        });
        updatedCount++;
      } else {
        // Insert new thread
        await ctx.db.insert("lifeos_beeperThreads", {
          userId: user._id,
          threadId: thread.threadId,
          threadName: thread.threadName,
          threadType: thread.threadType,
          participantCount: thread.participantCount,
          messageCount: thread.messageCount,
          lastMessageAt: thread.lastMessageAt,
          isBusinessChat: thread.isBusinessChat,
          businessNote: thread.businessNote,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount };
  },
});

/**
 * Batch upsert messages (create or update based on messageId)
 */
export const upsertMessagesBatch = mutation({
  args: {
    messages: v.array(
      v.object({
        threadId: v.string(),
        messageId: v.string(),
        sender: v.string(),
        text: v.string(),
        timestamp: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const message of args.messages) {
      // Check if message already exists
      const existing = await ctx.db
        .query("lifeos_beeperMessages")
        .withIndex("by_user_messageId", (q) =>
          q.eq("userId", user._id).eq("messageId", message.messageId)
        )
        .unique();

      if (existing) {
        // Update if content changed
        if (existing.text !== message.text) {
          await ctx.db.patch(existing._id, {
            text: message.text,
            updatedAt: now,
          });
          updatedCount++;
        }
      } else {
        // Insert new message
        await ctx.db.insert("lifeos_beeperMessages", {
          userId: user._id,
          threadId: message.threadId,
          messageId: message.messageId,
          sender: message.sender,
          text: message.text,
          timestamp: message.timestamp,
          createdAt: now,
          updatedAt: now,
        });
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount };
  },
});

/**
 * Delete all messages for a thread (used when unmarking as business)
 */
export const deleteThreadMessages = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const messages = await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .collect();

    let deletedCount = 0;
    for (const message of messages) {
      await ctx.db.delete(message._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

/**
 * Delete a thread (and optionally its messages)
 */
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
    deleteMessages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const thread = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId)
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found");
    }

    // Delete messages if requested
    if (args.deleteMessages) {
      const messages = await ctx.db
        .query("lifeos_beeperMessages")
        .withIndex("by_user_threadId", (q) =>
          q.eq("userId", user._id).eq("threadId", args.threadId)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
    }

    // Delete thread
    await ctx.db.delete(thread._id);

    return { success: true };
  },
});
