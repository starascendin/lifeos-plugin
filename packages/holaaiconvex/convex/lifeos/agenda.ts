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
import { DEFAULT_DAILY_PROMPT } from "./agenda_constants";

// Re-export for convenience
export { DEFAULT_DAILY_PROMPT } from "./agenda_constants";

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

export const getDailyNotesForRange = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summaries = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q
          .eq("userId", user._id)
          .gte("date", args.startDate)
          .lte("date", args.endDate)
      )
      .collect();

    return summaries
      .filter((s) => s.userNote && s.userNote.trim().length > 0)
      .map((s) => ({ date: s.date, userNote: s.userNote! }));
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
 * Save or update user's daily note (persisted per day)
 */
export const saveDailyUserNote = mutation({
  args: {
    date: v.string(), // YYYY-MM-DD format
    userNote: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userNote: args.userNote,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_dailySummaries", {
        userId: user._id,
        date: args.date,
        userNote: args.userNote,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Update custom prompt for daily summary (persistent per-day)
 */
export const updateDailyPrompt = mutation({
  args: {
    date: v.string(), // YYYY-MM-DD format
    customPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customPrompt: args.customPrompt,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("lifeos_dailySummaries", {
        userId: user._id,
        date: args.date,
        customPrompt: args.customPrompt,
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
 * Generate AI summary for a specific date using centralized AI service
 * Supports multiple models: openai/gpt-4o-mini, google/gemini-2.5-flash-lite, xai/grok-4.1-fast-non-reasoning
 */
export const generateDailySummary = action({
  args: {
    date: v.string(), // YYYY-MM-DD format
    model: v.optional(v.string()), // Model to use (defaults to openai/gpt-4o-mini)
    userNote: v.optional(v.string()), // User's daily note to include in prompt
  },
  handler: async (ctx, args): Promise<GenerateSummaryResult> => {
    const selectedModel = args.model || "openai/gpt-4o-mini";

    // Fetch all daily data in parallel
    const [
      existingSummary,
      habits,
      checkIns,
      tasks,
      topPriorityTasks,
      overdueTasks,
      memos,
      calendarEvents,
    ] = await Promise.all([
      ctx.runQuery(api.lifeos.agenda.getDailySummary, { date: args.date }),
      ctx.runQuery(api.lifeos.habits.getHabitsForDate, { date: args.date }),
      ctx.runQuery(api.lifeos.habits_checkins.getCheckInsForDateRange, {
        startDate: args.date,
        endDate: args.date,
      }),
      ctx.runQuery(api.lifeos.pm_issues.getTasksForDate, {
        date: args.date,
        includeCompleted: true,
      }),
      ctx.runQuery(api.lifeos.pm_issues.getTopPriorityTasks, {}),
      ctx.runQuery(api.lifeos.pm_issues.getOverdueTasks, { date: args.date }),
      ctx.runQuery(api.lifeos.voicememo.getMemosForDateRange, {
        startDate: args.date,
        endDate: args.date,
      }),
      ctx.runQuery(api.lifeos.calendar.getEventsForDate, { date: args.date }),
    ]);

    // Calculate habit completion
    const checkInValues = Object.values(checkIns || {});
    const habitCompletionCount: number = checkInValues.filter(
      (c: Doc<"lifeos_habitCheckIns">) => c.completed
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
      overdueTasks: overdueTasks || [],
      memos: ((memos || []) as Doc<"life_voiceMemos">[]).map((m: Doc<"life_voiceMemos">) => ({
        name: m.name,
        transcript: m.transcript,
      })),
      calendarEvents: (calendarEvents || []) as Doc<"lifeos_calendarEvents">[],
      userNote: args.userNote,
      customPrompt: existingSummary?.customPrompt ?? undefined,
    });

    // Save helper function
    const saveSummary = async (
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

    try {
      // Use centralized AI service (handles credit check, AI call, and deduction)
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model: selectedModel,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful personal assistant that provides concise daily summaries. Keep responses brief (3-5 sentences) and actionable. Reference specific tasks, events, and notes when available.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          maxTokens: 400,
          temperature: 0.7,
        },
        context: {
          feature: "agenda_daily_summary",
          description: `Daily summary for ${args.date}`,
        },
      });

      const usage: UsageInfo = {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      };

      // Save the summary with model and usage info
      await saveSummary(result.content, selectedModel, usage);

      return { summary: result.content, model: selectedModel, usage };
    } catch (error) {
      console.error("Error generating AI summary:", error);
      const fallbackSummary = `Today: ${totalHabits} habits scheduled, ${totalTasks} tasks due, ${topPriorityCount} top priorities.`;

      await saveSummary(fallbackSummary, "fallback", null);
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
  overdueTasks: Doc<"lifeos_pmIssues">[];
  memos: Array<{ name: string; transcript: string | undefined }>;
  calendarEvents: Doc<"lifeos_calendarEvents">[];
  userNote?: string;
  customPrompt?: string;
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
    overdueTasks,
    memos,
    calendarEvents,
    userNote,
    customPrompt,
  } = context;

  const template = customPrompt || DEFAULT_DAILY_PROMPT;

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

  // Format overdue tasks
  const overdueFormatted = overdueTasks
    .slice(0, 5)
    .map(formatTaskWithDescription)
    .join("\n");

  // Format voice memos
  const memosFormatted = memos
    .filter((m) => m.transcript)
    .slice(0, 5)
    .map((m) => {
      const transcript = m.transcript!.length > 200
        ? m.transcript!.slice(0, 200) + "..."
        : m.transcript!;
      return `- ${m.name}: ${transcript}`;
    })
    .join("\n");

  // Format calendar events
  const eventsFormatted = calendarEvents
    .slice(0, 10)
    .map((e) => {
      const start = new Date(e.startTime);
      const timeStr = start.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `- ${timeStr}: ${e.title}`;
    })
    .join("\n");

  // Build user note section
  const userNoteSection = userNote
    ? `USER'S NOTE FOR TODAY:\n${userNote}`
    : "";

  return template
    .replace("{date}", date)
    .replace("{userNote}", userNoteSection)
    .replace("{habitCompletionCount}", String(habitCompletionCount))
    .replace("{totalHabits}", String(totalHabits))
    .replace("{habitNames}", habitNames || "None scheduled")
    .replace("{topPriorityCount}", String(topPriorityCount))
    .replace("{topTasksFormatted}", topTasksFormatted || "None set")
    .replace("{totalTasks}", String(totalTasks))
    .replace("{otherTasksFormatted}", otherTasksFormatted || "None due")
    .replace("{overdueCount}", String(overdueTasks.length))
    .replace("{overdueTasksFormatted}", overdueFormatted || "None")
    .replace("{memosFormatted}", memosFormatted || "None recorded")
    .replace("{eventsFormatted}", eventsFormatted || "No events");
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

/**
 * Save or update user's weekly note
 */
export const saveWeeklyUserNote = mutation({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    userNote: v.string(),
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
        userNote: args.userNote,
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
        userNote: args.userNote,
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
 * Generate AI summary for a specific week using centralized AI service
 */
export const generateWeeklySummary = action({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD format (Monday)
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateSummaryResult> => {
    const selectedModel = args.model || "openai/gpt-4o-mini";

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
    const allTasks = Object.values(tasksByDay).flat() as Doc<"lifeos_pmIssues">[];
    const completedTasks = allTasks.filter((t: Doc<"lifeos_pmIssues">) => t.status === "done");
    const remainingTasks = allTasks.filter((t: Doc<"lifeos_pmIssues">) => t.status !== "done");

    // Build prompt context
    const promptContext: WeeklySummaryContext = {
      weekStartDate: args.weekStartDate,
      weekEndDate,
      dayScores: fieldValues.valuesByDate,
      weeklyAverage: null,
      completedTasks,
      remainingTasks,
      memos: (memos as Doc<"life_voiceMemos">[]).map((m: Doc<"life_voiceMemos">) => ({
        name: m.name,
        transcript: m.transcript,
        clientCreatedAt: m.clientCreatedAt,
      })),
      customPrompt: existingSummary?.customPrompt ?? undefined,
    };

    const prompt = buildWeeklySummaryPrompt(promptContext);

    // Save helper function
    const saveSummary = async (
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

    try {
      // Use centralized AI service (handles credit check, AI call, and deduction)
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
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
          maxTokens: 500,
          temperature: 0.7,
        },
        context: {
          feature: "agenda_weekly_summary",
          description: `Weekly summary for ${args.weekStartDate}`,
        },
      });

      const usage: UsageInfo = {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      };

      await saveSummary(result.content, selectedModel, usage);

      return { summary: result.content, model: selectedModel, usage };
    } catch (error) {
      console.error("Error generating weekly AI summary:", error);
      const fallbackSummary = `Week ${args.weekStartDate} to ${weekEndDate}: ${completedTasks.length} tasks completed, ${remainingTasks.length} remaining.`;
      await saveSummary(fallbackSummary, "fallback", null);
      return { summary: fallbackSummary, model: "fallback", usage: null };
    }
  },
});

// ==================== MONTHLY SUMMARY QUERIES ====================

/**
 * Get monthly summary for a specific month
 */
export const getMonthlySummary = query({
  args: {
    monthStartDate: v.string(), // YYYY-MM-DD format (1st of month)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summary = await ctx.db
      .query("lifeos_monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", user._id).eq("monthStartDate", args.monthStartDate)
      )
      .first();

    return summary;
  },
});

// ==================== MONTHLY SUMMARY MUTATIONS ====================

/**
 * Save or update monthly summary
 */
export const saveMonthlySummary = mutation({
  args: {
    monthStartDate: v.string(), // YYYY-MM-DD (1st of month)
    monthEndDate: v.string(), // YYYY-MM-DD (last day of month)
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
      .query("lifeos_monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", user._id).eq("monthStartDate", args.monthStartDate)
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
      return await ctx.db.insert("lifeos_monthlySummaries", {
        userId: user._id,
        monthStartDate: args.monthStartDate,
        monthEndDate: args.monthEndDate,
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
 * Update custom prompt for monthly summary (persistent per-month)
 */
export const updateMonthlyPrompt = mutation({
  args: {
    monthStartDate: v.string(), // YYYY-MM-DD (1st of month)
    customPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", user._id).eq("monthStartDate", args.monthStartDate)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customPrompt: args.customPrompt,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Calculate month end date
      const startDate = new Date(args.monthStartDate);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const monthEndStr = formatDateString(monthEnd);

      return await ctx.db.insert("lifeos_monthlySummaries", {
        userId: user._id,
        monthStartDate: args.monthStartDate,
        monthEndDate: monthEndStr,
        customPrompt: args.customPrompt,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// ==================== DELETE MUTATIONS ====================

/**
 * Delete a daily summary
 */
export const deleteDailySummary = mutation({
  args: {
    date: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("lifeos_dailySummaries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date)
      )
      .first();

    if (!existing) {
      return { success: false, error: "Daily summary not found" };
    }

    await ctx.db.delete(existing._id);
    return { success: true, deletedId: existing._id };
  },
});

/**
 * Delete a weekly summary
 */
export const deleteWeeklySummary = mutation({
  args: {
    weekStartDate: v.string(), // YYYY-MM-DD format (Monday)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("lifeos_weeklySummaries")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", user._id).eq("weekStartDate", args.weekStartDate)
      )
      .first();

    if (!existing) {
      return { success: false, error: "Weekly summary not found" };
    }

    await ctx.db.delete(existing._id);
    return { success: true, deletedId: existing._id };
  },
});

/**
 * Delete a monthly summary
 */
export const deleteMonthlySummary = mutation({
  args: {
    monthStartDate: v.string(), // YYYY-MM-DD format (1st of month)
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("lifeos_monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", user._id).eq("monthStartDate", args.monthStartDate)
      )
      .first();

    if (!existing) {
      return { success: false, error: "Monthly summary not found" };
    }

    await ctx.db.delete(existing._id);
    return { success: true, deletedId: existing._id };
  },
});

// ==================== MONTHLY SUMMARY ACTION ====================

// Default monthly prompt template
const DEFAULT_MONTHLY_PROMPT = `Provide a monthly summary for {monthStartDate} to {monthEndDate}:

WEEKLY SUMMARIES:
{weeklySummaries}

TASKS COMPLETED THIS MONTH: {completedCount}
{completedTasksList}

TASKS REMAINING: {remainingCount}
{remainingTasksList}

VOICE MEMO HIGHLIGHTS:
{memoTranscripts}

Please provide:
1. Month overview and accomplishments (2-3 sentences)
2. Key patterns and trends observed
3. Focus areas and recommendations for next month`;

interface MonthlySummaryContext {
  monthStartDate: string;
  monthEndDate: string;
  weeklySummaries: string[];
  completedTasks: Doc<"lifeos_pmIssues">[];
  remainingTasks: Doc<"lifeos_pmIssues">[];
  memos: Array<{
    name: string;
    transcript: string | undefined;
    clientCreatedAt: number;
  }>;
  customPrompt?: string;
}

function buildMonthlySummaryPrompt(context: MonthlySummaryContext): string {
  const template = context.customPrompt || DEFAULT_MONTHLY_PROMPT;

  // Format weekly summaries
  const weeklySummariesStr = context.weeklySummaries.length > 0
    ? context.weeklySummaries.join("\n\n")
    : "No weekly summaries available";

  // Format tasks
  const completedTasksList = context.completedTasks
    .slice(0, 15)
    .map((t) => `- ${t.title}`)
    .join("\n");
  const remainingTasksList = context.remainingTasks
    .slice(0, 15)
    .map((t) => `- ${t.title}`)
    .join("\n");

  // Format memos
  const memoTranscripts = context.memos
    .filter((m) => m.transcript)
    .slice(0, 10)
    .map((m) => {
      const date = new Date(m.clientCreatedAt);
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const transcript =
        m.transcript!.length > 150
          ? m.transcript!.slice(0, 150) + "..."
          : m.transcript!;
      return `[${dateStr}] ${m.name}: ${transcript}`;
    })
    .join("\n");

  return template
    .replace("{monthStartDate}", context.monthStartDate)
    .replace("{monthEndDate}", context.monthEndDate)
    .replace("{weeklySummaries}", weeklySummariesStr)
    .replace("{completedCount}", String(context.completedTasks.length))
    .replace("{completedTasksList}", completedTasksList || "None")
    .replace("{remainingCount}", String(context.remainingTasks.length))
    .replace("{remainingTasksList}", remainingTasksList || "None")
    .replace("{memoTranscripts}", memoTranscripts || "None recorded");
}

/**
 * Generate AI summary for a specific month using centralized AI service
 */
export const generateMonthlySummary = action({
  args: {
    monthStartDate: v.string(), // YYYY-MM-DD format (1st of month)
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateSummaryResult> => {
    const selectedModel = args.model || "openai/gpt-4o-mini";

    // Calculate month end date
    const startDate = new Date(args.monthStartDate);
    const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const monthEndDate = formatDateString(monthEnd);

    // Fetch all month data in parallel
    const [tasksByDay, memos, existingSummary] = await Promise.all([
      ctx.runQuery(api.lifeos.pm_issues.getTasksForDateRange, {
        startDate: args.monthStartDate,
        endDate: monthEndDate,
        includeCompleted: true,
      }),
      ctx.runQuery(api.lifeos.voicememo.getMemosForDateRange, {
        startDate: args.monthStartDate,
        endDate: monthEndDate,
      }),
      ctx.runQuery(api.lifeos.agenda.getMonthlySummary, {
        monthStartDate: args.monthStartDate,
      }),
    ]);

    // Get weekly summaries for this month
    const weeklySummaries: string[] = [];
    const currentWeekStart = new Date(args.monthStartDate);
    // Adjust to Monday
    const dayOfWeek = currentWeekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(currentWeekStart.getDate() + diff);

    while (currentWeekStart <= monthEnd) {
      const weekStartStr = formatDateString(currentWeekStart);
      const weekSummary = await ctx.runQuery(api.lifeos.agenda.getWeeklySummary, {
        weekStartDate: weekStartStr,
      });
      if (weekSummary?.aiSummary) {
        weeklySummaries.push(`Week of ${weekStartStr}: ${weekSummary.aiSummary}`);
      }
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    // Separate completed and remaining tasks
    const allTasks = Object.values(tasksByDay).flat() as Doc<"lifeos_pmIssues">[];
    const completedTasks = allTasks.filter((t: Doc<"lifeos_pmIssues">) => t.status === "done");
    const remainingTasks = allTasks.filter((t: Doc<"lifeos_pmIssues">) => t.status !== "done");

    // Build prompt context
    const promptContext: MonthlySummaryContext = {
      monthStartDate: args.monthStartDate,
      monthEndDate,
      weeklySummaries,
      completedTasks,
      remainingTasks,
      memos: (memos as Doc<"life_voiceMemos">[]).map((m: Doc<"life_voiceMemos">) => ({
        name: m.name,
        transcript: m.transcript,
        clientCreatedAt: m.clientCreatedAt,
      })),
      customPrompt: existingSummary?.customPrompt ?? undefined,
    };

    const prompt = buildMonthlySummaryPrompt(promptContext);

    // Save helper function
    const saveSummary = async (
      summary: string,
      model: string,
      usage: UsageInfo | null
    ) => {
      await ctx.runMutation(api.lifeos.agenda.saveMonthlySummary, {
        monthStartDate: args.monthStartDate,
        monthEndDate,
        aiSummary: summary,
        model,
        usage: usage ?? undefined,
      });
    };

    try {
      // Use centralized AI service (handles credit check, AI call, and deduction)
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model: selectedModel,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful personal assistant that provides insightful monthly summaries. Keep responses comprehensive, highlighting patterns, accomplishments, and actionable insights for the upcoming month.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          maxTokens: 800,
          temperature: 0.7,
        },
        context: {
          feature: "agenda_monthly_summary",
          description: `Monthly summary for ${args.monthStartDate}`,
        },
      });

      const usage: UsageInfo = {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      };

      await saveSummary(result.content, selectedModel, usage);

      return { summary: result.content, model: selectedModel, usage };
    } catch (error) {
      console.error("Error generating monthly AI summary:", error);
      const fallbackSummary = `Month ${args.monthStartDate} to ${monthEndDate}: ${completedTasks.length} tasks completed, ${remainingTasks.length} remaining.`;
      await saveSummary(fallbackSummary, "fallback", null);
      return { summary: fallbackSummary, model: "fallback", usage: null };
    }
  },
});
