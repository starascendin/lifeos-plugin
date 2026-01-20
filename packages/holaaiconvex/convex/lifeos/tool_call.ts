/**
 * Tool Call API - Internal queries for external tool integrations
 * Used by LiveKit voice agents and other external services via HTTP endpoint
 *
 * Available tools:
 * - get_todays_tasks: Get today's tasks (due today + top priority)
 * - get_projects: Get user's projects with summary stats
 * - get_tasks: Get tasks with optional filters
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";

// ==================== TOOL DEFINITIONS ====================

/**
 * Tool registry - defines available tools and their parameters
 * Used for validation and documentation
 */
export const TOOL_DEFINITIONS = {
  get_todays_tasks: {
    description: "Get today's tasks including top priority items",
    params: {},
  },
  get_projects: {
    description: "Get user's projects with issue counts and completion stats",
    params: {
      status:
        "optional - filter by status (planned, in_progress, paused, completed, cancelled)",
      includeArchived: "optional - include archived projects (default false)",
    },
  },
  get_tasks: {
    description: "Get tasks with optional filters",
    params: {
      projectId: "optional - filter by project ID",
      status:
        "optional - filter by status (backlog, todo, in_progress, in_review, done, cancelled)",
      priority:
        "optional - filter by priority (urgent, high, medium, low, none)",
      limit: "optional - max results (default 50, max 100)",
    },
  },
  // Notes/Journal tools
  search_notes: {
    description: "Search voice notes/memos by content",
    params: {
      query: "required - search terms to find in notes",
      limit: "optional - max results (default 10, max 50)",
    },
  },
  get_recent_notes: {
    description: "Get recent voice notes with transcripts",
    params: {
      limit: "optional - number of notes to return (default 5, max 20)",
    },
  },
  create_quick_note: {
    description: "Create a quick text note (captured via voice)",
    params: {
      content: "required - the note content",
      tags: "optional - array of tags for categorization",
    },
  },
  add_tags_to_note: {
    description: "Add tags to an existing note",
    params: {
      noteId: "required - the ID of the note",
      tags: "required - array of tags to add",
    },
  },
  // Agenda tools
  get_daily_agenda: {
    description:
      "Get today's full agenda: tasks, calendar events, and voice note count",
    params: {
      date: "optional - specific date in ISO format (default: today based on localTime)",
      localTime:
        "optional - user's local time in ISO format for accurate date calculation",
    },
  },
  get_weekly_agenda: {
    description:
      "Get weekly agenda: tasks and events for the next 7 days, plus AI weekly summary",
    params: {
      startDate:
        "optional - start date in ISO format (default: today based on localTime)",
      localTime:
        "optional - user's local time in ISO format for accurate date calculation",
    },
  },
  // Issue Management tools
  create_issue: {
    description:
      "Create a new task/issue with optional project, priority, and due date",
    params: {
      title: "required - the task title",
      description: "optional - detailed description",
      projectIdOrKey: "optional - project ID or key (e.g., ACME)",
      priority: "optional - urgent, high, medium, low, none",
      dueDate: "optional - ISO date string",
      cycleId: "optional - assign to specific cycle",
    },
  },
  mark_issue_complete: {
    description: "Mark a task as complete by ID or identifier (e.g., PROJ-123)",
    params: {
      issueIdOrIdentifier: "required - issue ID or identifier like PROJ-123",
    },
  },
  // Cycle Management tools
  get_current_cycle: {
    description:
      "Get the currently active cycle with progress stats and top issues",
    params: {},
  },
  assign_issue_to_cycle: {
    description: "Assign a task to a cycle (defaults to current active cycle)",
    params: {
      issueIdOrIdentifier: "required - issue ID or identifier like PROJ-123",
      cycleId: "optional - cycle ID (defaults to active cycle)",
    },
  },
  // FRM (Friend Relationship Management) tools
  get_people: {
    description: "Get all contacts/people with optional filters",
    params: {
      relationshipType:
        "optional - filter by type (family, friend, colleague, acquaintance, mentor, other)",
      includeArchived: "optional - include archived people (default false)",
      limit: "optional - max results (default 100)",
    },
  },
  get_person: {
    description: "Get a single person's details with their AI-generated profile",
    params: {
      personId: "required - the person's ID",
    },
  },
  search_people: {
    description: "Search contacts by name using full-text search",
    params: {
      query: "required - search terms to find in names",
      limit: "optional - max results (default 20)",
    },
  },
  get_memos_for_person: {
    description: "Get all voice memos linked to a specific person",
    params: {
      personId: "required - the person's ID",
      limit: "optional - max results (default 50)",
    },
  },
  get_person_timeline: {
    description: "Get interaction timeline for a person or all people",
    params: {
      personId: "optional - filter to specific person (omit for all)",
      limit: "optional - max results (default 50)",
    },
  },
  create_person: {
    description: "Create a new contact/person",
    params: {
      name: "required - the person's name",
      nickname: "optional - nickname or alias",
      relationshipType:
        "optional - family, friend, colleague, acquaintance, mentor, other",
      avatarEmoji: "optional - emoji to represent this person",
      notes: "optional - user notes about this person",
    },
  },
  update_person: {
    description: "Update a contact's details",
    params: {
      personId: "required - the person's ID",
      name: "optional - updated name",
      nickname: "optional - updated nickname",
      relationshipType: "optional - updated relationship type",
      email: "optional - email address",
      phone: "optional - phone number",
      notes: "optional - updated notes",
    },
  },
  link_memo_to_person: {
    description: "Link a voice memo to a person",
    params: {
      personId: "required - the person's ID",
      voiceMemoId: "required - the voice memo's ID",
      context: "optional - context for the link (e.g., 'Phone call', 'Coffee meetup')",
    },
  },
  // Client Management tools
  get_clients: {
    description: "Get all clients with optional status filter",
    params: {
      status: "optional - filter by status (active, archived)",
    },
  },
  get_client: {
    description: "Get a single client's details with project stats",
    params: {
      clientId: "required - the client's ID",
    },
  },
  get_projects_for_client: {
    description: "Get all projects associated with a client",
    params: {
      clientId: "required - the client's ID",
    },
  },
  create_client: {
    description: "Create a new client",
    params: {
      name: "required - the client's name",
      description: "optional - description of the client",
    },
  },
  update_client: {
    description: "Update a client's details",
    params: {
      clientId: "required - the client's ID",
      name: "optional - updated name",
      description: "optional - updated description",
      status: "optional - active or archived",
    },
  },
} as const;

export type ToolName = keyof typeof TOOL_DEFINITIONS;

// Priority order for sorting
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/**
 * Convert HTML (from Tiptap editor) to plain text for AI agents
 * Strips tags, converts common elements to readable text
 */
function htmlToPlainText(html: string | undefined): string | undefined {
  if (!html) return undefined;

  return html
    // Convert line breaks and block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    // Convert list items to bullets
    .replace(/<li[^>]*>/gi, '• ')
    // Convert task list items
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, '☑ ')
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, '☐ ')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ==================== TOOL 1: GET TODAY'S TASKS ====================

/**
 * Get today's tasks for a user
 * Returns tasks due today + top priority tasks, deduplicated
 * Optimized for voice responses (simplified format)
 */
export const getTodaysTasksInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Get today's date range
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter: tasks due today OR marked as top priority
    // Exclude done/cancelled
    const relevantTasks = allIssues.filter((issue) => {
      if (issue.status === "done" || issue.status === "cancelled") return false;

      const isDueToday =
        issue.dueDate &&
        issue.dueDate >= startOfDay &&
        issue.dueDate <= endOfDay;
      const isTopPriority = issue.isTopPriority === true;

      return isDueToday || isTopPriority;
    });

    // Sort by: top priority first, then by priority level, then by sortOrder
    const sortedTasks = relevantTasks.sort((a, b) => {
      // Top priority items first
      if (a.isTopPriority && !b.isTopPriority) return -1;
      if (!a.isTopPriority && b.isTopPriority) return 1;

      // Then by priority level
      const priorityDiff =
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by sort order
      return a.sortOrder - b.sortOrder;
    });

    // Build simplified response for voice
    const tasks = sortedTasks.map((task) => ({
      identifier: task.identifier,
      title: task.title,
      status: task.status,
      priority: task.priority,
      isTopPriority: task.isTopPriority || false,
      dueToday: task.dueDate
        ? task.dueDate >= startOfDay && task.dueDate <= endOfDay
        : false,
    }));

    // Build summary
    const statusCounts: Record<string, number> = {};
    for (const task of tasks) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }

    return {
      tasks,
      summary: {
        total: tasks.length,
        topPriority: tasks.filter((t) => t.isTopPriority).length,
        dueToday: tasks.filter((t) => t.dueToday).length,
        byStatus: statusCounts,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 2: GET PROJECTS ====================

/**
 * Get user's projects with stats
 * Returns projects with issue counts and completion percentage
 */
export const getProjectsInternal = internalQuery({
  args: {
    userId: v.string(),
    status: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const includeArchived = args.includeArchived ?? false;

    // Get all projects for the user
    let projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter by archived status
    if (!includeArchived) {
      projects = projects.filter((p) => !p.archivedAt);
    }

    // Filter by status if provided
    if (args.status) {
      projects = projects.filter((p) => p.status === args.status);
    }

    // Build response with stats
    const projectsWithStats = projects.map((project) => {
      const issueCount = project.issueCount ?? 0;
      const completedIssueCount = project.completedIssueCount ?? 0;
      const completionPercentage =
        issueCount > 0
          ? Math.round((completedIssueCount / issueCount) * 100)
          : 0;

      return {
        id: project._id,
        key: project.key,
        name: project.name,
        description: htmlToPlainText(project.description),
        status: project.status,
        health: project.health,
        priority: project.priority,
        issueCount,
        completedIssueCount,
        completionPercentage,
      };
    });

    // Build summary
    const statusCounts: Record<string, number> = {};
    for (const project of projectsWithStats) {
      statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
    }

    return {
      projects: projectsWithStats,
      summary: {
        total: projectsWithStats.length,
        byStatus: statusCounts,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 3: GET TASKS ====================

/**
 * Get tasks with optional filters
 * Returns tasks with project info and pagination
 */
export const getTasksInternal = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = Math.min(args.limit ?? 50, 100); // Cap at 100

    // Type guard for status
    type IssueStatus =
      | "backlog"
      | "todo"
      | "in_progress"
      | "in_review"
      | "done"
      | "cancelled";
    const validStatuses: IssueStatus[] = [
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "cancelled",
    ];
    const status =
      args.status && validStatuses.includes(args.status as IssueStatus)
        ? (args.status as IssueStatus)
        : undefined;

    // Get issues based on filters
    let issues;

    if (args.projectId) {
      const projectId = args.projectId as Id<"lifeos_pmProjects">;
      if (status) {
        issues = await ctx.db
          .query("lifeos_pmIssues")
          .withIndex("by_project_status", (q) =>
            q.eq("projectId", projectId).eq("status", status),
          )
          .collect();
      } else {
        issues = await ctx.db
          .query("lifeos_pmIssues")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();
      }
      // Filter by user ownership
      issues = issues.filter((i) => i.userId === userId);
    } else if (status) {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_status", (q) =>
          q.eq("userId", userId).eq("status", status),
        )
        .collect();
    } else {
      issues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Filter by priority if specified
    if (args.priority) {
      issues = issues.filter((i) => i.priority === args.priority);
    }

    // Sort by priority then sortOrder
    issues.sort((a, b) => {
      const priorityDiff =
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
      if (priorityDiff !== 0) return priorityDiff;
      return a.sortOrder - b.sortOrder;
    });

    // Check if there are more results
    const total = issues.length;
    const hasMore = total > limit;

    // Apply limit
    const limitedIssues = issues.slice(0, limit);

    // Get project info for each issue (filter out undefined projectIds)
    const projectIds = [
      ...new Set(
        limitedIssues
          .map((i) => i.projectId)
          .filter((id): id is Id<"lifeos_pmProjects"> => id !== undefined),
      ),
    ];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(
      projects.filter(Boolean).map((p) => [p!._id, p!]),
    );

    // Build response
    const tasks = limitedIssues.map((issue) => {
      const project = issue.projectId
        ? projectMap.get(issue.projectId)
        : undefined;
      return {
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
        description: htmlToPlainText(issue.description),
        status: issue.status,
        priority: issue.priority,
        projectId: issue.projectId,
        projectKey: project?.key ?? "",
        projectName: project?.name ?? "",
        isTopPriority: issue.isTopPriority || false,
        dueDate: issue.dueDate,
        estimate: issue.estimate,
      };
    });

    return {
      tasks,
      total,
      hasMore,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 4: SEARCH NOTES ====================

/**
 * Search voice memos/notes by transcript content
 * Uses Convex full-text search
 */
export const searchNotesInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = Math.min(args.limit ?? 10, 50);

    // Use full-text search on transcript field
    const results = await ctx.db
      .query("life_voiceMemos")
      .withSearchIndex("search_transcript", (q) =>
        q.search("transcript", args.query).eq("userId", userId),
      )
      .take(limit);

    // Build response
    const notes = results.map((memo) => ({
      id: memo._id,
      name: memo.name,
      transcript: memo.transcript,
      tags: memo.tags || [],
      duration: memo.duration,
      language: memo.language,
      createdAt: new Date(memo.clientCreatedAt).toISOString(),
    }));

    return {
      notes,
      query: args.query,
      count: notes.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 5: GET RECENT NOTES ====================

/**
 * Get recent voice memos/notes
 * Returns memos with transcripts, sorted by creation date
 */
export const getRecentNotesInternal = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = Math.min(args.limit ?? 5, 20);

    // Get recent memos with completed transcripts
    const memos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) => q.eq(q.field("transcriptionStatus"), "completed"))
      .take(limit);

    // Build response
    const notes = memos.map((memo) => ({
      id: memo._id,
      name: memo.name,
      transcript: memo.transcript,
      tags: memo.tags || [],
      duration: memo.duration,
      language: memo.language,
      createdAt: new Date(memo.clientCreatedAt).toISOString(),
    }));

    return {
      notes,
      count: notes.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 6: CREATE QUICK NOTE ====================

/**
 * Create a text-only voice memo (no audio)
 * Used by voice agent to capture spoken notes
 */
export const createQuickNoteInternal = internalMutation({
  args: {
    userId: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const now = Date.now();

    // Generate a unique local ID
    const localId = `voice-note-${now}-${Math.random().toString(36).slice(2, 9)}`;

    // Create memo with transcript (no audio file)
    const memoId = await ctx.db.insert("life_voiceMemos", {
      userId,
      localId,
      name: `Voice Note ${new Date().toLocaleDateString()}`,
      duration: 0, // No audio
      transcriptionStatus: "completed",
      transcript: args.content,
      tags: args.tags,
      clientCreatedAt: now,
      clientUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      noteId: memoId,
      message: "Note created successfully",
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 7: ADD TAGS TO NOTE ====================

/**
 * Add tags to an existing voice memo/note
 */
export const addTagsToNoteInternal = internalMutation({
  args: {
    userId: v.string(),
    noteId: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const noteId = args.noteId as Id<"life_voiceMemos">;

    // Get the memo
    const memo = await ctx.db.get(noteId);
    if (!memo) {
      return {
        success: false,
        error: "Note not found",
        generatedAt: new Date().toISOString(),
      };
    }

    // Verify ownership
    if (memo.userId !== userId) {
      return {
        success: false,
        error: "Access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Merge existing tags with new ones (deduplicated)
    const existingTags = memo.tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...args.tags]));

    // Update memo
    await ctx.db.patch(noteId, {
      tags: mergedTags,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      noteId,
      tags: mergedTags,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 8: GET DAILY AGENDA ====================

/**
 * Get daily agenda for a user
 * Returns tasks due today + calendar events + top priority tasks + voice note count
 * Uses localTime to determine "today" accurately for user's timezone
 * Optimized for voice responses
 */
export const getDailyAgendaInternal = internalQuery({
  args: {
    userId: v.string(),
    date: v.optional(v.string()),
    localTime: v.optional(v.string()), // User's local time in ISO format
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Parse date or use localTime or server time
    // Priority: explicit date > localTime > server time
    let targetDate: Date;
    if (args.date) {
      targetDate = new Date(args.date);
    } else if (args.localTime) {
      targetDate = new Date(args.localTime);
    } else {
      targetDate = new Date();
    }

    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    ).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter: tasks due on target date OR marked as top priority
    // Exclude done/cancelled
    const relevantTasks = allIssues.filter((issue) => {
      if (issue.status === "done" || issue.status === "cancelled") return false;

      const isDueOnDate =
        issue.dueDate &&
        issue.dueDate >= startOfDay &&
        issue.dueDate <= endOfDay;
      const isTopPriority = issue.isTopPriority === true;

      return isDueOnDate || isTopPriority;
    });

    // Sort by: top priority first, then by priority level, then by sortOrder
    const sortedTasks = relevantTasks.sort((a, b) => {
      if (a.isTopPriority && !b.isTopPriority) return -1;
      if (!a.isTopPriority && b.isTopPriority) return 1;

      const priorityDiff =
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
      if (priorityDiff !== 0) return priorityDiff;

      return a.sortOrder - b.sortOrder;
    });

    // Get project info for tasks
    const projectIds = [
      ...new Set(
        sortedTasks
          .map((t) => t.projectId)
          .filter((id): id is Id<"lifeos_pmProjects"> => id !== undefined),
      ),
    ];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(
      projects.filter(Boolean).map((p) => [p!._id, p!]),
    );

    // Build simplified task response for voice
    const tasks = sortedTasks.map((task) => {
      const project = task.projectId
        ? projectMap.get(task.projectId)
        : undefined;
      return {
        identifier: task.identifier,
        title: task.title,
        status: task.status,
        priority: task.priority,
        isTopPriority: task.isTopPriority || false,
        dueOnDate: task.dueDate
          ? task.dueDate >= startOfDay && task.dueDate <= endOfDay
          : false,
        projectName: project?.name ?? "",
      };
    });

    // Get calendar events for this date
    const allEvents = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_start_time", (q) => q.eq("userId", userId))
      .collect();

    // Filter events that overlap with the target date and are not cancelled
    const dayEvents = allEvents.filter((event) => {
      if (event.status === "cancelled") return false;
      // Event overlaps if it starts before end of day and ends after start of day
      return event.startTime <= endOfDay && event.endTime >= startOfDay;
    });

    // Sort events by start time
    dayEvents.sort((a, b) => a.startTime - b.startTime);

    // Build simplified event response for voice
    const events = dayEvents.map((event) => ({
      title: event.title,
      startTime: new Date(event.startTime).toISOString(),
      endTime: new Date(event.endTime).toISOString(),
      isAllDay: event.isAllDay || false,
      location: event.location ?? null,
    }));

    // Count voice notes created on this date
    const allMemos = await ctx.db
      .query("life_voiceMemos")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();

    const voiceNoteCount = allMemos.filter(
      (memo) =>
        memo.clientCreatedAt >= startOfDay && memo.clientCreatedAt <= endOfDay,
    ).length;

    // Build priority breakdown
    const byPriority: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };
    for (const task of tasks) {
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    }

    return {
      date: targetDate.toISOString().split("T")[0],
      tasks,
      events,
      voiceNoteCount,
      summary: {
        totalTasks: tasks.length,
        totalEvents: events.length,
        topPriorityCount: tasks.filter((t) => t.isTopPriority).length,
        dueOnDateCount: tasks.filter((t) => t.dueOnDate).length,
        byPriority,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 9: GET WEEKLY AGENDA ====================

/**
 * Get weekly agenda for a user
 * Returns tasks and events for the next 7 days grouped by date + AI weekly summary
 * Uses localTime to determine "today" accurately for user's timezone
 * Optimized for voice responses
 */
export const getWeeklyAgendaInternal = internalQuery({
  args: {
    userId: v.string(),
    startDate: v.optional(v.string()),
    localTime: v.optional(v.string()), // User's local time in ISO format
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Parse start date or use localTime or server time
    // Priority: explicit startDate > localTime > server time
    let startDateObj: Date;
    if (args.startDate) {
      startDateObj = new Date(args.startDate);
    } else if (args.localTime) {
      startDateObj = new Date(args.localTime);
    } else {
      startDateObj = new Date();
    }

    const startOfStartDay = new Date(
      startDateObj.getFullYear(),
      startDateObj.getMonth(),
      startDateObj.getDate(),
    ).getTime();
    const endOfWeek = startOfStartDay + 7 * 24 * 60 * 60 * 1000 - 1;

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter: tasks due within the 7-day window
    // Exclude done/cancelled
    const relevantTasks = allIssues.filter((issue) => {
      if (issue.status === "done" || issue.status === "cancelled") return false;
      if (!issue.dueDate) return false;

      return issue.dueDate >= startOfStartDay && issue.dueDate <= endOfWeek;
    });

    // Get project info for tasks
    const projectIds = [
      ...new Set(
        relevantTasks
          .map((t) => t.projectId)
          .filter((id): id is Id<"lifeos_pmProjects"> => id !== undefined),
      ),
    ];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(
      projects.filter(Boolean).map((p) => [p!._id, p!]),
    );

    // Define task type for grouping
    type TaskEntry = {
      identifier: string;
      title: string;
      status: string;
      priority: string;
      isTopPriority: boolean;
      projectName: string;
    };

    // Define event type for grouping
    type EventEntry = {
      title: string;
      startTime: string;
      endTime: string;
      isAllDay: boolean;
      location: string | null;
    };

    // Initialize tasksByDay and eventsByDay for all 7 days
    const tasksByDay: Record<string, TaskEntry[]> = {};
    const eventsByDay: Record<string, EventEntry[]> = {};

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfStartDay + i * 24 * 60 * 60 * 1000);
      const dateKey = dayDate.toISOString().split("T")[0];
      tasksByDay[dateKey] = [];
      eventsByDay[dateKey] = [];
    }

    // Sort tasks into their respective days
    for (const task of relevantTasks) {
      if (!task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      const dateKey = dueDate.toISOString().split("T")[0];

      if (tasksByDay[dateKey]) {
        const project = task.projectId
          ? projectMap.get(task.projectId)
          : undefined;
        tasksByDay[dateKey].push({
          identifier: task.identifier,
          title: task.title,
          status: task.status,
          priority: task.priority,
          isTopPriority: task.isTopPriority || false,
          projectName: project?.name ?? "",
        });
      }
    }

    // Sort tasks within each day by priority
    for (const dateKey of Object.keys(tasksByDay)) {
      tasksByDay[dateKey].sort((a, b) => {
        if (a.isTopPriority && !b.isTopPriority) return -1;
        if (!a.isTopPriority && b.isTopPriority) return 1;

        const priorityDiff =
          PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
          PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
        return priorityDiff;
      });
    }

    // Get calendar events for the week
    const allEvents = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_start_time", (q) => q.eq("userId", userId))
      .collect();

    // Filter events that overlap with the 7-day window and are not cancelled
    const weekEvents = allEvents.filter((event) => {
      if (event.status === "cancelled") return false;
      // Event overlaps if it starts before end of week and ends after start of week
      return event.startTime <= endOfWeek && event.endTime >= startOfStartDay;
    });

    // Sort events into their respective days
    for (const event of weekEvents) {
      // For multi-day events, add to each day they span
      const eventStartDate = new Date(event.startTime);
      const eventEndDate = new Date(event.endTime);

      for (let i = 0; i < 7; i++) {
        const dayStart = startOfStartDay + i * 24 * 60 * 60 * 1000;
        const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
        const dateKey = new Date(dayStart).toISOString().split("T")[0];

        // Check if event overlaps with this day
        if (event.startTime <= dayEnd && event.endTime >= dayStart) {
          if (eventsByDay[dateKey]) {
            eventsByDay[dateKey].push({
              title: event.title,
              startTime: eventStartDate.toISOString(),
              endTime: eventEndDate.toISOString(),
              isAllDay: event.isAllDay || false,
              location: event.location ?? null,
            });
          }
        }
      }
    }

    // Sort events within each day by start time
    for (const dateKey of Object.keys(eventsByDay)) {
      eventsByDay[dateKey].sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    }

    // Try to get weekly summary if available
    // Calculate the Monday of the week for the start date
    const weekStart = new Date(startOfStartDay);
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    const mondayDate = new Date(
      startOfStartDay + mondayOffset * 24 * 60 * 60 * 1000,
    );
    const weekStartDateStr = mondayDate.toISOString().split("T")[0];

    // Query for existing weekly summary using weekStartDate
    const weeklySummaries = await ctx.db
      .query("lifeos_weeklySummaries")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekStartDate", weekStartDateStr),
      )
      .first();

    // Build stats across all days
    const byPriority: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };
    let totalTasks = 0;
    let totalEvents = 0;
    let daysWithTasks = 0;
    let daysWithEvents = 0;

    for (const dateKey of Object.keys(tasksByDay)) {
      const dayTasks = tasksByDay[dateKey];
      const dayEvents = eventsByDay[dateKey];

      if (dayTasks.length > 0) {
        daysWithTasks++;
        totalTasks += dayTasks.length;
        for (const task of dayTasks) {
          byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
        }
      }

      if (dayEvents.length > 0) {
        daysWithEvents++;
        totalEvents += dayEvents.length;
      }
    }

    const endDate = new Date(endOfWeek);

    return {
      startDate: startDateObj.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      tasksByDay,
      eventsByDay,
      weekSummary: weeklySummaries?.aiSummary ?? null,
      stats: {
        totalTasks,
        totalEvents,
        daysWithTasks,
        daysWithEvents,
        byPriority,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Resolve an issue by ID or identifier (e.g., "PROJ-123")
 * Accepts both direct Convex ID and human-readable identifier
 */
async function resolveIssue(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  issueIdOrIdentifier: string,
): Promise<Doc<"lifeos_pmIssues"> | null> {
  // Try as direct ID first
  try {
    const issue = await ctx.db.get(
      issueIdOrIdentifier as Id<"lifeos_pmIssues">,
    );
    if (issue && issue.userId === userId) {
      return issue;
    }
  } catch {
    // Not a valid ID, continue to try identifier
  }

  // Try as identifier (e.g., "PROJ-123")
  const issue = await ctx.db
    .query("lifeos_pmIssues")
    .withIndex("by_identifier", (q) =>
      q
        .eq("userId", userId)
        .eq("identifier", issueIdOrIdentifier.toUpperCase()),
    )
    .first();

  return issue;
}

/**
 * Resolve a project by ID or key (e.g., "ACME")
 * Accepts both direct Convex ID and human-readable project key
 */
async function resolveProject(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectIdOrKey: string,
): Promise<Doc<"lifeos_pmProjects"> | null> {
  // Try as direct ID first
  try {
    const project = await ctx.db.get(projectIdOrKey as Id<"lifeos_pmProjects">);
    if (project && project.userId === userId) {
      return project;
    }
  } catch {
    // Not a valid ID, continue to try key
  }

  // Try as project key (e.g., "ACME")
  const project = await ctx.db
    .query("lifeos_pmProjects")
    .withIndex("by_key", (q) =>
      q.eq("userId", userId).eq("key", projectIdOrKey.toUpperCase()),
    )
    .first();

  return project;
}

// ==================== TOOL 10: CREATE ISSUE ====================

/**
 * Create a new issue/task
 * Supports project resolution by key (e.g., "ACME") or ID
 * Returns confirmation message for voice agent
 */
export const createIssueInternal = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    projectIdOrKey: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    cycleId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: `User not found. The provided userId "${args.userId}" does not exist in the users table.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;

    // Resolve project if provided
    let project: Doc<"lifeos_pmProjects"> | null = null;
    let projectId: Id<"lifeos_pmProjects"> | undefined;

    if (args.projectIdOrKey) {
      project = await resolveProject(ctx, userId, args.projectIdOrKey);
      if (!project) {
        return {
          success: false,
          error: `I couldn't find a project called "${args.projectIdOrKey}". Please check the project name or create it first.`,
          generatedAt: new Date().toISOString(),
        };
      }
      projectId = project._id;
    }

    // Resolve cycle if provided
    let cycleId: Id<"lifeos_pmCycles"> | undefined;
    let cycleName: string | undefined;

    if (args.cycleId) {
      try {
        const cycle = await ctx.db.get(args.cycleId as Id<"lifeos_pmCycles">);
        if (cycle && cycle.userId === userId) {
          cycleId = cycle._id;
          cycleName = cycle.name ?? `Cycle ${cycle.number}`;
        }
      } catch {
        // Invalid cycle ID, ignore
      }
    }

    // Generate identifier
    let identifier: string;
    let number: number;

    if (project) {
      number = project.nextIssueNumber;
      identifier = `${project.key}-${number}`;

      // Update project's next issue number and count
      await ctx.db.patch(project._id, {
        nextIssueNumber: number + 1,
        issueCount: project.issueCount + 1,
        updatedAt: now,
      });
    } else {
      // Standalone issue without project
      const allIssues = await ctx.db
        .query("lifeos_pmIssues")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      number = allIssues.length + 1;
      identifier = `ISS-${number}`;
    }

    // Update cycle count if assigned
    if (cycleId) {
      const cycle = await ctx.db.get(cycleId);
      if (cycle) {
        await ctx.db.patch(cycleId, {
          issueCount: cycle.issueCount + 1,
          updatedAt: now,
        });
      }
    }

    // Validate and set priority
    type Priority = "urgent" | "high" | "medium" | "low" | "none";
    const validPriorities: Priority[] = [
      "urgent",
      "high",
      "medium",
      "low",
      "none",
    ];
    const priority: Priority =
      args.priority && validPriorities.includes(args.priority as Priority)
        ? (args.priority as Priority)
        : "none";

    // Parse due date
    let dueDate: number | undefined;
    if (args.dueDate) {
      const parsed = new Date(args.dueDate);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.getTime();
      }
    }

    // Get sort order for backlog
    const existingInBacklog = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_status", (q) =>
        q.eq("userId", userId).eq("status", "backlog"),
      )
      .collect();
    const maxSortOrder = existingInBacklog.reduce(
      (max, i) => Math.max(max, i.sortOrder),
      0,
    );

    // Create the issue
    const issueId = await ctx.db.insert("lifeos_pmIssues", {
      userId,
      projectId,
      cycleId,
      parentId: undefined,
      identifier,
      number,
      title: args.title,
      description: args.description,
      status: "backlog",
      priority,
      estimate: undefined,
      labelIds: [],
      dueDate,
      sortOrder: maxSortOrder + 1000,
      createdAt: now,
      updatedAt: now,
    });

    // Build confirmation message
    let confirmationMessage = `Created task ${identifier}: "${args.title}"`;
    if (project) {
      confirmationMessage += ` in project ${project.name}`;
    }
    if (priority !== "none") {
      confirmationMessage += ` with ${priority} priority`;
    }
    if (dueDate) {
      confirmationMessage += `, due ${new Date(dueDate).toLocaleDateString()}`;
    }
    if (cycleName) {
      confirmationMessage += `, assigned to ${cycleName}`;
    }
    confirmationMessage += ".";

    // Check if there's an active cycle to suggest
    let suggestCycle = false;
    let activeCycleName: string | null = null;

    if (!cycleId) {
      const activeCycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "active"),
        )
        .first();

      if (activeCycles) {
        suggestCycle = true;
        activeCycleName = activeCycles.name ?? `Cycle ${activeCycles.number}`;
        confirmationMessage += ` Would you like to add it to ${activeCycleName}?`;
      }
    }

    return {
      success: true,
      issue: {
        id: issueId,
        identifier,
        title: args.title,
        projectId,
        projectName: project?.name,
        projectKey: project?.key,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        cycleId,
        cycleName,
      },
      suggestCycle,
      activeCycleName,
      confirmationMessage,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 11: MARK ISSUE COMPLETE ====================

/**
 * Mark an issue as complete (done status)
 * Accepts issue by ID or identifier (e.g., "PROJ-123")
 * Returns confirmation with cycle progress
 */
export const markIssueCompleteInternal = internalMutation({
  args: {
    userId: v.string(),
    issueIdOrIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: `User not found. The provided userId does not exist.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const issue = await resolveIssue(ctx, userId, args.issueIdOrIdentifier);

    if (!issue) {
      return {
        success: false,
        error: `I couldn't find a task "${args.issueIdOrIdentifier}". Please check the task identifier and try again.`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Check if already done
    if (issue.status === "done") {
      return {
        success: false,
        error: `Task ${issue.identifier}: "${issue.title}" is already marked as complete.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const previousStatus = issue.status;

    // Update the issue status
    await ctx.db.patch(issue._id, {
      status: "done",
      completedAt: now,
      updatedAt: now,
    });

    // Update project completed count
    let projectName: string | undefined;
    if (issue.projectId) {
      const project = await ctx.db.get(issue.projectId);
      if (project) {
        projectName = project.name;
        await ctx.db.patch(issue.projectId, {
          completedIssueCount: project.completedIssueCount + 1,
          updatedAt: now,
        });
      }
    }

    // Update cycle completed count and get progress
    let cycleProgress: {
      completed: number;
      total: number;
      name: string;
    } | null = null;
    if (issue.cycleId) {
      const cycle = await ctx.db.get(issue.cycleId);
      if (cycle) {
        const newCompletedCount = cycle.completedIssueCount + 1;
        await ctx.db.patch(issue.cycleId, {
          completedIssueCount: newCompletedCount,
          updatedAt: now,
        });
        cycleProgress = {
          completed: newCompletedCount,
          total: cycle.issueCount,
          name: cycle.name ?? `Cycle ${cycle.number}`,
        };
      }
    }

    // Build confirmation message
    let confirmationMessage = `Done! Marked ${issue.identifier}: "${issue.title}" as complete.`;
    if (cycleProgress) {
      confirmationMessage += ` You've completed ${cycleProgress.completed} of ${cycleProgress.total} tasks in ${cycleProgress.name}.`;
    }

    return {
      success: true,
      issue: {
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
        previousStatus,
        projectId: issue.projectId,
        projectName,
      },
      cycleProgress,
      confirmationMessage,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 12: GET CURRENT CYCLE ====================

/**
 * Get the currently active cycle with progress stats
 * Returns cycle info, progress breakdown, and top priority issues
 */
export const getCurrentCycleInternal = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        hasCycle: false,
        error: `User not found. The provided userId does not exist.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;

    const activeCycle = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "active"),
      )
      .first();

    if (!activeCycle) {
      return {
        success: false,
        hasCycle: false,
        error:
          "You don't have an active cycle right now. Would you like me to help you set one up?",
        generatedAt: new Date().toISOString(),
      };
    }

    // Calculate days remaining
    const now = Date.now();
    const daysRemaining = Math.max(
      0,
      Math.ceil((activeCycle.endDate - now) / (24 * 60 * 60 * 1000)),
    );

    // Get all issues in this cycle
    const cycleIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", activeCycle._id))
      .collect();

    // Filter to only this user's issues
    const userIssues = cycleIssues.filter((i) => i.userId === userId);

    // Calculate progress breakdown
    const progress = {
      totalIssues: userIssues.length,
      completed: userIssues.filter((i) => i.status === "done").length,
      inProgress: userIssues.filter(
        (i) => i.status === "in_progress" || i.status === "in_review",
      ).length,
      todo: userIssues.filter((i) => i.status === "todo").length,
      backlog: userIssues.filter((i) => i.status === "backlog").length,
      completionPercent:
        userIssues.length > 0
          ? Math.round(
              (userIssues.filter((i) => i.status === "done").length /
                userIssues.length) *
                100,
            )
          : 0,
    };

    // Get top priority issues (not done, sorted by priority)
    const activeIssues = userIssues
      .filter((i) => i.status !== "done" && i.status !== "cancelled")
      .sort((a, b) => {
        // Top priority first
        if (a.isTopPriority && !b.isTopPriority) return -1;
        if (!a.isTopPriority && b.isTopPriority) return 1;
        // Then by priority level
        return (
          PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
          PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER]
        );
      })
      .slice(0, 5);

    // Get project info for top issues
    const projectIds = [
      ...new Set(
        activeIssues
          .map((i) => i.projectId)
          .filter((id): id is Id<"lifeos_pmProjects"> => id !== undefined),
      ),
    ];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(
      projects.filter(Boolean).map((p) => [p!._id, p!]),
    );

    const topIssues = activeIssues.map((issue) => {
      const project = issue.projectId
        ? projectMap.get(issue.projectId)
        : undefined;
      return {
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        isTopPriority: issue.isTopPriority || false,
        projectName: project?.name ?? "",
      };
    });

    return {
      success: true,
      hasCycle: true,
      cycle: {
        id: activeCycle._id,
        name: activeCycle.name ?? `Cycle ${activeCycle.number}`,
        number: activeCycle.number,
        startDate: new Date(activeCycle.startDate).toISOString().split("T")[0],
        endDate: new Date(activeCycle.endDate).toISOString().split("T")[0],
        daysRemaining,
        status: activeCycle.status,
        goals: activeCycle.goals,
      },
      progress,
      topIssues,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 13: ASSIGN ISSUE TO CYCLE ====================

/**
 * Assign an issue to a cycle
 * Defaults to current active cycle if no cycleId provided
 * Accepts issue by ID or identifier
 */
export const assignIssueToCycleInternal = internalMutation({
  args: {
    userId: v.string(),
    issueIdOrIdentifier: v.string(),
    cycleId: v.optional(v.string()), // Optional - defaults to active cycle
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: `User not found. The provided userId does not exist.`,
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const now = Date.now();

    const issue = await resolveIssue(ctx, userId, args.issueIdOrIdentifier);

    if (!issue) {
      return {
        success: false,
        error: `I couldn't find a task "${args.issueIdOrIdentifier}". Please check the task identifier and try again.`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Resolve the cycle (use provided or default to active)
    let cycle: Doc<"lifeos_pmCycles"> | null = null;

    if (args.cycleId) {
      try {
        cycle = await ctx.db.get(args.cycleId as Id<"lifeos_pmCycles">);
        if (!cycle || cycle.userId !== userId) {
          cycle = null;
        }
      } catch {
        // Invalid cycle ID
      }

      if (!cycle) {
        return {
          success: false,
          error: `I couldn't find that cycle. Please check the cycle ID and try again.`,
          generatedAt: new Date().toISOString(),
        };
      }
    } else {
      // Default to active cycle
      cycle = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "active"),
        )
        .first();

      if (!cycle) {
        return {
          success: false,
          error:
            "You don't have an active cycle. Would you like me to help you create one?",
          generatedAt: new Date().toISOString(),
        };
      }
    }

    // Check if already in this cycle
    if (issue.cycleId === cycle._id) {
      const cycleName = cycle.name ?? `Cycle ${cycle.number}`;
      return {
        success: false,
        error: `Task ${issue.identifier}: "${issue.title}" is already in ${cycleName}.`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Remove from old cycle if any
    if (issue.cycleId) {
      const oldCycle = await ctx.db.get(issue.cycleId);
      if (oldCycle) {
        await ctx.db.patch(issue.cycleId, {
          issueCount: Math.max(0, oldCycle.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, oldCycle.completedIssueCount - 1)
              : oldCycle.completedIssueCount,
          updatedAt: now,
        });
      }
    }

    // Add to new cycle
    await ctx.db.patch(issue._id, {
      cycleId: cycle._id,
      updatedAt: now,
    });

    // Update cycle counts
    await ctx.db.patch(cycle._id, {
      issueCount: cycle.issueCount + 1,
      completedIssueCount:
        issue.status === "done"
          ? cycle.completedIssueCount + 1
          : cycle.completedIssueCount,
      updatedAt: now,
    });

    const cycleName = cycle.name ?? `Cycle ${cycle.number}`;
    const newIssueCount = cycle.issueCount + 1;

    // Build confirmation message
    const confirmationMessage = `Added ${issue.identifier}: "${issue.title}" to ${cycleName}. The cycle now has ${newIssueCount} issues.`;

    return {
      success: true,
      issue: {
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
      },
      cycle: {
        id: cycle._id,
        name: cycleName,
        issueCount: newIssueCount,
      },
      confirmationMessage,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== FRM (FRIEND RELATIONSHIP MANAGEMENT) TOOLS ====================

/**
 * Get all people/contacts for a user
 * Returns list of contacts with optional filtering
 */
export const getPeopleInternal = internalQuery({
  args: {
    userId: v.string(),
    relationshipType: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 100;
    const includeArchived = args.includeArchived ?? false;

    let people = await ctx.db
      .query("lifeos_frmPeople")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Filter by archived status
    if (!includeArchived) {
      people = people.filter((p) => !p.archivedAt);
    }

    // Filter by relationship type
    if (args.relationshipType) {
      people = people.filter((p) => p.relationshipType === args.relationshipType);
    }

    // Sort by last interaction (most recent first), then by name
    people.sort((a, b) => {
      if (a.lastInteractionAt && b.lastInteractionAt) {
        return b.lastInteractionAt - a.lastInteractionAt;
      }
      if (a.lastInteractionAt) return -1;
      if (b.lastInteractionAt) return 1;
      return a.name.localeCompare(b.name);
    });

    // Build simplified response
    const contacts = people.map((person) => ({
      id: person._id,
      name: person.name,
      nickname: person.nickname,
      relationshipType: person.relationshipType,
      avatarEmoji: person.avatarEmoji,
      memoCount: person.memoCount,
      lastInteractionAt: person.lastInteractionAt
        ? new Date(person.lastInteractionAt).toISOString()
        : null,
      isArchived: !!person.archivedAt,
    }));

    return {
      people: contacts,
      count: contacts.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get a single person with their AI profile
 */
export const getPersonInternal = internalQuery({
  args: {
    userId: v.string(),
    personId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const personId = args.personId as Id<"lifeos_frmPeople">;

    const person = await ctx.db.get(personId);
    if (!person || person.userId !== userId) {
      return {
        success: false,
        error: "Person not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get the latest completed profile
    const profiles = await ctx.db
      .query("lifeos_frmProfiles")
      .withIndex("by_person_version", (q) => q.eq("personId", personId))
      .order("desc")
      .take(1);

    const latestProfile =
      profiles.length > 0 && profiles[0].status === "completed"
        ? profiles[0]
        : null;

    return {
      success: true,
      person: {
        id: person._id,
        name: person.name,
        nickname: person.nickname,
        relationshipType: person.relationshipType,
        email: person.email,
        phone: person.phone,
        avatarEmoji: person.avatarEmoji,
        color: person.color,
        notes: person.notes,
        memoCount: person.memoCount,
        lastInteractionAt: person.lastInteractionAt
          ? new Date(person.lastInteractionAt).toISOString()
          : null,
        isArchived: !!person.archivedAt,
        createdAt: new Date(person.createdAt).toISOString(),
      },
      profile: latestProfile
        ? {
            confidence: latestProfile.confidence,
            memosAnalyzed: latestProfile.memosAnalyzed,
            communicationStyle: latestProfile.communicationStyle,
            personality: latestProfile.personality,
            tips: latestProfile.tips,
            summary: latestProfile.summary,
            updatedAt: new Date(latestProfile.updatedAt).toISOString(),
          }
        : null,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Search people by name
 */
export const searchPeopleInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 20;

    if (!args.query.trim()) {
      return {
        people: [],
        query: args.query,
        count: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const results = await ctx.db
      .query("lifeos_frmPeople")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.query).eq("userId", userId)
      )
      .take(limit);

    // Filter out archived
    const filteredResults = results.filter((p) => !p.archivedAt);

    const people = filteredResults.map((person) => ({
      id: person._id,
      name: person.name,
      nickname: person.nickname,
      relationshipType: person.relationshipType,
      avatarEmoji: person.avatarEmoji,
      memoCount: person.memoCount,
    }));

    return {
      people,
      query: args.query,
      count: people.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get memos linked to a person
 */
export const getMemosForPersonInternal = internalQuery({
  args: {
    userId: v.string(),
    personId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const personId = args.personId as Id<"lifeos_frmPeople">;
    const limit = args.limit ?? 50;

    // Verify person belongs to user
    const person = await ctx.db.get(personId);
    if (!person || person.userId !== userId) {
      return {
        success: false,
        error: "Person not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get memo links for this person
    const links = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_person_created", (q) => q.eq("personId", personId))
      .order("desc")
      .take(limit);

    // Get actual memos with their data
    const memos = await Promise.all(
      links.map(async (link) => {
        const memo = await ctx.db.get(link.voiceMemoId);
        if (!memo || memo.userId !== userId) return null;

        return {
          id: memo._id,
          name: memo.name,
          transcript: memo.transcript,
          duration: memo.duration,
          context: link.context,
          linkedAt: new Date(link.createdAt).toISOString(),
          createdAt: new Date(memo.clientCreatedAt).toISOString(),
        };
      })
    );

    const validMemos = memos.filter(Boolean);

    return {
      success: true,
      personName: person.name,
      memos: validMemos,
      count: validMemos.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get timeline entries for a person or all people
 */
export const getPersonTimelineInternal = internalQuery({
  args: {
    userId: v.string(),
    personId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 50;

    let entries;
    if (args.personId) {
      const personId = args.personId as Id<"lifeos_frmPeople">;

      // Verify person belongs to user
      const person = await ctx.db.get(personId);
      if (!person || person.userId !== userId) {
        return {
          success: false,
          error: "Person not found or access denied",
          generatedAt: new Date().toISOString(),
        };
      }

      entries = await ctx.db
        .query("lifeos_frmTimeline")
        .withIndex("by_person_interaction", (q) => q.eq("personId", personId))
        .order("desc")
        .take(limit);
    } else {
      entries = await ctx.db
        .query("lifeos_frmTimeline")
        .withIndex("by_user_interaction", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    }

    const timeline = entries.map((entry) => ({
      id: entry._id,
      personId: entry.personId,
      personName: entry.personName,
      entryType: entry.entryType,
      title: entry.title,
      preview: entry.preview,
      interactionAt: new Date(entry.interactionAt).toISOString(),
    }));

    return {
      success: true,
      timeline,
      count: timeline.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Create a new person/contact
 */
export const createPersonInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    nickname: v.optional(v.string()),
    relationshipType: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: "User not found",
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const now = Date.now();

    // Validate relationship type
    const validTypes = ["family", "friend", "colleague", "acquaintance", "mentor", "other"];
    const relationshipType = args.relationshipType && validTypes.includes(args.relationshipType)
      ? (args.relationshipType as "family" | "friend" | "colleague" | "acquaintance" | "mentor" | "other")
      : undefined;

    const personId = await ctx.db.insert("lifeos_frmPeople", {
      userId,
      name: args.name.trim(),
      nickname: args.nickname?.trim(),
      relationshipType,
      avatarEmoji: args.avatarEmoji,
      notes: args.notes?.trim(),
      memoCount: 0,
      lastInteractionAt: undefined,
      createdAt: now,
      updatedAt: now,
      archivedAt: undefined,
    });

    return {
      success: true,
      personId,
      name: args.name.trim(),
      confirmationMessage: `Created contact "${args.name.trim()}"${relationshipType ? ` (${relationshipType})` : ""}.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Update a person/contact
 */
export const updatePersonInternal = internalMutation({
  args: {
    userId: v.string(),
    personId: v.string(),
    name: v.optional(v.string()),
    nickname: v.optional(v.string()),
    relationshipType: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: "User not found",
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const personId = args.personId as Id<"lifeos_frmPeople">;

    const person = await ctx.db.get(personId);
    if (!person || person.userId !== userId) {
      return {
        success: false,
        error: "Person not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Build updates object
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.nickname !== undefined) updates.nickname = args.nickname.trim();
    if (args.email !== undefined) updates.email = args.email.trim();
    if (args.phone !== undefined) updates.phone = args.phone.trim();
    if (args.notes !== undefined) updates.notes = args.notes.trim();

    // Validate and set relationship type
    if (args.relationshipType !== undefined) {
      const validTypes = ["family", "friend", "colleague", "acquaintance", "mentor", "other"];
      if (validTypes.includes(args.relationshipType)) {
        updates.relationshipType = args.relationshipType;
      }
    }

    await ctx.db.patch(personId, updates);

    return {
      success: true,
      personId,
      confirmationMessage: `Updated contact "${args.name ?? person.name}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Link a voice memo to a person
 */
export const linkMemoToPersonInternal = internalMutation({
  args: {
    userId: v.string(),
    personId: v.string(),
    voiceMemoId: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: "User not found",
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const personId = args.personId as Id<"lifeos_frmPeople">;
    const voiceMemoId = args.voiceMemoId as Id<"life_voiceMemos">;
    const now = Date.now();

    // Verify person belongs to user
    const person = await ctx.db.get(personId);
    if (!person || person.userId !== userId) {
      return {
        success: false,
        error: "Person not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Verify memo belongs to user
    const memo = await ctx.db.get(voiceMemoId);
    if (!memo || memo.userId !== userId) {
      return {
        success: false,
        error: "Voice memo not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Check if already linked
    const existingLink = await ctx.db
      .query("lifeos_frmPersonMemos")
      .withIndex("by_memo", (q) => q.eq("voiceMemoId", voiceMemoId))
      .filter((q) => q.eq(q.field("personId"), personId))
      .first();

    if (existingLink) {
      // Update context if provided
      if (args.context !== undefined) {
        await ctx.db.patch(existingLink._id, { context: args.context });
      }
      return {
        success: true,
        linkId: existingLink._id,
        alreadyLinked: true,
        confirmationMessage: `Memo "${memo.name}" is already linked to ${person.name}.`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Create link
    const linkId = await ctx.db.insert("lifeos_frmPersonMemos", {
      userId,
      personId,
      voiceMemoId,
      context: args.context,
      createdAt: now,
    });

    // Create timeline entry
    await ctx.db.insert("lifeos_frmTimeline", {
      userId,
      personId,
      entryType: "voice_memo",
      voiceMemoId,
      personName: person.name,
      title: memo.name,
      preview: memo.transcript?.slice(0, 200),
      interactionAt: memo.clientCreatedAt || memo.createdAt,
      createdAt: now,
    });

    // Update person's memo count and last interaction
    await ctx.db.patch(personId, {
      memoCount: person.memoCount + 1,
      lastInteractionAt: memo.clientCreatedAt || memo.createdAt,
      updatedAt: now,
    });

    return {
      success: true,
      linkId,
      alreadyLinked: false,
      confirmationMessage: `Linked memo "${memo.name}" to ${person.name}.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== CLIENT MANAGEMENT TOOLS ====================

/**
 * Get all clients for a user
 */
export const getClientsInternal = internalQuery({
  args: {
    userId: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    let clients;
    if (args.status === "active" || args.status === "archived") {
      clients = await ctx.db
        .query("lifeos_pmClients")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status as "active" | "archived")
        )
        .order("desc")
        .collect();
    } else {
      clients = await ctx.db
        .query("lifeos_pmClients")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    const clientsWithInfo = clients.map((client) => ({
      id: client._id,
      name: client.name,
      description: htmlToPlainText(client.description),
      status: client.status,
      createdAt: new Date(client.createdAt).toISOString(),
    }));

    return {
      clients: clientsWithInfo,
      count: clientsWithInfo.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get a single client with project stats
 */
export const getClientInternal = internalQuery({
  args: {
    userId: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const clientId = args.clientId as Id<"lifeos_pmClients">;

    const client = await ctx.db.get(clientId);
    if (!client || client.userId !== userId) {
      return {
        success: false,
        error: "Client not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get project stats
    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    const projectCount = projects.length;
    const activeProjectCount = projects.filter((p) => p.status === "in_progress").length;
    const completedProjectCount = projects.filter((p) => p.status === "completed").length;

    return {
      success: true,
      client: {
        id: client._id,
        name: client.name,
        description: htmlToPlainText(client.description),
        status: client.status,
        createdAt: new Date(client.createdAt).toISOString(),
        updatedAt: new Date(client.updatedAt).toISOString(),
      },
      stats: {
        projectCount,
        activeProjectCount,
        completedProjectCount,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get projects for a client
 */
export const getProjectsForClientInternal = internalQuery({
  args: {
    userId: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const clientId = args.clientId as Id<"lifeos_pmClients">;

    // Verify client belongs to user
    const client = await ctx.db.get(clientId);
    if (!client || client.userId !== userId) {
      return {
        success: false,
        error: "Client not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    const projectsWithStats = projects.map((project) => ({
      id: project._id,
      key: project.key,
      name: project.name,
      description: htmlToPlainText(project.description),
      status: project.status,
      health: project.health,
      issueCount: project.issueCount,
      completedIssueCount: project.completedIssueCount,
      completionPercentage:
        project.issueCount > 0
          ? Math.round((project.completedIssueCount / project.issueCount) * 100)
          : 0,
    }));

    return {
      success: true,
      clientName: client.name,
      projects: projectsWithStats,
      count: projectsWithStats.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Create a new client
 */
export const createClientInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: "User not found",
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const now = Date.now();

    const clientId = await ctx.db.insert("lifeos_pmClients", {
      userId,
      name: args.name.trim(),
      description: args.description?.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      clientId,
      name: args.name.trim(),
      confirmationMessage: `Created client "${args.name.trim()}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Update a client
 */
export const updateClientInternal = internalMutation({
  args: {
    userId: v.string(),
    clientId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), args.userId))
      .first();

    if (!user) {
      return {
        success: false,
        error: "User not found",
        generatedAt: new Date().toISOString(),
      };
    }

    const userId = user._id;
    const clientId = args.clientId as Id<"lifeos_pmClients">;

    const client = await ctx.db.get(clientId);
    if (!client || client.userId !== userId) {
      return {
        success: false,
        error: "Client not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Build updates object
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined) {
      updates.description = args.description.trim() || undefined;
    }
    if (args.status !== undefined) {
      if (args.status === "active" || args.status === "archived") {
        updates.status = args.status;
      }
    }

    await ctx.db.patch(clientId, updates);

    return {
      success: true,
      clientId,
      confirmationMessage: `Updated client "${args.name ?? client.name}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});
