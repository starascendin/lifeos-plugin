"use node";

/**
 * Coaching Session Runner
 *
 * Handles auto-summarization of coaching sessions when they end.
 * Uses AI to extract summaries, insights, and action items from the conversation.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

/**
 * Auto-summarize a coaching session when it ends.
 * Reads the conversation history, generates a structured summary,
 * extracts action items, and saves everything.
 */
export const summarizeSession = internalAction({
  args: {
    sessionId: v.id("lifeos_coachingSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    // Load the session
    const session = await ctx.runQuery(
      internal.lifeos.coaching.getSessionInternal,
      { sessionId },
    );
    if (!session) throw new Error("Session not found");

    // Load the coach profile
    const profile = await ctx.runQuery(
      internal.lifeos.coaching.getCoachProfileInternal,
      { profileId: session.coachProfileId },
    );
    if (!profile) throw new Error("Coach profile not found");

    // Get conversation messages
    if (!session.threadId) {
      await ctx.runMutation(internal.lifeos.coaching.updateSessionInternal, {
        sessionId,
        status: "completed",
        endedAt: Date.now(),
      });
      return;
    }

    const messagesResult = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: session.threadId,
        order: "asc",
        statuses: ["success"],
        paginationOpts: { numItems: 200, cursor: null },
      },
    );

    // Build transcript
    const transcript: string[] = [];
    for (const msg of messagesResult.page) {
      const message = msg.message;
      if (!message) continue;

      let text = "";
      if (typeof message.content === "string") {
        text = message.content;
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === "text" && "text" in part) {
            text += part.text;
          }
        }
      }

      if (text.trim()) {
        const role = message.role === "user" ? "User" : "Coach";
        transcript.push(`${role}: ${text}`);
      }
    }

    // If conversation is too short, skip summarization
    if (transcript.length < 4) {
      await ctx.runMutation(internal.lifeos.coaching.updateSessionInternal, {
        sessionId,
        status: "completed",
        endedAt: Date.now(),
        summary: "Session was too short for summarization.",
      });
      return;
    }

    // Generate structured summary using AI
    try {
      const result = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        prompt: `You are analyzing a coaching session transcript between a user and their AI coach "${profile.name}".
The coach's focus areas are: ${profile.focusAreas.join(", ")}.

TRANSCRIPT:
${transcript.join("\n")}

Generate a structured JSON response with these fields:
{
  "title": "A concise title for this session (max 60 chars)",
  "summary": "A 2-4 sentence summary of what was discussed and decided",
  "keyInsights": ["Array of 2-5 key insights or realizations from the session"],
  "actionItems": [
    {
      "text": "Specific action item text",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Focus on:
- What the user committed to doing
- Key decisions made
- Breakthroughs or important realizations
- Specific next steps with clear actionable text

Return ONLY valid JSON, no markdown formatting.`,
      });

      // Parse the AI response
      let parsed: {
        title?: string;
        summary?: string;
        keyInsights?: string[];
        actionItems?: Array<{ text: string; priority?: string }>;
      } = {};

      try {
        // Try to extract JSON from the response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // If parsing fails, use the raw text as summary
        parsed = { summary: result.text };
      }

      // Update session with summary
      await ctx.runMutation(internal.lifeos.coaching.updateSessionInternal, {
        sessionId,
        status: "completed",
        endedAt: Date.now(),
        title: parsed.title || session.title,
        summary: parsed.summary || "Session completed.",
        keyInsights: parsed.keyInsights,
      });

      // Create action items
      if (parsed.actionItems && parsed.actionItems.length > 0) {
        for (const item of parsed.actionItems) {
          const priority =
            item.priority === "high" ||
            item.priority === "medium" ||
            item.priority === "low"
              ? item.priority
              : "medium";

          await ctx.runMutation(
            internal.lifeos.coaching.createActionItemInternal,
            {
              userId: session.userId,
              sessionId,
              coachProfileId: session.coachProfileId,
              text: item.text,
              priority: priority as "high" | "medium" | "low",
            },
          );
        }
      }

      // Also save as an AI convo summary for cross-system searchability
      await ctx.runMutation(
        internal.lifeos.tool_call.createAiConvoSummaryInternal,
        {
          userId: session.userId as string,
          title: parsed.title || `${profile.name} Session`,
          summary: parsed.summary || "Coaching session completed.",
          keyInsights: parsed.keyInsights,
          actionItems: parsed.actionItems?.map((a) => a.text),
          tags: ["coaching", profile.name.toLowerCase().replace(/\s+/g, "-")],
          summaryType: "coaching_session",
          conversationContext: `Coaching session with ${profile.name}`,
          rawConversation: JSON.stringify(
            transcript.map((t) => {
              const [role, ...text] = t.split(": ");
              return { role: role.toLowerCase(), text: text.join(": ") };
            }),
          ),
        },
      );
    } catch (error) {
      console.error("Failed to summarize session:", error);
      // Still complete the session even if summarization fails
      await ctx.runMutation(internal.lifeos.coaching.updateSessionInternal, {
        sessionId,
        status: "completed",
        endedAt: Date.now(),
        summary: "Session completed (summarization failed).",
      });
    }
  },
});
