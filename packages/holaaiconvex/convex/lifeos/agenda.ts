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
import type { MeteringFeature } from "../_lib/credits";

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

// Supported models for AI Gateway
export const SUPPORTED_MODELS = [
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash-lite",
  "xai/grok-4.1-fast-non-reasoning",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

// Usage info type
interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Save or update daily summary (public mutation)
 */
export const saveDailySummary = mutation({
  args: {
    date: v.string(), // YYYY-MM-DD format
    aiSummary: v.string(),
    model: v.optional(v.string()),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      })
    ),
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
        model: args.model,
        usage: args.usage,
        generatedAt: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_dailySummaries", {
        userId: user._id,
        date: args.date,
        aiSummary: args.aiSummary,
        model: args.model,
        usage: args.usage,
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
    model: v.optional(v.string()),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      })
    ),
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
        model: args.model,
        usage: args.usage,
        generatedAt: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_dailySummaries", {
        userId: args.userId,
        date: args.date,
        aiSummary: args.aiSummary,
        model: args.model,
        usage: args.usage,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// ==================== ACTIONS ====================

// Response type for generateDailySummary
interface GenerateSummaryResult {
  summary: string;
  model: string;
  usage: UsageInfo | null;
}

/**
 * Generate AI summary for a specific date using Vercel AI Gateway
 * Supports multiple models: openai/gpt-4o-mini, google/gemini-2.5-flash-lite, xai/grok-4.1-fast-non-reasoning
 */
export const generateDailySummary = action({
  args: {
    date: v.string(), // YYYY-MM-DD format
    model: v.optional(v.string()), // Model to use (defaults to openai/gpt-4o-mini)
  },
  handler: async (ctx, args): Promise<GenerateSummaryResult> => {
    const selectedModel = args.model || "openai/gpt-4o-mini";
    const feature: MeteringFeature = "agenda_daily_summary";

    // Check credits before making AI call
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

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

    // Save helper function
    const saveViaPublicMutation = async (
      summary: string,
      model: string,
      usage: UsageInfo | null
    ) => {
      await ctx.runMutation(api.lifeos.agenda.saveDailySummary, {
        date: args.date,
        aiSummary: summary,
        model,
        usage: usage ?? undefined,
      });
    };

    // Call Vercel AI Gateway
    const aiGatewayApiKey = process.env.AI_GATEWAY_API_KEY;
    if (!aiGatewayApiKey) {
      // Return a simple summary if no API key
      const fallbackSummary = `Today (${args.date}): ${totalHabits} habits scheduled (${habitCompletionCount} completed), ${totalTasks} tasks due, ${topPriorityCount} top priorities.`;

      await saveViaPublicMutation(fallbackSummary, "fallback", null);
      return { summary: fallbackSummary, model: "fallback", usage: null };
    }

    try {
      const response = await fetch(
        "https://gateway.ai.vercel.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiGatewayApiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
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
        const errorText = await response.text();
        throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const aiSummary: string =
        data.choices?.[0]?.message?.content ||
        "Unable to generate summary at this time.";

      // Extract usage info
      const usage: UsageInfo | null = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : null;

      // Save the summary with model and usage info
      await saveViaPublicMutation(aiSummary, selectedModel, usage);

      // Deduct credits if not unlimited access and we have usage data
      if (!creditCheck.hasUnlimitedAccess && usage) {
        await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
          userId: creditCheck.userId,
          feature,
          tokenUsage: usage,
          model: selectedModel,
          description: `Daily summary for ${args.date}`,
        });
      }

      return { summary: aiSummary, model: selectedModel, usage };
    } catch (error) {
      console.error("Error generating AI summary:", error);
      const fallbackSummary = `Today: ${totalHabits} habits scheduled, ${totalTasks} tasks due, ${topPriorityCount} top priorities.`;

      await saveViaPublicMutation(fallbackSummary, "fallback", null);
      return { summary: fallbackSummary, model: "fallback", usage: null };
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

function formatTaskWithDescription(task: Doc<"lifeos_pmIssues">): string {
  const desc = task.description?.trim();
  if (desc) {
    // Truncate long descriptions to keep prompt size manageable
    const truncatedDesc = desc.length > 150 ? desc.slice(0, 150) + "..." : desc;
    return `- ${task.title}: ${truncatedDesc}`;
  }
  return `- ${task.title}`;
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

  // Format top priority tasks with descriptions
  const topTasksFormatted = topPriorityTasks
    .slice(0, 3)
    .map(formatTaskWithDescription)
    .join("\n");

  // Format other tasks with descriptions
  const otherTasksFormatted = context.tasks
    .slice(0, 5)
    .map(formatTaskWithDescription)
    .join("\n");

  return `Please provide a brief, encouraging daily summary for ${date}:

HABITS (${habitCompletionCount}/${totalHabits} completed):
${habitNames || "None scheduled"}

TOP PRIORITIES (${topPriorityCount}):
${topTasksFormatted || "None set"}

TASKS DUE TODAY (${totalTasks}):
${otherTasksFormatted || "None due"}

Provide a 2-3 sentence summary that:
1. Acknowledges progress on habits
2. Highlights key priorities for the day
3. Gives an encouraging, actionable recommendation`;
}

// ==================== WEEKLY SUMMARY QUERIES ====================

/**
 * Get weekly summary for a specific week
 */
export const getWeeklySummary = query({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD format (Monday)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summary = await ctx.db
      .query("lifeos_weeklySummaries")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", user._id).eq("weekStartDate", args.weekStartDate)
      )
      .first();

    return summary;
  },
});

// ==================== WEEKLY SUMMARY MUTATIONS ====================

/**
 * Save or update weekly summary
 */
export const saveWeeklySummary = mutation({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    weekEndDate: v.string(), // YYYY-MM-DD (Sunday)
    aiSummary: v.string(),
    model: v.optional(v.string()),
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_weeklySummaries")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", user._id).eq("weekStartDate", args.weekStartDate)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiSummary: args.aiSummary,
        model: args.model,
        usage: args.usage,
        generatedAt: now,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_weeklySummaries", {
        userId: user._id,
        weekStartDate: args.weekStartDate,
        weekEndDate: args.weekEndDate,
        aiSummary: args.aiSummary,
        model: args.model,
        usage: args.usage,
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update custom prompt for weekly summary (persistent per-week)
 */
export const updateWeeklyPrompt = mutation({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    customPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_weeklySummaries")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", user._id).eq("weekStartDate", args.weekStartDate)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customPrompt: args.customPrompt,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Calculate week end date
      const weekEnd = new Date(args.weekStartDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = formatDateString(weekEnd);

      return await ctx.db.insert("lifeos_weeklySummaries", {
        userId: user._id,
        weekStartDate: args.weekStartDate,
        weekEndDate: weekEndStr,
        customPrompt: args.customPrompt,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// ==================== WEEKLY SUMMARY ACTION ====================

// Default weekly prompt template
const DEFAULT_WEEKLY_PROMPT = `Provide a weekly summary for {weekStartDate} to {weekEndDate}:

END DAY SCORES: {dayScores}
WEEKLY AVERAGE: {average}

TASKS COMPLETED: {completedCount}
{completedTasksList}

TASKS REMAINING: {remainingCount}
{remainingTasksList}

VOICE MEMO HIGHLIGHTS:
{memoTranscripts}

Please provide:
1. Week performance summary (2-3 sentences)
2. Key accomplishments
3. Focus recommendations for next week`;

interface WeeklySummaryContext {
  weekStartDate: string;
  weekEndDate: string;
  dayScores: Record<string, number | null>;
  weeklyAverage: number | null;
  completedTasks: Doc<"lifeos_pmIssues">[];
  remainingTasks: Doc<"lifeos_pmIssues">[];
  memos: Array<{
    name: string;
    transcript: string | undefined;
    clientCreatedAt: number;
  }>;
  customPrompt?: string;
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeeklySummaryPrompt(context: WeeklySummaryContext): string {
  const template = context.customPrompt || DEFAULT_WEEKLY_PROMPT;

  // Format day scores
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sortedDates = Object.keys(context.dayScores).sort();
  const dayScoresStr = sortedDates
    .map((date, i) => {
      const score = context.dayScores[date];
      return `${dayNames[i]}: ${score ?? "-"}`;
    })
    .join(", ");

  // Calculate average
  const scores = Object.values(context.dayScores).filter(
    (s): s is number => s !== null
  );
  const average =
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : "N/A";

  // Format tasks
  const completedTasksList = context.completedTasks
    .slice(0, 10)
    .map((t) => `- ${t.title}`)
    .join("\n");
  const remainingTasksList = context.remainingTasks
    .slice(0, 10)
    .map((t) => `- ${t.title}`)
    .join("\n");

  // Format memos
  const memoTranscripts = context.memos
    .filter((m) => m.transcript)
    .slice(0, 5)
    .map((m) => {
      const date = new Date(m.clientCreatedAt);
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const transcript =
        m.transcript!.length > 200
          ? m.transcript!.slice(0, 200) + "..."
          : m.transcript!;
      return `[${dateStr}] ${m.name}: ${transcript}`;
    })
    .join("\n");

  return template
    .replace("{weekStartDate}", context.weekStartDate)
    .replace("{weekEndDate}", context.weekEndDate)
    .replace("{dayScores}", dayScoresStr)
    .replace("{average}", average)
    .replace("{completedCount}", String(context.completedTasks.length))
    .replace("{completedTasksList}", completedTasksList || "None")
    .replace("{remainingCount}", String(context.remainingTasks.length))
    .replace("{remainingTasksList}", remainingTasksList || "None")
    .replace("{memoTranscripts}", memoTranscripts || "None recorded");
}

/**
 * Generate AI summary for a specific week using Vercel AI Gateway
 */
export const generateWeeklySummary = action({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD format (Monday)
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateSummaryResult> => {
    const selectedModel = args.model || "openai/gpt-4o-mini";
    const feature: MeteringFeature = "agenda_weekly_summary";

    // Check credits before making AI call
    const creditCheck = await ctx.runQuery(
      internal.common.credits.checkCreditsForAction
    );
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.reason || "OUT_OF_CREDITS");
    }

    // Calculate week end date
    const weekEnd = new Date(args.weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndDate = formatDateString(weekEnd);

    // Fetch all week data in parallel
    const [tasksByDay, fieldValues, memos, existingSummary] = await Promise.all(
      [
        ctx.runQuery(api.lifeos.pm_issues.getTasksForDateRange, {
          startDate: args.weekStartDate,
          endDate: weekEndDate,
          includeCompleted: true,
        }),
        ctx.runQuery(api.lifeos.daily_fields.getFieldValuesForDateRange, {
          startDate: args.weekStartDate,
          endDate: weekEndDate,
        }),
        ctx.runQuery(api.lifeos.voicememo.getMemosForDateRange, {
          startDate: args.weekStartDate,
          endDate: weekEndDate,
        }),
        ctx.runQuery(api.lifeos.agenda.getWeeklySummary, {
          weekStartDate: args.weekStartDate,
        }),
      ]
    );

    // Separate completed and remaining tasks
    const allTasks = Object.values(tasksByDay).flat();
    const completedTasks = allTasks.filter((t) => t.status === "done");
    const remainingTasks = allTasks.filter((t) => t.status !== "done");

    // Build prompt context
    const promptContext: WeeklySummaryContext = {
      weekStartDate: args.weekStartDate,
      weekEndDate,
      dayScores: fieldValues.valuesByDate,
      weeklyAverage: null,
      completedTasks,
      remainingTasks,
      memos: memos.map((m) => ({
        name: m.name,
        transcript: m.transcript,
        clientCreatedAt: m.clientCreatedAt,
      })),
      customPrompt: existingSummary?.customPrompt ?? undefined,
    };

    const prompt = buildWeeklySummaryPrompt(promptContext);

    // Save helper function
    const saveViaPublicMutation = async (
      summary: string,
      model: string,
      usage: UsageInfo | null
    ) => {
      await ctx.runMutation(api.lifeos.agenda.saveWeeklySummary, {
        weekStartDate: args.weekStartDate,
        weekEndDate,
        aiSummary: summary,
        model,
        usage: usage ?? undefined,
      });
    };

    // Call Vercel AI Gateway
    const aiGatewayApiKey = process.env.AI_GATEWAY_API_KEY;
    if (!aiGatewayApiKey) {
      const fallbackSummary = `Week ${args.weekStartDate} to ${weekEndDate}: ${completedTasks.length} tasks completed, ${remainingTasks.length} remaining, ${memos.length} voice memos recorded.`;
      await saveViaPublicMutation(fallbackSummary, "fallback", null);
      return { summary: fallbackSummary, model: "fallback", usage: null };
    }

    try {
      const response = await fetch(
        "https://gateway.ai.vercel.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiGatewayApiKey}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful personal assistant that provides insightful weekly summaries. Keep responses concise but comprehensive, highlighting patterns and actionable insights.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const aiSummary: string =
        data.choices?.[0]?.message?.content ||
        "Unable to generate weekly summary at this time.";

      const usage: UsageInfo | null = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : null;

      await saveViaPublicMutation(aiSummary, selectedModel, usage);

      // Deduct credits if not unlimited access and we have usage data
      if (!creditCheck.hasUnlimitedAccess && usage) {
        await ctx.runMutation(internal.common.credits.deductCreditsInternal, {
          userId: creditCheck.userId,
          feature,
          tokenUsage: usage,
          model: selectedModel,
          description: `Weekly summary for ${args.weekStartDate}`,
        });
      }

      return { summary: aiSummary, model: selectedModel, usage };
    } catch (error) {
      console.error("Error generating weekly AI summary:", error);
      const fallbackSummary = `Week ${args.weekStartDate} to ${weekEndDate}: ${completedTasks.length} tasks completed, ${remainingTasks.length} remaining.`;
      await saveViaPublicMutation(fallbackSummary, "fallback", null);
      return { summary: fallbackSummary, model: "fallback", usage: null };
    }
  },
});
