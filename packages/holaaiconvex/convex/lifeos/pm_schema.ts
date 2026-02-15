import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Project Management Tables
 *
 * Linear-like project management for LifeOS.
 * All table names are prefixed with `lifeos_pm` to avoid conflicts.
 */

// ==================== SHARED VALIDATORS ====================

export const priorityValidator = v.union(
  v.literal("urgent"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none"),
);

export const issueStatusValidator = v.union(
  v.literal("backlog"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("in_review"),
  v.literal("done"),
  v.literal("cancelled"),
);

export const projectStatusValidator = v.union(
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const projectHealthValidator = v.union(
  v.literal("on_track"),
  v.literal("at_risk"),
  v.literal("off_track"),
);

export const cycleStatusValidator = v.union(
  v.literal("upcoming"),
  v.literal("active"),
  v.literal("completed"),
);

export const cycleDurationValidator = v.union(
  v.literal("1_week"),
  v.literal("2_weeks"),
);

export const cycleStartDayValidator = v.union(
  v.literal("sunday"),
  v.literal("monday"),
);

export const cycleSettingsValidator = v.object({
  duration: cycleDurationValidator,
  startDay: cycleStartDayValidator,
  defaultCyclesToCreate: v.number(),
  // Timezone offset in minutes from UTC (e.g., -420 for UTC-7/Denver)
  // Used to calculate cycle start dates in user's local timezone
  timezoneOffsetMinutes: v.optional(v.number()),
  // When true, incomplete issues (not done/cancelled) are automatically
  // moved to the next cycle when the current cycle ends
  autoRolloverIncompleteIssues: v.optional(v.boolean()),
});

export const cycleRetrospectiveValidator = v.object({
  whatWentWell: v.optional(v.string()),
  whatCouldImprove: v.optional(v.string()),
  actionItems: v.optional(v.array(v.string())),
});

export const pomodoroStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("abandoned"),
);

export const clientStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);

export const phaseStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed"),
);

// ==================== TABLE DEFINITIONS ====================

export const pmTables = {
  // ==================== PROJECTS ====================
  lifeos_pmProjects: defineTable({
    userId: v.id("users"),
    // Link to yearly initiative (optional)
    initiativeId: v.optional(v.id("lifeos_yearlyInitiatives")),
    // Link to client (optional - for consulting/freelance projects)
    clientId: v.optional(v.id("lifeos_pmClients")),
    // Project identification
    key: v.string(), // Short key like "PROJ", "LIFE" (auto-generated from name)
    name: v.string(),
    description: v.optional(v.string()),
    // Visual
    icon: v.optional(v.string()), // Emoji or icon name
    color: v.optional(v.string()), // Hex color
    // Status and tracking
    status: projectStatusValidator,
    health: projectHealthValidator,
    priority: priorityValidator,
    // Dates
    startDate: v.optional(v.number()), // Unix timestamp
    targetDate: v.optional(v.number()), // Target completion date
    completedAt: v.optional(v.number()),
    // Computed (denormalized for performance)
    issueCount: v.number(),
    completedIssueCount: v.number(),
    // Next issue number (for auto-incrementing)
    nextIssueNumber: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_archived", ["userId", "archivedAt"])
    .index("by_key", ["userId", "key"])
    .index("by_initiative", ["initiativeId"])
    .index("by_client", ["clientId"]),

  // ==================== CYCLES/SPRINTS ====================
  lifeos_pmCycles: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("lifeos_pmProjects")), // Optional: cycles can be project-wide or standalone
    // Cycle identification
    number: v.number(), // Cycle number (1, 2, 3...)
    name: v.optional(v.string()), // Optional custom name
    description: v.optional(v.string()),
    // Date range
    startDate: v.number(),
    endDate: v.number(),
    // Status
    status: cycleStatusValidator,
    // Goals for the cycle
    goals: v.optional(v.array(v.string())),
    // Retrospective (filled at cycle end)
    retrospective: v.optional(cycleRetrospectiveValidator),
    // Computed (denormalized)
    issueCount: v.number(),
    completedIssueCount: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_dates", ["userId", "startDate", "endDate"]),

  // ==================== ISSUES/TASKS ====================
  lifeos_pmIssues: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("lifeos_pmProjects")),
    cycleId: v.optional(v.id("lifeos_pmCycles")),
    phaseId: v.optional(v.id("lifeos_pmPhases")), // Link to project phase
    initiativeId: v.optional(v.id("lifeos_yearlyInitiatives")), // Direct link to yearly initiative
    parentId: v.optional(v.id("lifeos_pmIssues")), // For sub-issues
    // Issue identification
    identifier: v.string(), // e.g., "PROJ-123" (project key + number)
    number: v.number(), // Sequential number within project
    // Content
    title: v.string(),
    description: v.optional(v.string()), // Markdown supported
    // Status and priority
    status: issueStatusValidator,
    priority: priorityValidator,
    // Estimation
    estimate: v.optional(v.number()), // Story points or hours
    // Labels (stored as array of label IDs)
    labelIds: v.array(v.id("lifeos_pmLabels")),
    // Daily Agenda - Top priority flag for "Top 3" tasks
    isTopPriority: v.optional(v.boolean()),
    // Coder Agent delegation
    delegatedAt: v.optional(v.number()), // Timestamp when delegated to Coder agent
    // Dates
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    // Ordering for manual sorting within columns
    sortOrder: v.number(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_cycle", ["cycleId"])
    .index("by_phase", ["phaseId"])
    .index("by_parent", ["parentId"])
    .index("by_status", ["userId", "status"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_identifier", ["userId", "identifier"])
    .index("by_project_number", ["projectId", "number"])
    .index("by_sort_order", ["userId", "status", "sortOrder"])
    .index("by_user_due_date", ["userId", "dueDate"])
    .index("by_user_top_priority", ["userId", "isTopPriority"])
    .index("by_initiative", ["initiativeId"]),

  // ==================== LABELS ====================
  lifeos_pmLabels: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("lifeos_pmProjects")), // null = workspace-wide label
    name: v.string(),
    color: v.string(), // Hex color
    description: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_name", ["userId", "name"]),

  // ==================== POMODORO SESSIONS ====================
  lifeos_pmPomodoroSessions: defineTable({
    userId: v.id("users"),
    issueId: v.optional(v.id("lifeos_pmIssues")), // Optional: can have "free" pomodoros
    habitId: v.optional(v.id("lifeos_habits")), // Optional: pomodoro linked to a habit
    projectId: v.optional(v.id("lifeos_pmProjects")), // Denormalized for easier queries
    // Session configuration
    durationMinutes: v.number(), // Default 25
    breakMinutes: v.number(), // Default 5
    // Session state
    status: pomodoroStatusValidator,
    // Timing
    startedAt: v.number(), // When the pomodoro started
    pausedAt: v.optional(v.number()), // When paused (if paused)
    completedAt: v.optional(v.number()), // When completed/abandoned
    totalPausedMs: v.number(), // Total time spent paused
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_issue", ["issueId"])
    .index("by_habit", ["habitId"])
    .index("by_user_date", ["userId", "startedAt"])
    .index("by_project", ["projectId"]),

  // ==================== POMODORO DAILY STATS ====================
  lifeos_pmPomodoroDailyStats: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    // Counts
    completedCount: v.number(),
    abandonedCount: v.number(),
    // Time tracking (in milliseconds)
    totalFocusTimeMs: v.number(),
    // Breakdown by issue (top issues worked on)
    issueBreakdown: v.array(
      v.object({
        issueId: v.id("lifeos_pmIssues"),
        issueIdentifier: v.string(), // Denormalized for display
        issueTitle: v.string(),
        completedCount: v.number(),
        totalFocusTimeMs: v.number(),
      }),
    ),
    // Breakdown by habit (habits worked on with pomodoro)
    habitBreakdown: v.optional(
      v.array(
        v.object({
          habitId: v.id("lifeos_habits"),
          habitName: v.string(), // Denormalized for display
          habitIcon: v.optional(v.string()),
          completedCount: v.number(),
          totalFocusTimeMs: v.number(),
        }),
      ),
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== USER SETTINGS ====================
  lifeos_pmUserSettings: defineTable({
    userId: v.id("users"),
    // User's timezone (IANA format, e.g., "America/Denver")
    // Used for calendar display, AI agent, voice memos, etc.
    timezone: v.optional(v.string()),
    // Cycle settings (global)
    cycleSettings: v.optional(cycleSettingsValidator),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ==================== CYCLE SNAPSHOTS (for burnup charts) ====================
  lifeos_pmCycleSnapshots: defineTable({
    userId: v.id("users"),
    cycleId: v.id("lifeos_pmCycles"),
    // Date in YYYY-MM-DD format
    date: v.string(),
    // Issue counts at this point in time
    scopeCount: v.number(), // Total issues in cycle
    startedCount: v.number(), // in_progress + in_review
    completedCount: v.number(), // done
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_cycle", ["cycleId"])
    .index("by_cycle_date", ["cycleId", "date"])
    .index("by_user", ["userId"]),

  // ==================== DAILY SUMMARIES (for Agenda Daily View) ====================
  lifeos_dailySummaries: defineTable({
    userId: v.id("users"),
    date: v.string(), // YYYY-MM-DD format
    // User's daily note (persisted per day)
    userNote: v.optional(v.string()),
    // Custom prompt template override (persistent per-day)
    customPrompt: v.optional(v.string()),
    // AI-generated summary
    aiSummary: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
    // Model and usage info
    model: v.optional(v.string()), // e.g., "openai/gpt-4o-mini"
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      }),
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  // ==================== WEEKLY SUMMARIES (for Agenda Weekly View) ====================
  lifeos_weeklySummaries: defineTable({
    userId: v.id("users"),
    weekStartDate: v.string(), // YYYY-MM-DD format (Monday of the week)
    weekEndDate: v.string(), // YYYY-MM-DD format (Sunday of the week)
    // User's weekly note (free-form text)
    userNote: v.optional(v.string()),
    // Custom prompt for weekly summary (user editable, persistent)
    customPrompt: v.optional(v.string()),
    // User's personal notes for the week
    userNote: v.optional(v.string()),
    // AI-generated summary
    aiSummary: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
    // Model and usage info
    model: v.optional(v.string()), // e.g., "openai/gpt-4o-mini"
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      }),
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_week", ["userId", "weekStartDate"]),

  // ==================== MONTHLY SUMMARIES (for Agenda Monthly View) ====================
  lifeos_monthlySummaries: defineTable({
    userId: v.id("users"),
    monthStartDate: v.string(), // YYYY-MM-DD format (1st of the month)
    monthEndDate: v.string(), // YYYY-MM-DD format (last day of the month)
    // Custom prompt for monthly summary (user editable, persistent)
    customPrompt: v.optional(v.string()),
    // AI-generated summary
    aiSummary: v.optional(v.string()),
    generatedAt: v.optional(v.number()),
    // Model and usage info
    model: v.optional(v.string()), // e.g., "openai/gpt-4o-mini"
    usage: v.optional(
      v.object({
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
      }),
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_month", ["userId", "monthStartDate"]),

  // ==================== CODER INTEGRATION ====================
  // Per-user Coder.com API integration for delegating issues to AI agents
  lifeos_coderIntegration: defineTable({
    userId: v.id("users"),
    coderUrl: v.string(), // e.g., "https://coder-production-coder2.rocketjump.tech"
    coderApiToken: v.string(), // User's personal API token
    coderUsername: v.optional(v.string()), // For display purposes
    connectedAt: v.number(), // When the user connected
    lastUsedAt: v.optional(v.number()), // Last time delegation was used
  }).index("by_user", ["userId"]),

  // ==================== CLIENTS ====================
  // For consulting/freelance client management
  lifeos_pmClients: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()), // Markdown supported
    status: clientStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // ==================== PROJECT PHASES ====================
  // For tracking project phases/milestones
  lifeos_pmPhases: defineTable({
    userId: v.id("users"),
    projectId: v.id("lifeos_pmProjects"),
    name: v.string(),
    description: v.optional(v.string()), // Markdown supported
    order: v.number(), // For ordering phases
    status: phaseStatusValidator,
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "order"]),

  // ==================== PROJECT NOTES ====================
  // Markdown notes attached to clients, projects, or phases
  lifeos_pmNotes: defineTable({
    userId: v.id("users"),
    clientId: v.optional(v.id("lifeos_pmClients")),
    projectId: v.optional(v.id("lifeos_pmProjects")),
    phaseId: v.optional(v.id("lifeos_pmPhases")),
    title: v.string(),
    content: v.string(), // Markdown content
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_client", ["clientId"])
    .index("by_project", ["projectId"])
    .index("by_phase", ["phaseId"]),
};
