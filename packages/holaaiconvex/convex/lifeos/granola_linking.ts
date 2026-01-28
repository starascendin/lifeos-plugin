import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";

// ==================== SYSTEM PROMPTS ====================

const CONTACT_LINKING_PROMPT = `You are an AI assistant that analyzes meeting notes to identify which business contacts were involved or discussed.

Given:
1. Meeting title and notes/transcript content
2. A list of business contacts with their names and context

Your task: Determine which contacts are likely involved in or relevant to this meeting.

Analyze the meeting content for:
- Names mentioned directly
- Company names that match contact context
- Topics/projects discussed that relate to known contacts
- Sender names in messages if from business threads

Return ONLY a raw JSON object with NO markdown formatting:
{
  "suggestions": [
    {
      "threadId": "string (the thread ID from the provided list)",
      "contactName": "string (the contact name)",
      "confidence": 0.0-1.0,
      "reason": "string (brief explanation why this contact is relevant)"
    }
  ],
  "analysis": "string (brief summary of names/companies found in meeting)"
}

RULES:
- Only suggest contacts when you have reasonable evidence they're relevant
- confidence >= 0.8: Direct name match or explicit mention
- confidence 0.5-0.7: Company/project match or contextual reference
- confidence < 0.5: Weak/tangential connection (don't include these)
- Return empty suggestions array if no good matches found
- Maximum 3 suggestions per meeting`;

const PERSON_LINKING_PROMPT = `You are an AI that analyzes meeting notes to identify which contacts were involved.

Given:
1. Meeting title, notes, and transcript
2. List of contacts with names, nicknames, notes, and relationship types

Analyze for:
- Direct name mentions (first or full name)
- Nickname matches
- Company names in contact notes
- Contextual clues (topics → related contacts)

Return ONLY a raw JSON object with NO markdown formatting:
{
  "suggestions": [
    { "personId": "string (the person ID from the provided list)", "contactName": "string (the contact name)", "confidence": 0.0-1.0, "reason": "string (brief explanation)" }
  ],
  "analysis": "Brief summary of names found"
}

Confidence scoring:
- >= 0.8: Direct name match
- 0.5-0.7: Company/project match or contextual
- < 0.5: Don't include
- Max 5 suggestions`;

// ==================== TYPES ====================

interface ContactSuggestion {
  threadId: string;
  contactName: string;
  confidence: number;
  reason: string;
}

interface LinkingSuggestionResult {
  suggestions: ContactSuggestion[];
  analysis: string;
}

interface PersonSuggestion {
  personId: string;
  contactName: string;
  confidence: number;
  reason: string;
}

interface PersonLinkingSuggestionResult {
  suggestions: PersonSuggestion[];
  analysis: string;
}

// ==================== INTERNAL QUERIES ====================

/**
 * Get meeting by ID (internal)
 */
export const getMeetingInternal = internalQuery({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.meetingId);
  },
});

/**
 * Get transcript for a meeting (internal)
 */
export const getTranscriptInternal = internalQuery({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("life_granolaTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .unique();
  },
});

/**
 * Get business threads for a user (internal)
 */
export const getBusinessThreadsInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", args.userId).eq("isBusinessChat", true)
      )
      .collect();
  },
});

/**
 * Get existing links for a meeting (internal)
 */
export const getExistingLinksInternal = internalQuery({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();
  },
});

// ==================== INTERNAL MUTATIONS ====================

/**
 * Create a meeting link (internal)
 */
export const createMeetingLinkInternal = internalMutation({
  args: {
    userId: v.id("users"),
    meetingId: v.id("life_granolaMeetings"),
    beeperThreadId: v.id("lifeos_beeperThreads"),
    linkSource: v.union(v.literal("ai_suggestion"), v.literal("manual")),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if link already exists
    const existing = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .filter((q) => q.eq(q.field("beeperThreadId"), args.beeperThreadId))
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    const id = await ctx.db.insert("life_granolaMeetingLinks", {
      userId: args.userId,
      meetingId: args.meetingId,
      beeperThreadId: args.beeperThreadId,
      linkSource: args.linkSource,
      aiConfidence: args.aiConfidence,
      aiReason: args.aiReason,
      createdAt: now,
    });

    return { id, isNew: true };
  },
});

// ==================== ACTIONS ====================

// Result type for suggestContactLinks
type SuggestContactLinksResult = {
  success: boolean;
  error?: string;
  suggestions?: Array<{
    threadId: Id<"lifeos_beeperThreads">;
    contactName: string;
    confidence: number;
    reason: string;
  }>;
  analysis?: string;
  alreadyLinked?: string[];
};

/**
 * Suggest business contacts to link with a meeting based on content analysis
 */
export const suggestContactLinks = action({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    suggestions: v.optional(
      v.array(
        v.object({
          threadId: v.id("lifeos_beeperThreads"),
          contactName: v.string(),
          confidence: v.number(),
          reason: v.string(),
        })
      )
    ),
    analysis: v.optional(v.string()),
    alreadyLinked: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args): Promise<SuggestContactLinksResult> => {
    try {
      // Get the meeting
      const meeting = await ctx.runQuery(
        internal.lifeos.granola_linking.getMeetingInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetings"> | null;

      if (!meeting) {
        return { success: false, error: "Meeting not found" };
      }

      const userId: Id<"users"> = meeting.userId;

      // Get business threads for matching
      const businessThreads = await ctx.runQuery(
        internal.lifeos.granola_linking.getBusinessThreadsInternal,
        { userId }
      ) as Doc<"lifeos_beeperThreads">[];

      if (businessThreads.length === 0) {
        return {
          success: true,
          suggestions: [],
          analysis: "No business contacts found. Mark some Beeper chats as business to enable linking.",
        };
      }

      // Get existing links to filter out
      const existingLinks = await ctx.runQuery(
        internal.lifeos.granola_linking.getExistingLinksInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetingLinks">[];
      const linkedThreadIds = new Set(existingLinks.map((l) => l.beeperThreadId));

      // Get transcript if available
      const transcript = await ctx.runQuery(
        internal.lifeos.granola_linking.getTranscriptInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaTranscripts"> | null;

      // Build meeting content for analysis
      const meetingContent = [
        `Meeting Title: ${meeting.title}`,
        meeting.resumeMarkdown ? `\nNotes:\n${meeting.resumeMarkdown}` : "",
        transcript?.transcriptMarkdown
          ? `\nTranscript excerpt:\n${transcript.transcriptMarkdown.substring(0, 3000)}`
          : "",
      ].join("");

      // Build contacts list for AI
      const contactsList = businessThreads
        .filter((t) => !linkedThreadIds.has(t._id))
        .map((t) => ({
          threadId: t._id,
          name: t.threadName,
          note: t.businessNote || "",
          type: t.threadType,
        }));

      if (contactsList.length === 0) {
        return {
          success: true,
          suggestions: [],
          analysis: "All business contacts are already linked to this meeting.",
          alreadyLinked: businessThreads.filter((t) => linkedThreadIds.has(t._id)).map((t) => t.threadName),
        };
      }

      // Call AI to analyze and suggest
      const model = "google/gemini-2.5-flash";
      const prompt = `MEETING CONTENT:
${meetingContent}

AVAILABLE BUSINESS CONTACTS:
${JSON.stringify(contactsList, null, 2)}

Analyze the meeting content and suggest which contacts are relevant.`;

      console.log(`[Granola Linking] Analyzing meeting ${args.meetingId}, ${contactsList.length} potential contacts`);

      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model,
          messages: [
            { role: "system", content: CONTACT_LINKING_PROMPT },
            { role: "user", content: prompt },
          ],
          responseFormat: "json",
          temperature: 0.3,
          maxTokens: 2048,
        },
        context: {
          feature: "granola_contact_linking",
          description: "Suggest contact links for meeting",
        },
      });

      // Parse AI response
      let parsed: LinkingSuggestionResult;
      try {
        let jsonContent = result.content.trim();
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }
        parsed = JSON.parse(jsonContent);
      } catch {
        console.error(`[Granola Linking] Failed to parse AI response:`, result.content.substring(0, 200));
        return { success: false, error: "Failed to parse AI response" };
      }

      // Validate and transform suggestions
      const validSuggestions: Array<{
        threadId: Id<"lifeos_beeperThreads">;
        contactName: string;
        confidence: number;
        reason: string;
      }> = [];

      for (const suggestion of parsed.suggestions || []) {
        // Validate thread ID exists in our list
        const thread = contactsList.find((c) => c.threadId === suggestion.threadId);
        if (thread && suggestion.confidence >= 0.5) {
          validSuggestions.push({
            threadId: suggestion.threadId as Id<"lifeos_beeperThreads">,
            contactName: suggestion.contactName || thread.name,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          });
        }
      }

      console.log(`[Granola Linking] Found ${validSuggestions.length} suggestions for meeting ${args.meetingId}`);

      return {
        success: true,
        suggestions: validSuggestions,
        analysis: parsed.analysis,
        alreadyLinked: businessThreads.filter((t) => linkedThreadIds.has(t._id)).map((t) => t.threadName),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Granola Linking] Error:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});

// Result type for acceptSuggestion
type AcceptSuggestionResult = {
  success: boolean;
  error?: string;
  linkId?: Id<"life_granolaMeetingLinks">;
};

/**
 * Accept an AI suggestion and create the link
 */
export const acceptSuggestion = action({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    beeperThreadId: v.id("lifeos_beeperThreads"),
    confidence: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    linkId: v.optional(v.id("life_granolaMeetingLinks")),
  }),
  handler: async (ctx, args): Promise<AcceptSuggestionResult> => {
    try {
      // Get meeting to get userId
      const meeting = await ctx.runQuery(
        internal.lifeos.granola_linking.getMeetingInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetings"> | null;

      if (!meeting) {
        return { success: false, error: "Meeting not found" };
      }

      // Create the link
      const result = await ctx.runMutation(
        internal.lifeos.granola_linking.createMeetingLinkInternal,
        {
          userId: meeting.userId,
          meetingId: args.meetingId,
          beeperThreadId: args.beeperThreadId,
          linkSource: "ai_suggestion" as const,
          aiConfidence: args.confidence,
          aiReason: args.reason,
        }
      ) as { id: Id<"life_granolaMeetingLinks">; isNew: boolean };

      return {
        success: true,
        linkId: result.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  },
});

// ==================== PERSON LINKING INTERNAL QUERIES ====================

/**
 * Get all People for a user (internal)
 */
export const getPeopleInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user_archived", (q) =>
        q.eq("userId", args.userId).eq("archivedAt", undefined)
      )
      .collect();
  },
});

/**
 * Get existing person links for a meeting (internal)
 */
export const getExistingPersonLinksInternal = internalQuery({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();
  },
});

// ==================== PERSON LINKING INTERNAL MUTATIONS ====================

/**
 * Create a meeting-person link (internal)
 */
export const createMeetingPersonLinkInternal = internalMutation({
  args: {
    userId: v.id("users"),
    meetingId: v.id("life_granolaMeetings"),
    personId: v.id("lifeos_frmPeople"),
    linkSource: v.union(v.literal("ai_suggestion"), v.literal("manual")),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if link already exists
    const existing = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .first();

    if (existing) {
      return { id: existing._id, isNew: false };
    }

    const id = await ctx.db.insert("life_granolaMeetingPersonLinks", {
      userId: args.userId,
      meetingId: args.meetingId,
      personId: args.personId,
      linkSource: args.linkSource,
      aiConfidence: args.aiConfidence,
      aiReason: args.aiReason,
      createdAt: now,
    });

    return { id, isNew: true };
  },
});

// ==================== PERSON LINKING ACTIONS ====================

// Result type for suggestPersonLinks
type SuggestPersonLinksResult = {
  success: boolean;
  error?: string;
  suggestions?: Array<{
    personId: Id<"lifeos_frmPeople">;
    contactName: string;
    confidence: number;
    reason: string;
  }>;
  analysis?: string;
  alreadyLinked?: string[];
};

/**
 * Suggest People (contacts) to link with a meeting based on content analysis
 */
export const suggestPersonLinks = action({
  args: {
    meetingId: v.id("life_granolaMeetings"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    suggestions: v.optional(
      v.array(
        v.object({
          personId: v.id("lifeos_frmPeople"),
          contactName: v.string(),
          confidence: v.number(),
          reason: v.string(),
        })
      )
    ),
    analysis: v.optional(v.string()),
    alreadyLinked: v.optional(v.array(v.string())),
  }),
  handler: async (ctx, args): Promise<SuggestPersonLinksResult> => {
    try {
      // Get the meeting
      const meeting = await ctx.runQuery(
        internal.lifeos.granola_linking.getMeetingInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetings"> | null;

      if (!meeting) {
        return { success: false, error: "Meeting not found" };
      }

      const userId: Id<"users"> = meeting.userId;

      // Get all People for matching
      const people = await ctx.runQuery(
        internal.lifeos.granola_linking.getPeopleInternal,
        { userId }
      ) as Doc<"lifeos_frmPeople">[];

      if (people.length === 0) {
        return {
          success: true,
          suggestions: [],
          analysis: "No contacts found. Create some People in the FRM to enable linking.",
        };
      }

      // Get existing person links to filter out
      const existingLinks = await ctx.runQuery(
        internal.lifeos.granola_linking.getExistingPersonLinksInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetingPersonLinks">[];
      const linkedPersonIds = new Set(existingLinks.map((l) => l.personId));

      // Get transcript if available
      const transcript = await ctx.runQuery(
        internal.lifeos.granola_linking.getTranscriptInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaTranscripts"> | null;

      // Build meeting content for analysis
      const meetingContent = [
        `Meeting Title: ${meeting.title}`,
        meeting.resumeMarkdown ? `\nNotes:\n${meeting.resumeMarkdown}` : "",
        transcript?.transcriptMarkdown
          ? `\nTranscript excerpt:\n${transcript.transcriptMarkdown.substring(0, 3000)}`
          : "",
      ].join("");

      // Build contacts list for AI
      const contactsList = people
        .filter((p) => !linkedPersonIds.has(p._id))
        .map((p) => ({
          personId: p._id,
          name: p.name,
          nickname: p.nickname || "",
          notes: p.notes || "",
          relationshipType: p.relationshipType || "other",
        }));

      if (contactsList.length === 0) {
        return {
          success: true,
          suggestions: [],
          analysis: "All contacts are already linked to this meeting.",
          alreadyLinked: people.filter((p) => linkedPersonIds.has(p._id)).map((p) => p.name),
        };
      }

      // Call AI to analyze and suggest
      const model = "google/gemini-2.5-flash";
      const prompt = `MEETING CONTENT:
${meetingContent}

AVAILABLE CONTACTS:
${JSON.stringify(contactsList, null, 2)}

Analyze the meeting content and suggest which contacts are relevant.`;

      console.log(`[Granola Person Linking] Analyzing meeting ${args.meetingId}, ${contactsList.length} potential contacts`);

      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model,
          messages: [
            { role: "system", content: PERSON_LINKING_PROMPT },
            { role: "user", content: prompt },
          ],
          responseFormat: "json",
          temperature: 0.3,
          maxTokens: 2048,
        },
        context: {
          feature: "granola_person_linking",
          description: "Suggest person links for meeting",
        },
      });

      // Parse AI response
      let parsed: PersonLinkingSuggestionResult;
      try {
        let jsonContent = result.content.trim();
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }
        parsed = JSON.parse(jsonContent);
      } catch {
        console.error(`[Granola Person Linking] Failed to parse AI response:`, result.content.substring(0, 200));
        return { success: false, error: "Failed to parse AI response" };
      }

      // Validate and transform suggestions
      const validSuggestions: Array<{
        personId: Id<"lifeos_frmPeople">;
        contactName: string;
        confidence: number;
        reason: string;
      }> = [];

      for (const suggestion of parsed.suggestions || []) {
        // Validate person ID exists in our list
        const person = contactsList.find((c) => c.personId === suggestion.personId);
        if (person && suggestion.confidence >= 0.5) {
          validSuggestions.push({
            personId: suggestion.personId as Id<"lifeos_frmPeople">,
            contactName: suggestion.contactName || person.name,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          });
        }
      }

      console.log(`[Granola Person Linking] Found ${validSuggestions.length} suggestions for meeting ${args.meetingId}`);

      return {
        success: true,
        suggestions: validSuggestions,
        analysis: parsed.analysis,
        alreadyLinked: people.filter((p) => linkedPersonIds.has(p._id)).map((p) => p.name),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Granola Person Linking] Error:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});

// Result type for acceptPersonSuggestion
type AcceptPersonSuggestionResult = {
  success: boolean;
  error?: string;
  linkId?: Id<"life_granolaMeetingPersonLinks">;
};

/**
 * Accept an AI person suggestion and create the link
 */
export const acceptPersonSuggestion = action({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    personId: v.id("lifeos_frmPeople"),
    confidence: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    linkId: v.optional(v.id("life_granolaMeetingPersonLinks")),
  }),
  handler: async (ctx, args): Promise<AcceptPersonSuggestionResult> => {
    try {
      // Get meeting to get userId
      const meeting = await ctx.runQuery(
        internal.lifeos.granola_linking.getMeetingInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetings"> | null;

      if (!meeting) {
        return { success: false, error: "Meeting not found" };
      }

      // Create the link
      const result = await ctx.runMutation(
        internal.lifeos.granola_linking.createMeetingPersonLinkInternal,
        {
          userId: meeting.userId,
          meetingId: args.meetingId,
          personId: args.personId,
          linkSource: "ai_suggestion" as const,
          aiConfidence: args.confidence,
          aiReason: args.reason,
        }
      ) as { id: Id<"life_granolaMeetingPersonLinks">; isNew: boolean };

      return {
        success: true,
        linkId: result.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  },
});

// ==================== CALENDAR → BEEPER MATCHING ====================

const CALENDAR_BEEPER_MATCHING_PROMPT = `You are an AI that matches calendar event attendees to business contacts.

Given:
1. Calendar event attendees (email addresses and optional display names)
2. List of Beeper business contacts (names)

Your task: Match attendees to business contacts based on name/email similarity.

Matching rules:
- Email "stefanie.fan@company.com" likely matches contact "Stefanie Fan"
- Email "john.doe@example.com" likely matches "John Doe"
- Match first names, last names, or full names
- Consider email username parts (before @) for matching
- Be flexible with name variations (e.g., "Mike" vs "Michael")

Return ONLY raw JSON (no markdown):
{
  "matches": [
    {
      "threadId": "string (from provided contacts list)",
      "contactName": "string (the contact name)",
      "matchedEmail": "string (which attendee email matched)",
      "matchedDisplayName": "string or null (attendee display name if available)",
      "confidence": 0.0-1.0,
      "reason": "brief explanation"
    }
  ]
}

Confidence levels:
- 0.9+: Exact or near-exact name match
- 0.7-0.9: Strong partial match (first+last name parts match)
- 0.5-0.7: Moderate match (first name only)
- Below 0.5: Don't include

Only return high-confidence matches. Maximum 5 matches.`;

// Result type
type CalendarBeeperMatchResult = {
  success: boolean;
  error?: string;
  suggestions?: Array<{
    threadId: Id<"lifeos_beeperThreads">;
    threadName: string;
    matchedEmail: string;
    matchedDisplayName?: string;
    confidence: number;
    reason: string;
  }>;
};

/**
 * Use AI to suggest Beeper contacts based on calendar event attendees
 */
export const suggestBeeperFromCalendar = action({
  args: {
    meetingId: v.id("life_granolaMeetings"),
    calendarEventId: v.id("lifeos_calendarEvents"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    suggestions: v.optional(
      v.array(
        v.object({
          threadId: v.id("lifeos_beeperThreads"),
          threadName: v.string(),
          matchedEmail: v.string(),
          matchedDisplayName: v.optional(v.string()),
          confidence: v.number(),
          reason: v.string(),
        })
      )
    ),
  }),
  handler: async (ctx, args): Promise<CalendarBeeperMatchResult> => {
    try {
      // Get the meeting to get userId
      const meeting = await ctx.runQuery(
        internal.lifeos.granola_linking.getMeetingInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetings"> | null;

      if (!meeting) {
        return { success: false, error: "Meeting not found" };
      }

      const userId = meeting.userId;

      // Get calendar event
      const event = await ctx.runQuery(
        internal.lifeos.granola_linking.getCalendarEventInternal,
        { eventId: args.calendarEventId }
      ) as Doc<"lifeos_calendarEvents"> | null;

      if (!event) {
        return { success: false, error: "Calendar event not found" };
      }

      // Get external attendees (not self)
      const attendees = (event.attendees || []).filter(a => !a.self);
      if (attendees.length === 0) {
        return { success: true, suggestions: [] };
      }

      // Get business threads
      const businessThreads = await ctx.runQuery(
        internal.lifeos.granola_linking.getBusinessThreadsInternal,
        { userId }
      ) as Doc<"lifeos_beeperThreads">[];

      if (businessThreads.length === 0) {
        return { success: true, suggestions: [] };
      }

      // Get existing links to filter out
      const existingLinks = await ctx.runQuery(
        internal.lifeos.granola_linking.getExistingLinksInternal,
        { meetingId: args.meetingId }
      ) as Doc<"life_granolaMeetingLinks">[];
      const linkedThreadIds = new Set(existingLinks.map(l => l.beeperThreadId.toString()));

      // Filter out already linked contacts
      const availableContacts = businessThreads
        .filter(t => !linkedThreadIds.has(t._id.toString()))
        .map(t => ({
          threadId: t._id.toString(),
          name: t.threadName,
        }));

      if (availableContacts.length === 0) {
        return { success: true, suggestions: [] };
      }

      // Build prompt for AI
      const attendeesList = attendees.map(a => ({
        email: a.email,
        displayName: a.displayName || null,
      }));

      const prompt = `CALENDAR ATTENDEES:
${JSON.stringify(attendeesList, null, 2)}

BEEPER BUSINESS CONTACTS:
${JSON.stringify(availableContacts, null, 2)}

Match the calendar attendees to the business contacts.`;

      console.log(`[Calendar→Beeper] Matching ${attendees.length} attendees to ${availableContacts.length} contacts`);

      // Call AI
      const model = "google/gemini-2.5-flash";
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model,
          messages: [
            { role: "system", content: CALENDAR_BEEPER_MATCHING_PROMPT },
            { role: "user", content: prompt },
          ],
          responseFormat: "json",
          temperature: 0.2,
          maxTokens: 1024,
        },
        context: {
          feature: "calendar_beeper_matching",
          description: "Match calendar attendees to Beeper contacts",
        },
      });

      // Parse response
      let parsed: { matches: Array<{ threadId: string; contactName: string; matchedEmail: string; matchedDisplayName?: string; confidence: number; reason: string }> };
      try {
        let jsonContent = result.content.trim();
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }
        parsed = JSON.parse(jsonContent);
      } catch {
        console.error(`[Calendar→Beeper] Failed to parse AI response:`, result.content.substring(0, 200));
        return { success: false, error: "Failed to parse AI response" };
      }

      // Validate and transform results
      const suggestions = (parsed.matches || [])
        .filter(m => m.confidence >= 0.5)
        .map(m => {
          // Find the actual thread to get the proper ID type
          const thread = businessThreads.find(t => t._id.toString() === m.threadId);
          if (!thread) return null;
          return {
            threadId: thread._id,
            threadName: thread.threadName,
            matchedEmail: m.matchedEmail || "",
            // Convert null to undefined for Convex validator
            matchedDisplayName: m.matchedDisplayName || undefined,
            confidence: m.confidence,
            reason: m.reason || "Matched by AI",
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      console.log(`[Calendar→Beeper] Found ${suggestions.length} matches`);

      return { success: true, suggestions };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Calendar→Beeper] Error:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Get calendar event (internal)
 */
export const getCalendarEventInternal = internalQuery({
  args: {
    eventId: v.id("lifeos_calendarEvents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});
