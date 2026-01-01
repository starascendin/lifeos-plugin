import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
} from "../_generated/server";
import { requireUser } from "../_lib/auth";
import { Doc } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";

// ==================== QUERIES ====================

/**
 * Get daily summary for a specific date
 */
export const getDailySummary = query({
  args: {
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summary = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .first();

    return summary;
  },
});

// ==================== MUTATIONS ====================

/**
 * Save or update daily summary (public mutation)
 */
export const saveDailySummary = mutation({
  args: {
    date: v.string(), // YYYY-MM-DD format
    aiSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    // Check if summary exists
    const existing = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiSummary: args.aiSummary,
        generatedAt: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_dailySummaries", {
        userId: user._id,
        date: args.date,
        aiSummary: args.aiSummary,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Internal mutation for saving daily summary (used by actions)
 */
export const internalSaveDailySummary = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    aiSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiSummary: args.aiSummary,
        generatedAt: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_dailySummaries", {
        userId: args.userId,
        date: args.date,
        aiSummary: args.aiSummary,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// ==================== ACTIONS ====================

/**
 * Generate AI summary for a specific date
 * This action fetches data and generates a summary using OpenAI
 */
export const generateDailySummary = action({
  args: {
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args): Promise<{ summary: string }> => {
    // Get today's habits
    const habits: Doc<"lifeos_habits">[] = await ctx.runQuery(
      api.lifeos.habits.getHabitsForDate,
      { date: args.date }
    );

    // Get habit check-ins for today
    const checkIns: Record<string, Doc<"lifeos_habitCheckIns">> =
      await ctx.runQuery(api.lifeos.habits_checkins.getCheckInsForDateRange, {
        startDate: args.date,
        endDate: args.date,
      });

    // Get today's tasks
    const tasks: Doc<"lifeos_pmIssues">[] = await ctx.runQuery(
      api.lifeos.pm_issues.getTasksForDate,
      { date: args.date }
    );

    // Get top priority tasks
    const topPriorityTasks: Doc<"lifeos_pmIssues">[] = await ctx.runQuery(
      api.lifeos.pm_issues.getTopPriorityTasks,
      {}
    );

    // Calculate habit completion
    const checkInValues = Object.values(checkIns || {});
    const habitCompletionCount: number = checkInValues.filter(
      (c) => c.completed
    ).length;
    const totalHabits: number = habits?.length || 0;

    // Calculate task stats
    const totalTasks: number = tasks?.length || 0;
    const topPriorityCount: number = topPriorityTasks?.length || 0;

    // Generate summary prompt
    const prompt = buildSummaryPrompt({
      date: args.date,
      habits: habits || [],
      habitCompletionCount,
      totalHabits,
      tasks: tasks || [],
      topPriorityTasks: topPriorityTasks || [],
      totalTasks,
      topPriorityCount,
    });

    // Get the user ID for saving - we need to get it from the auth context
    // For actions, we need to pass it through or get it another way
    // We'll use the public mutation which handles auth
    const saveViaPublicMutation = async (summary: string) => {
      await ctx.runMutation(api.lifeos.agenda.saveDailySummary, {
        date: args.date,
        aiSummary: summary,
      });
    };

    // Call OpenAI API
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // Return a simple summary if no API key
      const fallbackSummary = `Today (${args.date}): ${totalHabits} habits scheduled (${habitCompletionCount} completed), ${totalTasks} tasks due, ${topPriorityCount} top priorities.`;

      await saveViaPublicMutation(fallbackSummary);
      return { summary: fallbackSummary };
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful personal assistant that provides concise daily summaries. Keep responses brief (2-3 sentences) and actionable.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiSummary: string =
        data.choices?.[0]?.message?.content ||
        "Unable to generate summary at this time.";

      // Save the summary
      await saveViaPublicMutation(aiSummary);
      return { summary: aiSummary };
    } catch (error) {
      console.error("Error generating AI summary:", error);
      const fallbackSummary = `Today: ${totalHabits} habits scheduled, ${totalTasks} tasks due, ${topPriorityCount} top priorities.`;

      await saveViaPublicMutation(fallbackSummary);
      return { summary: fallbackSummary };
    }
  },
});

// ==================== HELPERS ====================

interface SummaryContext {
  date: string;
  habits: Doc<"lifeos_habits">[];
  habitCompletionCount: number;
  totalHabits: number;
  tasks: Doc<"lifeos_pmIssues">[];
  topPriorityTasks: Doc<"lifeos_pmIssues">[];
  totalTasks: number;
  topPriorityCount: number;
}

function buildSummaryPrompt(context: SummaryContext): string {
  const {
    date,
    habits,
    habitCompletionCount,
    totalHabits,
    topPriorityTasks,
    totalTasks,
    topPriorityCount,
  } = context;

  const habitNames = habits.map((h) => h.name).join(", ");
  const topTaskNames = topPriorityTasks
    .slice(0, 3)
    .map((t) => t.title)
    .join(", ");
  const taskNames = context.tasks
    .slice(0, 5)
    .map((t) => t.title)
    .join(", ");

  return `Please provide a brief, encouraging daily summary for ${date}:

HABITS (${habitCompletionCount}/${totalHabits} completed):
${habitNames || "None scheduled"}

TOP PRIORITIES (${topPriorityCount}):
${topTaskNames || "None set"}

TASKS DUE TODAY (${totalTasks}):
${taskNames || "None due"}

Provide a 2-3 sentence summary that:
1. Acknowledges progress on habits
2. Highlights key priorities for the day
3. Gives an encouraging, actionable recommendation`;
}
