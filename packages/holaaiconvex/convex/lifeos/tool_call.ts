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
  get_project: {
    description: "Get a single project's details with full stats",
    params: {
      projectIdOrKey: "required - project ID or key (e.g., ACME)",
    },
  },
  create_project: {
    description: "Create a new project with a unique key",
    params: {
      name: "required - the project name",
      key: "required - unique project key (e.g., ACME, uppercase)",
      description: "optional - project description",
      clientId: "optional - associate with a client",
      status: "optional - planned, in_progress, paused, completed, cancelled",
      priority: "optional - urgent, high, medium, low, none",
    },
  },
  update_project: {
    description: "Update a project's details",
    params: {
      projectIdOrKey: "required - project ID or key (e.g., ACME)",
      name: "optional - updated name",
      description: "optional - updated description",
      status: "optional - planned, in_progress, paused, completed, cancelled",
      health: "optional - on_track, at_risk, off_track",
      priority: "optional - urgent, high, medium, low, none",
      clientId: "optional - associate with a client",
    },
  },
  delete_project: {
    description: "Delete a project (issues are preserved but unlinked)",
    params: {
      projectIdOrKey: "required - project ID or key (e.g., ACME)",
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
  get_monthly_agenda: {
    description:
      "Get monthly agenda: tasks and events for the month, plus AI monthly summary",
    params: {
      monthStartDate:
        "optional - 1st of month in ISO format (default: current month based on localTime)",
      localTime:
        "optional - user's local time in ISO format for accurate date calculation",
    },
  },
  regenerate_daily_summary: {
    description: "Regenerate AI summary for a specific day",
    params: {
      date: "required - date in ISO format (YYYY-MM-DD)",
      model: "optional - AI model to use (default: openai/gpt-4o-mini)",
    },
  },
  regenerate_weekly_summary: {
    description: "Regenerate AI summary for a specific week",
    params: {
      weekStartDate: "required - Monday of the week in ISO format (YYYY-MM-DD)",
      model: "optional - AI model to use (default: openai/gpt-4o-mini)",
    },
  },
  regenerate_monthly_summary: {
    description: "Regenerate AI summary for a specific month",
    params: {
      monthStartDate: "required - 1st of month in ISO format (YYYY-MM-DD)",
      model: "optional - AI model to use (default: openai/gpt-4o-mini)",
    },
  },
  update_weekly_prompt: {
    description: "Update custom prompt for weekly summary generation",
    params: {
      weekStartDate: "required - Monday of the week in ISO format (YYYY-MM-DD)",
      customPrompt: "required - custom prompt template for AI summary",
    },
  },
  update_monthly_prompt: {
    description: "Update custom prompt for monthly summary generation",
    params: {
      monthStartDate: "required - 1st of month in ISO format (YYYY-MM-DD)",
      customPrompt: "required - custom prompt template for AI summary",
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
      phaseId: "optional - assign to specific phase within the project",
    },
  },
  mark_issue_complete: {
    description: "Mark a task as complete by ID or identifier (e.g., PROJ-123)",
    params: {
      issueIdOrIdentifier: "required - issue ID or identifier like PROJ-123",
    },
  },
  get_issue: {
    description: "Get a single issue/task's full details",
    params: {
      issueIdOrIdentifier: "required - issue ID or identifier like PROJ-123",
    },
  },
  update_issue: {
    description: "Update an issue/task's details",
    params: {
      issueIdOrIdentifier: "required - issue ID or identifier like PROJ-123",
      title: "optional - updated title",
      description: "optional - updated description",
      status: "optional - backlog, todo, in_progress, in_review, done, cancelled",
      priority: "optional - urgent, high, medium, low, none",
      dueDate: "optional - ISO date string or empty to clear",
      isTopPriority: "optional - true/false",
    },
  },
  delete_issue: {
    description: "Delete an issue/task permanently",
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
  get_cycles: {
    description: "Get all cycles/sprints for the user",
    params: {
      status: "optional - filter by status (upcoming, active, completed)",
      limit: "optional - max results (default 20)",
    },
  },
  create_cycle: {
    description: "Create a new cycle/sprint",
    params: {
      name: "optional - cycle name (defaults to 'Cycle N')",
      startDate: "required - start date in ISO format",
      endDate: "required - end date in ISO format",
      goals: "optional - cycle goals/objectives",
    },
  },
  update_cycle: {
    description: "Update a cycle's details",
    params: {
      cycleId: "required - cycle ID",
      name: "optional - updated name",
      startDate: "optional - updated start date",
      endDate: "optional - updated end date",
      status: "optional - upcoming, active, completed",
      goals: "optional - updated goals",
    },
  },
  delete_cycle: {
    description: "Delete a cycle (issues are unlinked, not deleted)",
    params: {
      cycleId: "required - cycle ID",
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
  delete_client: {
    description: "Delete a client (projects are unlinked, not deleted)",
    params: {
      clientId: "required - the client's ID",
    },
  },
  // Phase Management tools
  get_phases: {
    description: "Get all phases for a project with issue stats",
    params: {
      projectId: "required - the project's ID",
    },
  },
  get_phase: {
    description: "Get a single phase with its issues",
    params: {
      phaseId: "required - the phase's ID",
    },
  },
  create_phase: {
    description: "Create a new phase in a project",
    params: {
      projectId: "required - the project's ID",
      name: "required - the phase name",
      description: "optional - phase description (markdown supported)",
      status: "optional - not_started, in_progress, or completed",
    },
  },
  update_phase: {
    description: "Update a phase's details",
    params: {
      phaseId: "required - the phase's ID",
      name: "optional - updated name",
      description: "optional - updated description",
      status: "optional - not_started, in_progress, or completed",
      startDate: "optional - ISO date string",
      endDate: "optional - ISO date string",
    },
  },
  delete_phase: {
    description: "Delete a phase (issues are unlinked, not deleted)",
    params: {
      phaseId: "required - the phase's ID",
    },
  },
  assign_issue_to_phase: {
    description: "Assign an issue to a phase, or unassign by omitting phaseId",
    params: {
      issueIdOrIdentifier: "required - issue ID or identifier like PROJ-123",
      phaseId: "optional - phase ID (omit to unassign from current phase)",
    },
  },
  // Beeper Business Contacts tools
  get_beeper_threads: {
    description: "List all business-marked Beeper threads (WhatsApp contacts)",
    params: {
      limit: "optional - max results (default 50)",
    },
  },
  get_beeper_thread: {
    description: "Get a single Beeper thread by its thread ID",
    params: {
      threadId: "required - the Beeper thread ID string",
    },
  },
  get_beeper_thread_messages: {
    description: "Get messages for a Beeper thread",
    params: {
      threadId: "required - the Beeper thread ID string",
      limit: "optional - max results (default 100)",
    },
  },
  search_beeper_messages: {
    description: "Full-text search across all Beeper messages",
    params: {
      query: "required - search terms to find in messages",
      limit: "optional - max results (default 50)",
    },
  },
  get_beeper_threads_for_person: {
    description: "Get Beeper threads linked to a FRM person/contact",
    params: {
      personId: "required - the person's ID",
    },
  },
  get_beeper_threads_for_client: {
    description: "Get Beeper threads linked to a PM client",
    params: {
      clientId: "required - the client's ID",
    },
  },
  // Granola Meeting tools
  get_granola_meetings: {
    description: "List all synced Granola meetings",
    params: {
      limit: "optional - max results (default 50)",
    },
  },
  get_granola_meeting: {
    description: "Get a single Granola meeting by its Granola doc ID (includes AI notes)",
    params: {
      granolaDocId: "required - the Granola document ID",
    },
  },
  get_granola_transcript: {
    description: "Get full transcript for a Granola meeting",
    params: {
      meetingId: "required - the Convex meeting ID",
    },
  },
  search_granola_meetings: {
    description: "Search Granola meetings by title or content",
    params: {
      query: "required - search terms",
      limit: "optional - max results (default 20)",
    },
  },
  // Cross-Entity Linking tools
  get_granola_meetings_for_person: {
    description: "Get Granola meetings linked to a FRM person/contact",
    params: {
      personId: "required - the person's ID",
    },
  },
  get_granola_meetings_for_thread: {
    description: "Get Granola meetings linked to a Beeper thread",
    params: {
      beeperThreadId: "required - the Beeper thread Convex ID",
    },
  },
  // Beeper → FRM Sync tools
  sync_beeper_contacts_to_frm: {
    description: "Bulk sync unlinked business DM Beeper threads to FRM people",
    params: {
      dryRun: "optional - preview without changes (default: false)",
    },
  },
  link_beeper_thread_to_person: {
    description: "Link a Beeper thread to an existing or new FRM person",
    params: {
      threadId: "required - Beeper thread ID string",
      personId: "optional - existing person ID (omit to create new)",
      personName: "optional - name for new person (defaults to threadName)",
      relationshipType: "optional - colleague/friend/family/etc (default: colleague)",
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

// ==================== TOOL 10: GET MONTHLY AGENDA ====================

/**
 * Get monthly agenda for a user
 * Returns tasks and events for the month + AI monthly summary
 * Uses localTime to determine the month accurately for user's timezone
 */
export const getMonthlyAgendaInternal = internalQuery({
  args: {
    userId: v.string(),
    monthStartDate: v.optional(v.string()),
    localTime: v.optional(v.string()), // User's local time in ISO format
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Parse month start date or use localTime or server time
    let startDateObj: Date;
    if (args.monthStartDate) {
      startDateObj = new Date(args.monthStartDate);
    } else if (args.localTime) {
      const localDate = new Date(args.localTime);
      startDateObj = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
    } else {
      const now = new Date();
      startDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Calculate month end
    const monthEnd = new Date(
      startDateObj.getFullYear(),
      startDateObj.getMonth() + 1,
      0
    );

    const startOfMonth = startDateObj.getTime();
    const endOfMonth = monthEnd.getTime() + 24 * 60 * 60 * 1000 - 1;

    // Get all issues for the user
    const allIssues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter: tasks due within the month
    const relevantTasks = allIssues.filter((issue) => {
      if (issue.status === "done" || issue.status === "cancelled") return false;
      if (!issue.dueDate) return false;
      return issue.dueDate >= startOfMonth && issue.dueDate <= endOfMonth;
    });

    // Get completed tasks for the month
    const completedTasks = allIssues.filter((issue) => {
      if (issue.status !== "done") return false;
      if (!issue.completedAt) return false;
      return issue.completedAt >= startOfMonth && issue.completedAt <= endOfMonth;
    });

    // Get project info
    const projectIds = [
      ...new Set(
        [...relevantTasks, ...completedTasks]
          .map((t) => t.projectId)
          .filter((id): id is Id<"lifeos_pmProjects"> => id !== undefined),
      ),
    ];
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    const projectMap = new Map(
      projects.filter(Boolean).map((p) => [p!._id, p!]),
    );

    // Group tasks by week
    type TaskEntry = {
      identifier: string;
      title: string;
      status: string;
      priority: string;
      isTopPriority: boolean;
      projectName: string;
      dueDate: string | null;
    };

    const tasksByWeek: Record<string, TaskEntry[]> = {};
    const completedByWeek: Record<string, TaskEntry[]> = {};

    // Initialize weeks
    const currentWeekStart = new Date(startDateObj);
    while (currentWeekStart <= monthEnd) {
      const weekKey = currentWeekStart.toISOString().split("T")[0];
      tasksByWeek[weekKey] = [];
      completedByWeek[weekKey] = [];
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    // Helper to get week key for a date
    const getWeekKey = (dateMs: number): string => {
      const date = new Date(dateMs);
      const dayOfWeek = date.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(monday.getDate() + diff);
      return monday.toISOString().split("T")[0];
    };

    // Sort remaining tasks into weeks
    for (const task of relevantTasks) {
      if (!task.dueDate) continue;
      const weekKey = getWeekKey(task.dueDate);
      const project = task.projectId ? projectMap.get(task.projectId) : undefined;

      if (!tasksByWeek[weekKey]) tasksByWeek[weekKey] = [];
      tasksByWeek[weekKey].push({
        identifier: task.identifier,
        title: task.title,
        status: task.status,
        priority: task.priority,
        isTopPriority: task.isTopPriority || false,
        projectName: project?.name ?? "",
        dueDate: new Date(task.dueDate).toISOString().split("T")[0],
      });
    }

    // Sort completed tasks into weeks
    for (const task of completedTasks) {
      if (!task.completedAt) continue;
      const weekKey = getWeekKey(task.completedAt);
      const project = task.projectId ? projectMap.get(task.projectId) : undefined;

      if (!completedByWeek[weekKey]) completedByWeek[weekKey] = [];
      completedByWeek[weekKey].push({
        identifier: task.identifier,
        title: task.title,
        status: task.status,
        priority: task.priority,
        isTopPriority: task.isTopPriority || false,
        projectName: project?.name ?? "",
        dueDate: task.completedAt
          ? new Date(task.completedAt).toISOString().split("T")[0]
          : null,
      });
    }

    // Get calendar events for the month
    const allEvents = await ctx.db
      .query("lifeos_calendarEvents")
      .withIndex("by_user_start_time", (q) => q.eq("userId", userId))
      .collect();

    const monthEvents = allEvents.filter((event) => {
      if (event.status === "cancelled") return false;
      return event.startTime <= endOfMonth && event.endTime >= startOfMonth;
    });

    // Get monthly summary if available
    const monthStartDateStr = startDateObj.toISOString().split("T")[0];
    const monthlySummary = await ctx.db
      .query("lifeos_monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthStartDate", monthStartDateStr),
      )
      .first();

    // Build stats
    const byPriority: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    for (const task of relevantTasks) {
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    }

    return {
      monthStartDate: monthStartDateStr,
      monthEndDate: monthEnd.toISOString().split("T")[0],
      tasksByWeek,
      completedByWeek,
      totalEvents: monthEvents.length,
      monthSummary: monthlySummary?.aiSummary ?? null,
      stats: {
        totalPendingTasks: relevantTasks.length,
        totalCompletedTasks: completedTasks.length,
        totalEvents: monthEvents.length,
        byPriority,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 11: REGENERATE DAILY SUMMARY ====================

/**
 * Trigger regeneration of daily AI summary
 */
export const regenerateDailySummaryInternal = internalMutation({
  args: {
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // We can't call actions from mutations, so we just schedule it
    // For now, return that this needs to be called as an action
    return {
      success: true,
      message: `Daily summary regeneration scheduled for ${args.date}`,
      action: "generateDailySummary",
      params: { date: args.date, model: args.model },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 12: REGENERATE WEEKLY SUMMARY ====================

/**
 * Trigger regeneration of weekly AI summary
 */
export const regenerateWeeklySummaryInternal = internalMutation({
  args: {
    userId: v.string(),
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return {
      success: true,
      message: `Weekly summary regeneration scheduled for week of ${args.weekStartDate}`,
      action: "generateWeeklySummary",
      params: { weekStartDate: args.weekStartDate, model: args.model },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 13: REGENERATE MONTHLY SUMMARY ====================

/**
 * Trigger regeneration of monthly AI summary
 */
export const regenerateMonthlySummaryInternal = internalMutation({
  args: {
    userId: v.string(),
    monthStartDate: v.string(), // YYYY-MM-DD (1st of month)
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return {
      success: true,
      message: `Monthly summary regeneration scheduled for ${args.monthStartDate}`,
      action: "generateMonthlySummary",
      params: { monthStartDate: args.monthStartDate, model: args.model },
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== TOOL 14: UPDATE WEEKLY PROMPT ====================

/**
 * Update custom prompt for weekly summary
 */
export const updateWeeklyPromptInternal = internalMutation({
  args: {
    userId: v.string(),
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    customPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_weeklySummaries")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekStartDate", args.weekStartDate)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customPrompt: args.customPrompt,
        updatedAt: now,
      });
      return {
        success: true,
        message: `Custom prompt updated for week of ${args.weekStartDate}`,
        summaryId: existing._id,
        generatedAt: new Date().toISOString(),
      };
    } else {
      // Calculate week end date
      const weekStart = new Date(args.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const id = await ctx.db.insert("lifeos_weeklySummaries", {
        userId,
        weekStartDate: args.weekStartDate,
        weekEndDate: weekEndStr,
        customPrompt: args.customPrompt,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        message: `Custom prompt created for week of ${args.weekStartDate}`,
        summaryId: id,
        generatedAt: new Date().toISOString(),
      };
    }
  },
});

// ==================== TOOL 15: UPDATE MONTHLY PROMPT ====================

/**
 * Update custom prompt for monthly summary
 */
export const updateMonthlyPromptInternal = internalMutation({
  args: {
    userId: v.string(),
    monthStartDate: v.string(), // YYYY-MM-DD (1st of month)
    customPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const now = Date.now();

    const existing = await ctx.db
      .query("lifeos_monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthStartDate", args.monthStartDate)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customPrompt: args.customPrompt,
        updatedAt: now,
      });
      return {
        success: true,
        message: `Custom prompt updated for month of ${args.monthStartDate}`,
        summaryId: existing._id,
        generatedAt: new Date().toISOString(),
      };
    } else {
      // Calculate month end date
      const startDate = new Date(args.monthStartDate);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const monthEndStr = monthEnd.toISOString().split("T")[0];

      const id = await ctx.db.insert("lifeos_monthlySummaries", {
        userId,
        monthStartDate: args.monthStartDate,
        monthEndDate: monthEndStr,
        customPrompt: args.customPrompt,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        message: `Custom prompt created for month of ${args.monthStartDate}`,
        summaryId: id,
        generatedAt: new Date().toISOString(),
      };
    }
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
    phaseId: v.optional(v.string()),
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

    // Resolve phase if provided
    let phaseId: Id<"lifeos_pmPhases"> | undefined;
    let phaseName: string | undefined;

    if (args.phaseId) {
      try {
        const phase = await ctx.db.get(args.phaseId as Id<"lifeos_pmPhases">);
        if (phase && phase.userId === userId) {
          // Verify phase belongs to the same project
          if (!projectId || phase.projectId === projectId) {
            phaseId = phase._id;
            phaseName = phase.name;
            // If projectId wasn't provided but phase was, use the phase's project
            if (!projectId) {
              projectId = phase.projectId;
              project = await ctx.db.get(projectId);
            }
          }
        }
      } catch {
        // Invalid phase ID, ignore
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
      phaseId,
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
    if (phaseName) {
      confirmationMessage += `, phase "${phaseName}"`;
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
        phaseId,
        phaseName,
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

// ==================== PHASE MANAGEMENT TOOLS ====================

/**
 * Get all phases for a project with stats
 */
export const getPhasesInternal = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const projectId = args.projectId as Id<"lifeos_pmProjects">;

    // Verify project belongs to user
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return {
        success: false,
        error: "Project not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get all phases for the project ordered by order
    const phases = await ctx.db
      .query("lifeos_pmPhases")
      .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
      .collect();

    // Get stats for each phase
    const phasesWithStats = await Promise.all(
      phases.map(async (phase) => {
        const issues = await ctx.db
          .query("lifeos_pmIssues")
          .withIndex("by_phase", (q) => q.eq("phaseId", phase._id))
          .collect();

        const totalIssues = issues.length;
        const completedIssues = issues.filter((i) => i.status === "done").length;
        const inProgressIssues = issues.filter(
          (i) => i.status === "in_progress" || i.status === "in_review"
        ).length;

        return {
          id: phase._id,
          name: phase.name,
          description: htmlToPlainText(phase.description),
          order: phase.order,
          status: phase.status,
          startDate: phase.startDate
            ? new Date(phase.startDate).toISOString()
            : null,
          endDate: phase.endDate
            ? new Date(phase.endDate).toISOString()
            : null,
          stats: {
            totalIssues,
            completedIssues,
            inProgressIssues,
            completionPercent:
              totalIssues > 0
                ? Math.round((completedIssues / totalIssues) * 100)
                : 0,
          },
        };
      })
    );

    return {
      success: true,
      projectId,
      projectName: project.name,
      phases: phasesWithStats,
      count: phasesWithStats.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get a single phase with its issues
 */
export const getPhaseInternal = internalQuery({
  args: {
    userId: v.string(),
    phaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const phaseId = args.phaseId as Id<"lifeos_pmPhases">;

    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== userId) {
      return {
        success: false,
        error: "Phase not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get project info
    const project = await ctx.db.get(phase.projectId);

    // Get issues in this phase
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_phase", (q) => q.eq("phaseId", phaseId))
      .collect();

    // Sort by priority then sortOrder
    issues.sort((a, b) => {
      const priorityDiff =
        PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] -
        PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER];
      if (priorityDiff !== 0) return priorityDiff;
      return a.sortOrder - b.sortOrder;
    });

    const totalIssues = issues.length;
    const completedIssues = issues.filter((i) => i.status === "done").length;

    return {
      success: true,
      phase: {
        id: phase._id,
        name: phase.name,
        description: htmlToPlainText(phase.description),
        order: phase.order,
        status: phase.status,
        startDate: phase.startDate
          ? new Date(phase.startDate).toISOString()
          : null,
        endDate: phase.endDate
          ? new Date(phase.endDate).toISOString()
          : null,
        projectId: phase.projectId,
        projectName: project?.name ?? "",
        projectKey: project?.key ?? "",
      },
      issues: issues.map((issue) => ({
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        isTopPriority: issue.isTopPriority || false,
        dueDate: issue.dueDate
          ? new Date(issue.dueDate).toISOString()
          : null,
      })),
      stats: {
        totalIssues,
        completedIssues,
        completionPercent:
          totalIssues > 0
            ? Math.round((completedIssues / totalIssues) * 100)
            : 0,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Create a new phase
 */
export const createPhaseInternal = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.string(),
    name: v.string(),
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
    const projectId = args.projectId as Id<"lifeos_pmProjects">;
    const now = Date.now();

    // Verify project belongs to user
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return {
        success: false,
        error: "Project not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get max order for existing phases
    const existingPhases = await ctx.db
      .query("lifeos_pmPhases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const maxOrder =
      existingPhases.length > 0
        ? Math.max(...existingPhases.map((p) => p.order))
        : -1;

    // Validate status
    type PhaseStatus = "not_started" | "in_progress" | "completed";
    const validStatuses: PhaseStatus[] = ["not_started", "in_progress", "completed"];
    const status: PhaseStatus =
      args.status && validStatuses.includes(args.status as PhaseStatus)
        ? (args.status as PhaseStatus)
        : "not_started";

    const phaseId = await ctx.db.insert("lifeos_pmPhases", {
      userId,
      projectId,
      name: args.name.trim(),
      description: args.description?.trim(),
      order: maxOrder + 1,
      status,
      startDate: undefined,
      endDate: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      phaseId,
      name: args.name.trim(),
      projectName: project.name,
      confirmationMessage: `Created phase "${args.name.trim()}" in project ${project.name}.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Update a phase
 */
export const updatePhaseInternal = internalMutation({
  args: {
    userId: v.string(),
    phaseId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
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
    const phaseId = args.phaseId as Id<"lifeos_pmPhases">;

    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== userId) {
      return {
        success: false,
        error: "Phase not found or access denied",
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

    // Validate and set status
    if (args.status !== undefined) {
      const validStatuses = ["not_started", "in_progress", "completed"];
      if (validStatuses.includes(args.status)) {
        updates.status = args.status;
      }
    }

    // Parse dates
    if (args.startDate !== undefined) {
      if (args.startDate) {
        const parsed = new Date(args.startDate);
        if (!isNaN(parsed.getTime())) {
          updates.startDate = parsed.getTime();
        }
      } else {
        updates.startDate = undefined;
      }
    }

    if (args.endDate !== undefined) {
      if (args.endDate) {
        const parsed = new Date(args.endDate);
        if (!isNaN(parsed.getTime())) {
          updates.endDate = parsed.getTime();
        }
      } else {
        updates.endDate = undefined;
      }
    }

    await ctx.db.patch(phaseId, updates);

    return {
      success: true,
      phaseId,
      confirmationMessage: `Updated phase "${args.name ?? phase.name}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Delete a phase (unlinks issues)
 */
export const deletePhaseInternal = internalMutation({
  args: {
    userId: v.string(),
    phaseId: v.string(),
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
    const phaseId = args.phaseId as Id<"lifeos_pmPhases">;

    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== userId) {
      return {
        success: false,
        error: "Phase not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const phaseName = phase.name;

    // Unlink issues from phase
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_phase", (q) => q.eq("phaseId", phaseId))
      .collect();

    for (const issue of issues) {
      await ctx.db.patch(issue._id, {
        phaseId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete phase notes
    const notes = await ctx.db
      .query("lifeos_pmNotes")
      .withIndex("by_phase", (q) => q.eq("phaseId", phaseId))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }

    // Delete the phase
    await ctx.db.delete(phaseId);

    return {
      success: true,
      phaseName,
      unlinkedIssues: issues.length,
      confirmationMessage: `Deleted phase "${phaseName}" and unlinked ${issues.length} issues.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Assign or unassign an issue to/from a phase
 */
export const assignIssueToPhaseInternal = internalMutation({
  args: {
    userId: v.string(),
    issueIdOrIdentifier: v.string(),
    phaseId: v.optional(v.string()), // If not provided or empty, unassigns from phase
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

    // Resolve the issue
    const issue = await resolveIssue(ctx, userId, args.issueIdOrIdentifier);
    if (!issue) {
      return {
        success: false,
        error: `I couldn't find a task "${args.issueIdOrIdentifier}". Please check the task identifier and try again.`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Handle unassignment
    if (!args.phaseId) {
      if (!issue.phaseId) {
        return {
          success: false,
          error: `Task ${issue.identifier} is not assigned to any phase.`,
          generatedAt: new Date().toISOString(),
        };
      }

      const oldPhase = await ctx.db.get(issue.phaseId);
      await ctx.db.patch(issue._id, {
        phaseId: undefined,
        updatedAt: now,
      });

      return {
        success: true,
        issue: {
          id: issue._id,
          identifier: issue.identifier,
          title: issue.title,
        },
        confirmationMessage: `Removed ${issue.identifier}: "${issue.title}" from phase "${oldPhase?.name ?? "unknown"}".`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Resolve the phase
    const phaseId = args.phaseId as Id<"lifeos_pmPhases">;
    const phase = await ctx.db.get(phaseId);
    if (!phase || phase.userId !== userId) {
      return {
        success: false,
        error: "Phase not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Check if issue is in the same project as the phase
    if (issue.projectId !== phase.projectId) {
      return {
        success: false,
        error: "Issue must be in the same project as the phase",
        generatedAt: new Date().toISOString(),
      };
    }

    // Check if already in this phase
    if (issue.phaseId === phaseId) {
      return {
        success: false,
        error: `Task ${issue.identifier}: "${issue.title}" is already in phase "${phase.name}".`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Assign to phase
    await ctx.db.patch(issue._id, {
      phaseId,
      updatedAt: now,
    });

    return {
      success: true,
      issue: {
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
      },
      phase: {
        id: phase._id,
        name: phase.name,
      },
      confirmationMessage: `Assigned ${issue.identifier}: "${issue.title}" to phase "${phase.name}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== PROJECT MANAGEMENT TOOLS ====================

/**
 * Get a single project with full details and stats
 */
export const getProjectInternal = internalQuery({
  args: {
    userId: v.string(),
    projectIdOrKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    const project = await resolveProject(ctx, userId, args.projectIdOrKey);
    if (!project) {
      return {
        success: false,
        error: `Project "${args.projectIdOrKey}" not found or access denied`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Get client info if associated
    let client = null;
    if (project.clientId) {
      const clientDoc = await ctx.db.get(project.clientId);
      if (clientDoc) {
        client = { id: clientDoc._id, name: clientDoc.name };
      }
    }

    // Get phase count
    const phases = await ctx.db
      .query("lifeos_pmPhases")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    const completionPercentage =
      project.issueCount > 0
        ? Math.round((project.completedIssueCount / project.issueCount) * 100)
        : 0;

    return {
      success: true,
      project: {
        id: project._id,
        key: project.key,
        name: project.name,
        description: htmlToPlainText(project.description),
        status: project.status,
        health: project.health,
        priority: project.priority,
        issueCount: project.issueCount,
        completedIssueCount: project.completedIssueCount,
        completionPercentage,
        phaseCount: phases.length,
        client,
        createdAt: new Date(project.createdAt).toISOString(),
        updatedAt: new Date(project.updatedAt).toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Create a new project
 */
export const createProjectInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    key: v.string(),
    description: v.optional(v.string()),
    clientId: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
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
    const key = args.key.toUpperCase().trim();

    // Check if key is unique for this user
    const existingProject = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();

    if (existingProject) {
      return {
        success: false,
        error: `A project with key "${key}" already exists`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Validate status
    type ProjectStatus = "planned" | "in_progress" | "paused" | "completed" | "cancelled";
    const validStatuses: ProjectStatus[] = ["planned", "in_progress", "paused", "completed", "cancelled"];
    const status: ProjectStatus =
      args.status && validStatuses.includes(args.status as ProjectStatus)
        ? (args.status as ProjectStatus)
        : "planned";

    // Validate priority
    type Priority = "urgent" | "high" | "medium" | "low" | "none";
    const validPriorities: Priority[] = ["urgent", "high", "medium", "low", "none"];
    const priority: Priority =
      args.priority && validPriorities.includes(args.priority as Priority)
        ? (args.priority as Priority)
        : "none";

    // Validate client if provided
    let clientId: Id<"lifeos_pmClients"> | undefined;
    if (args.clientId) {
      try {
        const client = await ctx.db.get(args.clientId as Id<"lifeos_pmClients">);
        if (client && client.userId === userId) {
          clientId = client._id;
        }
      } catch {
        // Invalid client ID, ignore
      }
    }

    const projectId = await ctx.db.insert("lifeos_pmProjects", {
      userId,
      clientId,
      key,
      name: args.name.trim(),
      description: args.description?.trim(),
      status,
      health: "on_track",
      priority,
      nextIssueNumber: 1,
      issueCount: 0,
      completedIssueCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      projectId,
      key,
      name: args.name.trim(),
      confirmationMessage: `Created project "${args.name.trim()}" with key ${key}.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Update a project
 */
export const updateProjectInternal = internalMutation({
  args: {
    userId: v.string(),
    projectIdOrKey: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    health: v.optional(v.string()),
    priority: v.optional(v.string()),
    clientId: v.optional(v.string()),
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

    const project = await resolveProject(ctx, userId, args.projectIdOrKey);
    if (!project) {
      return {
        success: false,
        error: `Project "${args.projectIdOrKey}" not found or access denied`,
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

    // Validate and set status
    if (args.status !== undefined) {
      const validStatuses = ["planned", "in_progress", "paused", "completed", "cancelled"];
      if (validStatuses.includes(args.status)) {
        updates.status = args.status;
      }
    }

    // Validate and set health
    if (args.health !== undefined) {
      const validHealth = ["on_track", "at_risk", "off_track"];
      if (validHealth.includes(args.health)) {
        updates.health = args.health;
      }
    }

    // Validate and set priority
    if (args.priority !== undefined) {
      const validPriorities = ["urgent", "high", "medium", "low", "none"];
      if (validPriorities.includes(args.priority)) {
        updates.priority = args.priority;
      }
    }

    // Handle client association
    if (args.clientId !== undefined) {
      if (args.clientId) {
        try {
          const client = await ctx.db.get(args.clientId as Id<"lifeos_pmClients">);
          if (client && client.userId === userId) {
            updates.clientId = client._id;
          }
        } catch {
          // Invalid client ID, ignore
        }
      } else {
        updates.clientId = undefined;
      }
    }

    await ctx.db.patch(project._id, updates);

    return {
      success: true,
      projectId: project._id,
      projectKey: project.key,
      confirmationMessage: `Updated project "${args.name ?? project.name}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Delete a project (issues are unlinked, not deleted)
 */
export const deleteProjectInternal = internalMutation({
  args: {
    userId: v.string(),
    projectIdOrKey: v.string(),
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

    const project = await resolveProject(ctx, userId, args.projectIdOrKey);
    if (!project) {
      return {
        success: false,
        error: `Project "${args.projectIdOrKey}" not found or access denied`,
        generatedAt: new Date().toISOString(),
      };
    }

    const projectName = project.name;
    const projectKey = project.key;

    // Unlink issues from project
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    for (const issue of issues) {
      await ctx.db.patch(issue._id, {
        projectId: undefined,
        phaseId: undefined,
        updatedAt: now,
      });
    }

    // Delete phases
    const phases = await ctx.db
      .query("lifeos_pmPhases")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    for (const phase of phases) {
      // Delete phase notes
      const notes = await ctx.db
        .query("lifeos_pmNotes")
        .withIndex("by_phase", (q) => q.eq("phaseId", phase._id))
        .collect();
      for (const note of notes) {
        await ctx.db.delete(note._id);
      }
      await ctx.db.delete(phase._id);
    }

    // Delete project notes
    const projectNotes = await ctx.db
      .query("lifeos_pmNotes")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    for (const note of projectNotes) {
      await ctx.db.delete(note._id);
    }

    // Delete the project
    await ctx.db.delete(project._id);

    return {
      success: true,
      projectName,
      projectKey,
      unlinkedIssues: issues.length,
      deletedPhases: phases.length,
      confirmationMessage: `Deleted project "${projectName}" (${projectKey}). ${issues.length} issues were unlinked and ${phases.length} phases were deleted.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== ADDITIONAL ISSUE MANAGEMENT TOOLS ====================

/**
 * Get a single issue with full details
 */
export const getIssueInternal = internalQuery({
  args: {
    userId: v.string(),
    issueIdOrIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    const issue = await resolveIssue(ctx, userId, args.issueIdOrIdentifier);
    if (!issue) {
      return {
        success: false,
        error: `Issue "${args.issueIdOrIdentifier}" not found or access denied`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Get related entities
    let project = null;
    if (issue.projectId) {
      const projectDoc = await ctx.db.get(issue.projectId);
      if (projectDoc) {
        project = { id: projectDoc._id, key: projectDoc.key, name: projectDoc.name };
      }
    }

    let phase = null;
    if (issue.phaseId) {
      const phaseDoc = await ctx.db.get(issue.phaseId);
      if (phaseDoc) {
        phase = { id: phaseDoc._id, name: phaseDoc.name };
      }
    }

    let cycle = null;
    if (issue.cycleId) {
      const cycleDoc = await ctx.db.get(issue.cycleId);
      if (cycleDoc) {
        cycle = { id: cycleDoc._id, name: cycleDoc.name ?? `Cycle ${cycleDoc.number}` };
      }
    }

    return {
      success: true,
      issue: {
        id: issue._id,
        identifier: issue.identifier,
        title: issue.title,
        description: htmlToPlainText(issue.description),
        status: issue.status,
        priority: issue.priority,
        isTopPriority: issue.isTopPriority || false,
        estimate: issue.estimate,
        dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString() : null,
        completedAt: issue.completedAt ? new Date(issue.completedAt).toISOString() : null,
        project,
        phase,
        cycle,
        createdAt: new Date(issue.createdAt).toISOString(),
        updatedAt: new Date(issue.updatedAt).toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Update an issue
 */
export const updateIssueInternal = internalMutation({
  args: {
    userId: v.string(),
    issueIdOrIdentifier: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    isTopPriority: v.optional(v.boolean()),
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

    const issue = await resolveIssue(ctx, userId, args.issueIdOrIdentifier);
    if (!issue) {
      return {
        success: false,
        error: `Issue "${args.issueIdOrIdentifier}" not found or access denied`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Build updates object
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.title !== undefined) updates.title = args.title.trim();
    if (args.description !== undefined) {
      updates.description = args.description.trim() || undefined;
    }
    if (args.isTopPriority !== undefined) updates.isTopPriority = args.isTopPriority;

    // Validate and set status
    const previousStatus = issue.status;
    if (args.status !== undefined) {
      const validStatuses = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];
      if (validStatuses.includes(args.status)) {
        updates.status = args.status;

        // Handle status transitions for counts
        if (args.status === "done" && previousStatus !== "done") {
          updates.completedAt = now;

          // Update project completed count
          if (issue.projectId) {
            const project = await ctx.db.get(issue.projectId);
            if (project) {
              await ctx.db.patch(issue.projectId, {
                completedIssueCount: project.completedIssueCount + 1,
                updatedAt: now,
              });
            }
          }

          // Update cycle completed count
          if (issue.cycleId) {
            const cycle = await ctx.db.get(issue.cycleId);
            if (cycle) {
              await ctx.db.patch(issue.cycleId, {
                completedIssueCount: cycle.completedIssueCount + 1,
                updatedAt: now,
              });
            }
          }
        } else if (previousStatus === "done" && args.status !== "done") {
          // Reopening task
          updates.completedAt = undefined;

          if (issue.projectId) {
            const project = await ctx.db.get(issue.projectId);
            if (project) {
              await ctx.db.patch(issue.projectId, {
                completedIssueCount: Math.max(0, project.completedIssueCount - 1),
                updatedAt: now,
              });
            }
          }

          if (issue.cycleId) {
            const cycle = await ctx.db.get(issue.cycleId);
            if (cycle) {
              await ctx.db.patch(issue.cycleId, {
                completedIssueCount: Math.max(0, cycle.completedIssueCount - 1),
                updatedAt: now,
              });
            }
          }
        }
      }
    }

    // Validate and set priority
    if (args.priority !== undefined) {
      const validPriorities = ["urgent", "high", "medium", "low", "none"];
      if (validPriorities.includes(args.priority)) {
        updates.priority = args.priority;
      }
    }

    // Handle due date
    if (args.dueDate !== undefined) {
      if (args.dueDate) {
        const parsed = new Date(args.dueDate);
        if (!isNaN(parsed.getTime())) {
          updates.dueDate = parsed.getTime();
        }
      } else {
        updates.dueDate = undefined;
      }
    }

    await ctx.db.patch(issue._id, updates);

    return {
      success: true,
      issue: {
        id: issue._id,
        identifier: issue.identifier,
        title: args.title ?? issue.title,
      },
      confirmationMessage: `Updated issue ${issue.identifier}: "${args.title ?? issue.title}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Delete an issue permanently
 */
export const deleteIssueInternal = internalMutation({
  args: {
    userId: v.string(),
    issueIdOrIdentifier: v.string(),
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

    const issue = await resolveIssue(ctx, userId, args.issueIdOrIdentifier);
    if (!issue) {
      return {
        success: false,
        error: `Issue "${args.issueIdOrIdentifier}" not found or access denied`,
        generatedAt: new Date().toISOString(),
      };
    }

    const identifier = issue.identifier;
    const title = issue.title;

    // Update project counts
    if (issue.projectId) {
      const project = await ctx.db.get(issue.projectId);
      if (project) {
        await ctx.db.patch(issue.projectId, {
          issueCount: Math.max(0, project.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, project.completedIssueCount - 1)
              : project.completedIssueCount,
          updatedAt: now,
        });
      }
    }

    // Update cycle counts
    if (issue.cycleId) {
      const cycle = await ctx.db.get(issue.cycleId);
      if (cycle) {
        await ctx.db.patch(issue.cycleId, {
          issueCount: Math.max(0, cycle.issueCount - 1),
          completedIssueCount:
            issue.status === "done"
              ? Math.max(0, cycle.completedIssueCount - 1)
              : cycle.completedIssueCount,
          updatedAt: now,
        });
      }
    }

    // Delete the issue
    await ctx.db.delete(issue._id);

    return {
      success: true,
      identifier,
      title,
      confirmationMessage: `Deleted issue ${identifier}: "${title}".`,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== DELETE CLIENT TOOL ====================

/**
 * Delete a client (projects are unlinked, not deleted)
 */
export const deleteClientInternal = internalMutation({
  args: {
    userId: v.string(),
    clientId: v.string(),
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
    const clientIdTyped = args.clientId as Id<"lifeos_pmClients">;
    const now = Date.now();

    const client = await ctx.db.get(clientIdTyped);
    if (!client || client.userId !== userId) {
      return {
        success: false,
        error: "Client not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const clientName = client.name;

    // Unlink projects from client
    const projects = await ctx.db
      .query("lifeos_pmProjects")
      .withIndex("by_client", (q) => q.eq("clientId", clientIdTyped))
      .collect();

    for (const project of projects) {
      await ctx.db.patch(project._id, {
        clientId: undefined,
        updatedAt: now,
      });
    }

    // Delete the client
    await ctx.db.delete(clientIdTyped);

    return {
      success: true,
      clientName,
      unlinkedProjects: projects.length,
      confirmationMessage: `Deleted client "${clientName}". ${projects.length} projects were unlinked.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== CYCLE MANAGEMENT TOOLS ====================

/**
 * Get all cycles for a user
 */
export const getCyclesInternal = internalQuery({
  args: {
    userId: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 20;

    let cycles;
    if (args.status === "upcoming" || args.status === "active" || args.status === "completed") {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status as "upcoming" | "active" | "completed")
        )
        .order("desc")
        .take(limit);
    } else {
      cycles = await ctx.db
        .query("lifeos_pmCycles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    }

    const cyclesWithInfo = cycles.map((cycle) => {
      const now = Date.now();
      const daysRemaining = cycle.status === "active"
        ? Math.max(0, Math.ceil((cycle.endDate - now) / (24 * 60 * 60 * 1000)))
        : null;

      return {
        id: cycle._id,
        name: cycle.name ?? `Cycle ${cycle.number}`,
        number: cycle.number,
        status: cycle.status,
        startDate: new Date(cycle.startDate).toISOString().split("T")[0],
        endDate: new Date(cycle.endDate).toISOString().split("T")[0],
        daysRemaining,
        issueCount: cycle.issueCount,
        completedIssueCount: cycle.completedIssueCount,
        completionPercent:
          cycle.issueCount > 0
            ? Math.round((cycle.completedIssueCount / cycle.issueCount) * 100)
            : 0,
        goals: cycle.goals,
      };
    });

    return {
      cycles: cyclesWithInfo,
      count: cyclesWithInfo.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Create a new cycle
 */
export const createCycleInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    goals: v.optional(v.string()),
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

    // Parse dates
    const startDate = new Date(args.startDate);
    const endDate = new Date(args.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        success: false,
        error: "Invalid start or end date format",
        generatedAt: new Date().toISOString(),
      };
    }

    if (endDate <= startDate) {
      return {
        success: false,
        error: "End date must be after start date",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get next cycle number
    const existingCycles = await ctx.db
      .query("lifeos_pmCycles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const maxNumber = existingCycles.length > 0
      ? Math.max(...existingCycles.map((c) => c.number))
      : 0;

    const number = maxNumber + 1;

    // Determine status based on dates
    type CycleStatus = "upcoming" | "active" | "completed";
    let status: CycleStatus = "upcoming";
    if (startDate.getTime() <= now && endDate.getTime() >= now) {
      status = "active";
    } else if (endDate.getTime() < now) {
      status = "completed";
    }

    // Convert goals string to array (split by newlines or semicolons)
    let goalsArray: string[] | undefined;
    if (args.goals?.trim()) {
      goalsArray = args.goals
        .split(/[\n;]/)
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
    }

    const cycleId = await ctx.db.insert("lifeos_pmCycles", {
      userId,
      number,
      name: args.name?.trim() || undefined,
      status,
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
      goals: goalsArray,
      issueCount: 0,
      completedIssueCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const cycleName = args.name?.trim() || `Cycle ${number}`;

    return {
      success: true,
      cycleId,
      number,
      name: cycleName,
      status,
      confirmationMessage: `Created ${cycleName} from ${args.startDate} to ${args.endDate}.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Update a cycle
 */
export const updateCycleInternal = internalMutation({
  args: {
    userId: v.string(),
    cycleId: v.string(),
    name: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.string()),
    goals: v.optional(v.string()),
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
    const cycleIdTyped = args.cycleId as Id<"lifeos_pmCycles">;

    const cycle = await ctx.db.get(cycleIdTyped);
    if (!cycle || cycle.userId !== userId) {
      return {
        success: false,
        error: "Cycle not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Build updates object
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name.trim() || undefined;
    }
    if (args.goals !== undefined) {
      // Convert goals string to array (split by newlines or semicolons)
      if (args.goals.trim()) {
        updates.goals = args.goals
          .split(/[\n;]/)
          .map((g) => g.trim())
          .filter((g) => g.length > 0);
      } else {
        updates.goals = undefined;
      }
    }

    // Parse and validate dates
    if (args.startDate !== undefined) {
      const parsed = new Date(args.startDate);
      if (!isNaN(parsed.getTime())) {
        updates.startDate = parsed.getTime();
      }
    }

    if (args.endDate !== undefined) {
      const parsed = new Date(args.endDate);
      if (!isNaN(parsed.getTime())) {
        updates.endDate = parsed.getTime();
      }
    }

    // Validate and set status
    if (args.status !== undefined) {
      const validStatuses = ["upcoming", "active", "completed"];
      if (validStatuses.includes(args.status)) {
        updates.status = args.status;
      }
    }

    await ctx.db.patch(cycleIdTyped, updates);

    const cycleName = args.name?.trim() || cycle.name || `Cycle ${cycle.number}`;

    return {
      success: true,
      cycleId: cycleIdTyped,
      confirmationMessage: `Updated ${cycleName}.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Delete a cycle (issues are unlinked, not deleted)
 */
export const deleteCycleInternal = internalMutation({
  args: {
    userId: v.string(),
    cycleId: v.string(),
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
    const cycleIdTyped = args.cycleId as Id<"lifeos_pmCycles">;
    const now = Date.now();

    const cycle = await ctx.db.get(cycleIdTyped);
    if (!cycle || cycle.userId !== userId) {
      return {
        success: false,
        error: "Cycle not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const cycleName = cycle.name ?? `Cycle ${cycle.number}`;

    // Unlink issues from cycle
    const issues = await ctx.db
      .query("lifeos_pmIssues")
      .withIndex("by_cycle", (q) => q.eq("cycleId", cycleIdTyped))
      .collect();

    for (const issue of issues) {
      await ctx.db.patch(issue._id, {
        cycleId: undefined,
        updatedAt: now,
      });
    }

    // Delete the cycle
    await ctx.db.delete(cycleIdTyped);

    return {
      success: true,
      cycleName,
      unlinkedIssues: issues.length,
      confirmationMessage: `Deleted ${cycleName}. ${issues.length} issues were unlinked.`,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== BEEPER BUSINESS CONTACTS TOOLS ====================

/**
 * Get all business-marked Beeper threads
 */
export const getBeeperThreadsInternal = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 50;

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", userId).eq("isBusinessChat", true)
      )
      .order("desc")
      .take(limit);

    const threadList = threads.map((t) => ({
      id: t._id,
      threadId: t.threadId,
      threadName: t.threadName,
      threadType: t.threadType,
      participantCount: t.participantCount,
      messageCount: t.messageCount,
      lastMessageAt: new Date(t.lastMessageAt).toISOString(),
      businessNote: t.businessNote,
      linkedPersonId: t.linkedPersonId,
      linkedClientId: t.linkedClientId,
    }));

    return {
      threads: threadList,
      count: threadList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get a single Beeper thread by thread ID
 */
export const getBeeperThreadInternal = internalQuery({
  args: {
    userId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    const thread = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId)
      )
      .unique();

    if (!thread) {
      return {
        success: false,
        error: "Thread not found",
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      thread: {
        id: thread._id,
        threadId: thread.threadId,
        threadName: thread.threadName,
        threadType: thread.threadType,
        participantCount: thread.participantCount,
        messageCount: thread.messageCount,
        lastMessageAt: new Date(thread.lastMessageAt).toISOString(),
        isBusinessChat: thread.isBusinessChat,
        businessNote: thread.businessNote,
        linkedPersonId: thread.linkedPersonId,
        linkedClientId: thread.linkedClientId,
        lastSyncedAt: new Date(thread.lastSyncedAt).toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get messages for a Beeper thread
 */
export const getBeeperThreadMessagesInternal = internalQuery({
  args: {
    userId: v.string(),
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 100;

    // Verify thread belongs to user
    const thread = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId)
      )
      .unique();

    if (!thread) {
      return {
        success: false,
        error: "Thread not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const messages = await ctx.db
      .query("lifeos_beeperMessages")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId)
      )
      .order("desc")
      .take(limit);

    const messageList = messages.map((m) => ({
      id: m._id,
      sender: m.sender,
      text: m.text,
      timestamp: new Date(m.timestamp).toISOString(),
    }));

    return {
      success: true,
      threadName: thread.threadName,
      messages: messageList,
      count: messageList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Full-text search across all Beeper messages
 */
export const searchBeeperMessagesInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 50;

    if (!args.query.trim()) {
      return {
        messages: [],
        query: args.query,
        count: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const results = await ctx.db
      .query("lifeos_beeperMessages")
      .withSearchIndex("search_text", (q) =>
        q.search("text", args.query).eq("userId", userId)
      )
      .take(limit);

    const messageList = results.map((m) => ({
      id: m._id,
      threadId: m.threadId,
      sender: m.sender,
      text: m.text,
      timestamp: new Date(m.timestamp).toISOString(),
    }));

    return {
      messages: messageList,
      query: args.query,
      count: messageList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get Beeper threads linked to a FRM person
 */
export const getBeeperThreadsForPersonInternal = internalQuery({
  args: {
    userId: v.string(),
    personId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
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

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedPerson", (q) => q.eq("linkedPersonId", personId))
      .collect();

    // Filter by user (index doesn't include userId)
    const userThreads = threads.filter((t) => t.userId === userId);

    const threadList = userThreads.map((t) => ({
      id: t._id,
      threadId: t.threadId,
      threadName: t.threadName,
      threadType: t.threadType,
      messageCount: t.messageCount,
      lastMessageAt: new Date(t.lastMessageAt).toISOString(),
      businessNote: t.businessNote,
    }));

    return {
      success: true,
      personName: person.name,
      threads: threadList,
      count: threadList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get Beeper threads linked to a PM client
 */
export const getBeeperThreadsForClientInternal = internalQuery({
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

    const threads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_linkedClient", (q) => q.eq("linkedClientId", clientId))
      .collect();

    // Filter by user (index doesn't include userId)
    const userThreads = threads.filter((t) => t.userId === userId);

    const threadList = userThreads.map((t) => ({
      id: t._id,
      threadId: t.threadId,
      threadName: t.threadName,
      threadType: t.threadType,
      messageCount: t.messageCount,
      lastMessageAt: new Date(t.lastMessageAt).toISOString(),
      businessNote: t.businessNote,
    }));

    return {
      success: true,
      clientName: client.name,
      threads: threadList,
      count: threadList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== GRANOLA MEETING TOOLS ====================

/**
 * Get all synced Granola meetings
 */
export const getGranolaMeetingsInternal = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const limit = args.limit ?? 50;

    const meetings = await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    const meetingList = meetings.map((m) => ({
      id: m._id,
      granolaDocId: m.granolaDocId,
      title: m.title,
      hasTranscript: m.hasTranscript,
      granolaCreatedAt: m.granolaCreatedAt,
      resumeMarkdown: m.resumeMarkdown
        ? m.resumeMarkdown.substring(0, 500) + (m.resumeMarkdown.length > 500 ? "..." : "")
        : undefined,
      folders: m.folders,
    }));

    return {
      meetings: meetingList,
      count: meetingList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get a single Granola meeting by Granola doc ID (includes full AI notes)
 */
export const getGranolaMeetingInternal = internalQuery({
  args: {
    userId: v.string(),
    granolaDocId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    const meeting = await ctx.db
      .query("life_granolaMeetings")
      .withIndex("by_user_granola_doc_id", (q) =>
        q.eq("userId", userId).eq("granolaDocId", args.granolaDocId)
      )
      .unique();

    if (!meeting) {
      return {
        success: false,
        error: "Meeting not found",
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      meeting: {
        id: meeting._id,
        granolaDocId: meeting.granolaDocId,
        title: meeting.title,
        hasTranscript: meeting.hasTranscript,
        resumeMarkdown: meeting.resumeMarkdown,
        granolaCreatedAt: meeting.granolaCreatedAt,
        granolaUpdatedAt: meeting.granolaUpdatedAt,
        folders: meeting.folders,
        workspaceName: meeting.workspaceName,
      },
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get full transcript for a Granola meeting
 */
export const getGranolaTranscriptInternal = internalQuery({
  args: {
    userId: v.string(),
    meetingId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const meetingId = args.meetingId as Id<"life_granolaMeetings">;

    // Verify meeting belongs to user
    const meeting = await ctx.db.get(meetingId);
    if (!meeting || meeting.userId !== userId) {
      return {
        success: false,
        error: "Meeting not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const transcript = await ctx.db
      .query("life_granolaTranscripts")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .unique();

    if (!transcript) {
      return {
        success: false,
        error: "Transcript not found for this meeting",
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      meetingTitle: meeting.title,
      transcriptMarkdown: transcript.transcriptMarkdown,
      utteranceCount: transcript.utterances.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Search Granola meetings by title or content
 */
export const searchGranolaMeetingsInternal = internalQuery({
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
        meetings: [],
        query: args.query,
        count: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    // Search by title
    const titleResults = await ctx.db
      .query("life_granolaMeetings")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("userId", userId)
      )
      .take(limit);

    // Search by resume content
    const resumeResults = await ctx.db
      .query("life_granolaMeetings")
      .withSearchIndex("search_resume", (q) =>
        q.search("resumeMarkdown", args.query).eq("userId", userId)
      )
      .take(limit);

    // Deduplicate
    const seen = new Set<string>();
    const combined = [];
    for (const meeting of [...titleResults, ...resumeResults]) {
      if (!seen.has(meeting._id)) {
        seen.add(meeting._id);
        combined.push(meeting);
      }
    }

    const meetingList = combined.slice(0, limit).map((m) => ({
      id: m._id,
      granolaDocId: m.granolaDocId,
      title: m.title,
      hasTranscript: m.hasTranscript,
      granolaCreatedAt: m.granolaCreatedAt,
      resumeMarkdown: m.resumeMarkdown
        ? m.resumeMarkdown.substring(0, 300) + (m.resumeMarkdown.length > 300 ? "..." : "")
        : undefined,
    }));

    return {
      meetings: meetingList,
      query: args.query,
      count: meetingList.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== CROSS-ENTITY LINKING TOOLS ====================

/**
 * Get Granola meetings linked to a FRM person
 */
export const getGranolaMeetingsForPersonInternal = internalQuery({
  args: {
    userId: v.string(),
    personId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
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

    const links = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect();

    // Enrich with meeting info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const meeting = await ctx.db.get(link.meetingId);
        if (!meeting) return null;
        return {
          linkId: link._id,
          meetingId: meeting._id,
          meetingTitle: meeting.title,
          meetingDate: meeting.granolaCreatedAt,
          hasTranscript: meeting.hasTranscript,
          linkSource: link.linkSource,
          aiConfidence: link.aiConfidence,
        };
      })
    );

    const validLinks = enrichedLinks.filter((l): l is NonNullable<typeof l> => l !== null);

    return {
      success: true,
      personName: person.name,
      meetings: validLinks,
      count: validLinks.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get Granola meetings linked to a Beeper thread
 */
export const getGranolaMeetingsForThreadInternal = internalQuery({
  args: {
    userId: v.string(),
    beeperThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const beeperThreadId = args.beeperThreadId as Id<"lifeos_beeperThreads">;

    // Verify thread belongs to user
    const thread = await ctx.db.get(beeperThreadId);
    if (!thread || thread.userId !== userId) {
      return {
        success: false,
        error: "Thread not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    const links = await ctx.db
      .query("life_granolaMeetingLinks")
      .withIndex("by_beeperThread", (q) => q.eq("beeperThreadId", beeperThreadId))
      .collect();

    // Enrich with meeting info
    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const meeting = await ctx.db.get(link.meetingId);
        if (!meeting) return null;
        return {
          linkId: link._id,
          meetingId: meeting._id,
          meetingTitle: meeting.title,
          meetingDate: meeting.granolaCreatedAt,
          hasTranscript: meeting.hasTranscript,
          linkSource: link.linkSource,
          aiConfidence: link.aiConfidence,
        };
      })
    );

    const validLinks = enrichedLinks.filter((l): l is NonNullable<typeof l> => l !== null);

    return {
      success: true,
      threadName: thread.threadName,
      meetings: validLinks,
      count: validLinks.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== COMPOSITE / DOSSIER TOOLS ====================

/**
 * Get everything about a contact in one call:
 * person info, AI profile, Beeper threads, Granola meetings (with calendar events), and voice memos.
 * Supports lookup by personId OR fuzzy nameQuery search.
 */
export const getContactDossierInternal = internalQuery({
  args: {
    userId: v.string(),
    personId: v.optional(v.string()),
    nameQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Resolve person
    let person: Doc<"lifeos_frmPeople"> | null = null;

    if (args.nameQuery) {
      const results = await ctx.db
        .query("lifeos_frmPeople")
        .withSearchIndex("search_name", (q) =>
          q.search("name", args.nameQuery!).eq("userId", userId)
        )
        .take(1);
      person = results[0] ?? null;
    } else if (args.personId) {
      const personId = args.personId as Id<"lifeos_frmPeople">;
      const found = await ctx.db.get(personId);
      if (found && found.userId === userId) {
        person = found;
      }
    }

    if (!person) {
      return {
        success: false,
        error: args.nameQuery
          ? `No person found matching "${args.nameQuery}"`
          : "Person not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Fetch all related data in parallel
    const [
      latestProfile,
      beeperThreads,
      meetingPersonLinks,
      memoLinks,
      contactEmails,
      unifiedMeetingLinks,
    ] = await Promise.all([
      // Latest AI profile
      ctx.db
        .query("lifeos_frmProfiles")
        .withIndex("by_person_version", (q) => q.eq("personId", person!._id))
        .order("desc")
        .take(1)
        .then((r) => r[0] ?? null),

      // Beeper threads linked to this person
      ctx.db
        .query("lifeos_beeperThreads")
        .withIndex("by_linkedPerson", (q) =>
          q.eq("linkedPersonId", person!._id)
        )
        .collect(),

      // Granola meeting person links (legacy)
      ctx.db
        .query("life_granolaMeetingPersonLinks")
        .withIndex("by_person", (q) => q.eq("personId", person!._id))
        .collect(),

      // Voice memo links (most recent 20)
      ctx.db
        .query("lifeos_frmPersonMemos")
        .withIndex("by_person_created", (q) => q.eq("personId", person!._id))
        .order("desc")
        .take(20),

      // Contact emails
      ctx.db
        .query("lifeos_contactEmails")
        .withIndex("by_person", (q) => q.eq("personId", person!._id))
        .collect(),

      // Unified meeting-person links (includes Fathom, Granola, etc.)
      ctx.db
        .query("lifeos_meetingPersonLinks")
        .withIndex("by_person", (q) => q.eq("personId", person!._id))
        .collect(),
    ]);

    // Enrich granola meetings with calendar events
    const granolaMeetings = await Promise.all(
      meetingPersonLinks.map(async (link) => {
        const meeting = await ctx.db.get(link.meetingId);
        if (!meeting) return null;

        // Get calendar link for this meeting
        const calendarLinks = await ctx.db
          .query("life_granolaCalendarLinks")
          .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
          .take(1);

        let calendarEvent: {
          title: string;
          startTime: number;
          endTime: number;
          isAllDay: boolean;
          location?: string;
          attendees?: Array<{
            email: string;
            displayName?: string;
            responseStatus?: string;
          }>;
        } | null = null;

        if (calendarLinks[0]) {
          const event = await ctx.db.get(calendarLinks[0].calendarEventId);
          if (event) {
            calendarEvent = {
              title: event.title,
              startTime: event.startTime,
              endTime: event.endTime,
              isAllDay: event.isAllDay,
              location: event.location,
              attendees: event.attendees?.map((a) => ({
                email: a.email,
                displayName: a.displayName,
                responseStatus: a.responseStatus,
              })),
            };
          }
        }

        // Truncate resume markdown to keep response size manageable
        const resumeMarkdown = meeting.resumeMarkdown
          ? meeting.resumeMarkdown.substring(0, 1000) +
            (meeting.resumeMarkdown.length > 1000 ? "..." : "")
          : undefined;

        return {
          meetingId: meeting._id,
          title: meeting.title,
          granolaCreatedAt: meeting.granolaCreatedAt,
          resumeMarkdown,
          calendarEvent,
        };
      })
    );

    // Enrich Fathom meetings from unified links
    const fathomLinks = unifiedMeetingLinks.filter(
      (l) => l.meetingSource === "fathom"
    );
    const fathomMeetings = await Promise.all(
      fathomLinks.map(async (link) => {
        const meetingId = link.meetingId as Id<"life_fathomMeetings">;
        const meeting = await ctx.db.get(meetingId);
        if (!meeting) return null;

        // Truncate summary for response size
        const summaryMarkdown = meeting.summaryMarkdown
          ? meeting.summaryMarkdown.substring(0, 1000) +
            (meeting.summaryMarkdown.length > 1000 ? "..." : "")
          : undefined;

        return {
          meetingId: meeting._id,
          title: meeting.title,
          fathomCreatedAt: meeting.fathomCreatedAt,
          summaryMarkdown,
          actionItems: meeting.actionItems,
          calendarInvitees: meeting.calendarInvitees,
          fathomUrl: meeting.fathomUrl,
        };
      })
    );

    // Enrich voice memos
    const voiceMemos = await Promise.all(
      memoLinks.map(async (link) => {
        const memo = await ctx.db.get(link.voiceMemoId);
        if (!memo) return null;
        return {
          id: memo._id,
          name: memo.name,
          transcript: memo.transcript
            ? memo.transcript.substring(0, 500) +
              (memo.transcript.length > 500 ? "..." : "")
            : undefined,
          duration: memo.duration,
          context: link.context,
          createdAt: memo.createdAt,
        };
      })
    );

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
        notes: person.notes,
        memoCount: person.memoCount,
        lastInteractionAt: person.lastInteractionAt,
        autoCreatedFrom: person.autoCreatedFrom,
      },
      emails: contactEmails.map((e) => ({
        email: e.email,
        source: e.source,
        isPrimary: e.isPrimary,
      })),
      profile: latestProfile
        ? {
            confidence: latestProfile.confidence,
            communicationStyle: latestProfile.communicationStyle,
            personality: latestProfile.personality,
            tips: latestProfile.tips,
            summary: latestProfile.summary,
          }
        : null,
      beeperThreads: beeperThreads.map((t) => ({
        id: t._id,
        threadId: t.threadId,
        threadName: t.threadName,
        messageCount: t.messageCount,
        lastMessageAt: t.lastMessageAt,
      })),
      granolaMeetings: granolaMeetings.filter(
        (m): m is NonNullable<typeof m> => m !== null
      ),
      fathomMeetings: fathomMeetings.filter(
        (m): m is NonNullable<typeof m> => m !== null
      ),
      voiceMemos: voiceMemos.filter(
        (m): m is NonNullable<typeof m> => m !== null
      ),
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Get calendar events linked to a specific Granola meeting.
 */
export const getMeetingCalendarLinksInternal = internalQuery({
  args: {
    userId: v.string(),
    meetingId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const meetingId = args.meetingId as Id<"life_granolaMeetings">;

    // Get meeting and verify ownership
    const meeting = await ctx.db.get(meetingId);
    if (!meeting || meeting.userId !== userId) {
      return {
        success: false,
        error: "Meeting not found or access denied",
        generatedAt: new Date().toISOString(),
      };
    }

    // Get calendar links for this meeting
    const calendarLinks = await ctx.db
      .query("life_granolaCalendarLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .collect();

    // Enrich with full calendar event data
    const calendarEvents = await Promise.all(
      calendarLinks.map(async (link) => {
        const event = await ctx.db.get(link.calendarEventId);
        if (!event) return null;
        return {
          eventId: event._id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          location: event.location,
          attendees: event.attendees?.map((a) => ({
            email: a.email,
            displayName: a.displayName,
            responseStatus: a.responseStatus,
          })),
        };
      })
    );

    const validEvents = calendarEvents.filter(
      (e): e is NonNullable<typeof e> => e !== null
    );

    return {
      success: true,
      meetingTitle: meeting.title,
      calendarEvents: validEvents,
      count: validEvents.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

// ==================== Beeper → FRM Sync Tools ====================

/**
 * Helper: cascade Granola meeting links from a Beeper thread to a person.
 * For every `life_granolaMeetingLinks` row that references the thread,
 * creates a corresponding `life_granolaMeetingPersonLinks` row (if not already linked).
 */
async function cascadeGranolaMeetingLinks(
  ctx: MutationCtx,
  userId: Id<"users">,
  beeperThreadConvexId: Id<"lifeos_beeperThreads">,
  personId: Id<"lifeos_frmPeople">,
): Promise<number> {
  const meetingLinks = await ctx.db
    .query("life_granolaMeetingLinks")
    .withIndex("by_beeperThread", (q) => q.eq("beeperThreadId", beeperThreadConvexId))
    .collect();

  let created = 0;
  const now = Date.now();

  for (const link of meetingLinks) {
    // Check if person link already exists for this meeting
    const existing = await ctx.db
      .query("life_granolaMeetingPersonLinks")
      .withIndex("by_meeting", (q) => q.eq("meetingId", link.meetingId))
      .filter((q) => q.eq(q.field("personId"), personId))
      .first();

    if (!existing) {
      await ctx.db.insert("life_granolaMeetingPersonLinks", {
        userId,
        meetingId: link.meetingId,
        personId,
        linkSource: "manual",
        aiReason: "Auto-linked from Beeper thread sync",
        createdAt: now,
      });
      created++;
    }
  }

  return created;
}

/**
 * Bulk sync all unlinked business DM Beeper threads to FRM people.
 * Creates a new FRM person for each unlinked DM thread and cascades Granola meeting links.
 */
export const syncBeeperContactsToFrmInternal = internalMutation({
  args: {
    userId: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;
    const dryRun = args.dryRun ?? false;

    // Get all business DM threads for this user that are NOT linked to a person
    const allThreads = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_business", (q) =>
        q.eq("userId", userId).eq("isBusinessChat", true)
      )
      .collect();

    const unlinkedDmThreads = allThreads.filter(
      (t) => t.threadType === "dm" && !t.linkedPersonId
    );

    if (unlinkedDmThreads.length === 0) {
      return {
        success: true,
        message: "No unlinked DM threads found",
        createdCount: 0,
        meetingLinksCreated: 0,
        results: [],
        generatedAt: new Date().toISOString(),
      };
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        message: `Found ${unlinkedDmThreads.length} unlinked DM thread(s) that would be synced`,
        wouldCreate: unlinkedDmThreads.map((t) => ({
          threadId: t.threadId,
          threadName: t.threadName,
          messageCount: t.messageCount,
          lastMessageAt: t.lastMessageAt,
        })),
        generatedAt: new Date().toISOString(),
      };
    }

    const now = Date.now();
    const results: Array<{
      threadId: string;
      threadName: string;
      personId: string;
      meetingLinksCreated: number;
    }> = [];
    let totalMeetingLinks = 0;

    for (const thread of unlinkedDmThreads) {
      // Create FRM person
      const personId = await ctx.db.insert("lifeos_frmPeople", {
        userId,
        name: thread.threadName,
        relationshipType: "colleague",
        memoCount: 0,
        lastInteractionAt: thread.lastMessageAt || undefined,
        createdAt: now,
        updatedAt: now,
      });

      // Link thread to person
      await ctx.db.patch(thread._id, { linkedPersonId: personId, updatedAt: now });

      // Cascade Granola meeting links
      const meetingLinksCreated = await cascadeGranolaMeetingLinks(
        ctx,
        userId,
        thread._id,
        personId,
      );
      totalMeetingLinks += meetingLinksCreated;

      results.push({
        threadId: thread.threadId,
        threadName: thread.threadName,
        personId: personId as string,
        meetingLinksCreated,
      });
    }

    return {
      success: true,
      message: `Synced ${results.length} Beeper thread(s) to FRM people`,
      createdCount: results.length,
      meetingLinksCreated: totalMeetingLinks,
      results,
      generatedAt: new Date().toISOString(),
    };
  },
});

/**
 * Link a single Beeper thread to an existing or new FRM person.
 */
export const linkBeeperThreadToPersonInternal = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    personId: v.optional(v.string()),
    personName: v.optional(v.string()),
    relationshipType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId as Id<"users">;

    // Find the thread by (userId, threadId)
    const thread = await ctx.db
      .query("lifeos_beeperThreads")
      .withIndex("by_user_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId)
      )
      .first();

    if (!thread) {
      return {
        success: false,
        error: `Beeper thread not found: ${args.threadId}`,
        generatedAt: new Date().toISOString(),
      };
    }

    if (thread.linkedPersonId) {
      return {
        success: false,
        error: `Thread "${thread.threadName}" is already linked to a person`,
        linkedPersonId: thread.linkedPersonId as string,
        generatedAt: new Date().toISOString(),
      };
    }

    const now = Date.now();
    let personId: Id<"lifeos_frmPeople">;

    if (args.personId) {
      // Link to existing person — verify ownership
      const existingPerson = await ctx.db.get(
        args.personId as Id<"lifeos_frmPeople">
      );
      if (!existingPerson || existingPerson.userId !== userId) {
        return {
          success: false,
          error: "Person not found or access denied",
          generatedAt: new Date().toISOString(),
        };
      }
      personId = existingPerson._id;
    } else {
      // Create new person
      const validTypes = ["family", "friend", "colleague", "acquaintance", "mentor", "other"];
      const relationshipType =
        args.relationshipType && validTypes.includes(args.relationshipType)
          ? (args.relationshipType as "family" | "friend" | "colleague" | "acquaintance" | "mentor" | "other")
          : "colleague";

      const name = args.personName?.trim() || thread.threadName;
      personId = await ctx.db.insert("lifeos_frmPeople", {
        userId,
        name,
        relationshipType,
        memoCount: 0,
        lastInteractionAt: thread.lastMessageAt || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Link thread to person
    await ctx.db.patch(thread._id, { linkedPersonId: personId, updatedAt: now });

    // Cascade Granola meeting links
    const meetingLinksCreated = await cascadeGranolaMeetingLinks(
      ctx,
      userId,
      thread._id,
      personId,
    );

    return {
      success: true,
      threadId: thread.threadId,
      threadName: thread.threadName,
      personId: personId as string,
      personName: args.personId
        ? (await ctx.db.get(personId))?.name
        : (args.personName?.trim() || thread.threadName),
      meetingLinksCreated,
      confirmationMessage: `Linked thread "${thread.threadName}" to ${args.personId ? "existing" : "new"} contact${meetingLinksCreated > 0 ? ` (${meetingLinksCreated} Granola meeting link(s) cascaded)` : ""}`,
      generatedAt: new Date().toISOString(),
    };
  },
});
