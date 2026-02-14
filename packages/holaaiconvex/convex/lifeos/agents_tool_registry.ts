/**
 * Custom Agent Tool Registry
 *
 * Maps tool names → metadata (description, category, type, parameters).
 * Used by the agent runner to build createTool wrappers and by the UI for the tool picker.
 *
 * Source: TOOL_DEFINITIONS from tool_call.ts + AVAILABLE_TOOLS from tool_call_http.ts
 */

import { z } from "zod";

// ==================== CATEGORIES ====================

export const TOOL_CATEGORIES = [
  { id: "tasks", name: "Tasks / Issues", icon: "CheckSquare" },
  { id: "projects", name: "Projects", icon: "Folder" },
  { id: "cycles", name: "Cycles / Sprints", icon: "RefreshCw" },
  { id: "phases", name: "Phases", icon: "Layers" },
  { id: "agenda", name: "Agenda", icon: "Calendar" },
  { id: "clients", name: "Clients", icon: "Building2" },
  { id: "contacts", name: "Contacts / FRM", icon: "Users" },
  { id: "notes", name: "Notes / Journal", icon: "BookOpen" },
  { id: "voice", name: "Voice Memos", icon: "Mic" },
  { id: "ai_summaries", name: "AI Summaries", icon: "Sparkles" },
  { id: "beeper", name: "Beeper / Messaging", icon: "MessageSquare" },
  { id: "meetings", name: "Meetings / Granola", icon: "Video" },
  { id: "crm", name: "CRM / Business", icon: "Briefcase" },
  { id: "initiatives", name: "Initiatives", icon: "Target" },
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]["id"];

// ==================== TOOL METADATA ====================

export interface ToolRegistryEntry {
  name: string;
  description: string;
  category: ToolCategory;
  type: "query" | "mutation";
  parameters: z.ZodObject<z.ZodRawShape>;
}

// ==================== TOOL REGISTRY ====================

export const TOOL_REGISTRY: Record<string, ToolRegistryEntry> = {
  // ==================== TASKS / ISSUES ====================
  get_todays_tasks: {
    name: "get_todays_tasks",
    description: "Get today's tasks including top priority items",
    category: "tasks",
    type: "query",
    parameters: z.object({}),
  },
  get_tasks: {
    name: "get_tasks",
    description: "Get tasks with optional filters",
    category: "tasks",
    type: "query",
    parameters: z.object({
      projectId: z.string().optional().describe("Filter by project ID"),
      status: z.string().optional().describe("Filter by status (backlog, todo, in_progress, in_review, done, cancelled)"),
      priority: z.string().optional().describe("Filter by priority (urgent, high, medium, low, none)"),
      limit: z.number().optional().describe("Max results (default 50, max 100)"),
    }),
  },
  create_issue: {
    name: "create_issue",
    description: "Create a new task/issue. Assign to project by key and phase by name.",
    category: "tasks",
    type: "mutation",
    parameters: z.object({
      title: z.string().describe("The task title"),
      description: z.string().optional().describe("Detailed description"),
      projectIdOrKey: z.string().optional().describe("Project ID or key (e.g., KORT). Required if assigning to a phase by name."),
      priority: z.string().optional().describe("urgent, high, medium, low, none"),
      dueDate: z.string().optional().describe("ISO date string"),
      cycleId: z.string().optional().describe("Assign to specific cycle"),
      phaseNameOrId: z.string().optional().describe("Phase name (e.g. 'Building Foundation') or phase ID"),
      phaseId: z.string().optional().describe("Phase ID (deprecated, use phaseNameOrId)"),
      initiativeId: z.string().optional().describe("Link to initiative"),
    }),
  },
  mark_issue_complete: {
    name: "mark_issue_complete",
    description: "Mark a task as complete by ID or identifier (e.g., PROJ-123)",
    category: "tasks",
    type: "mutation",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
    }),
  },
  get_issue: {
    name: "get_issue",
    description: "Get a single issue/task's full details",
    category: "tasks",
    type: "query",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
    }),
  },
  update_issue: {
    name: "update_issue",
    description: "Update an issue/task's details",
    category: "tasks",
    type: "mutation",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      status: z.string().optional().describe("backlog, todo, in_progress, in_review, done, cancelled"),
      priority: z.string().optional().describe("urgent, high, medium, low, none"),
      dueDate: z.string().optional().describe("ISO date string or empty to clear"),
      isTopPriority: z.boolean().optional().describe("true/false"),
      initiativeId: z.string().optional().describe("Link to initiative"),
    }),
  },
  delete_issue: {
    name: "delete_issue",
    description: "Delete an issue/task permanently",
    category: "tasks",
    type: "mutation",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
    }),
  },

  // ==================== PROJECTS ====================
  get_projects: {
    name: "get_projects",
    description: "Get user's projects with issue counts and completion stats",
    category: "projects",
    type: "query",
    parameters: z.object({
      status: z.string().optional().describe("Filter by status (planned, in_progress, paused, completed, cancelled)"),
      includeArchived: z.boolean().optional().describe("Include archived projects (default false)"),
    }),
  },
  get_project: {
    name: "get_project",
    description: "Get a single project's details with full stats",
    category: "projects",
    type: "query",
    parameters: z.object({
      projectIdOrKey: z.string().describe("Project ID or key (e.g., ACME)"),
    }),
  },
  create_project: {
    name: "create_project",
    description: "Create a new project with a unique key",
    category: "projects",
    type: "mutation",
    parameters: z.object({
      name: z.string().describe("The project name"),
      key: z.string().describe("Unique project key (e.g., ACME, uppercase)"),
      description: z.string().optional().describe("Project description"),
      clientId: z.string().optional().describe("Associate with a client"),
      status: z.string().optional().describe("planned, in_progress, paused, completed, cancelled"),
      priority: z.string().optional().describe("urgent, high, medium, low, none"),
      initiativeId: z.string().optional().describe("Link to initiative"),
    }),
  },
  update_project: {
    name: "update_project",
    description: "Update a project's details",
    category: "projects",
    type: "mutation",
    parameters: z.object({
      projectIdOrKey: z.string().describe("Project ID or key (e.g., ACME)"),
      name: z.string().optional().describe("Updated name"),
      description: z.string().optional().describe("Updated description"),
      status: z.string().optional().describe("planned, in_progress, paused, completed, cancelled"),
      health: z.string().optional().describe("on_track, at_risk, off_track"),
      priority: z.string().optional().describe("urgent, high, medium, low, none"),
      clientId: z.string().optional().describe("Associate with a client"),
      initiativeId: z.string().optional().describe("Link to initiative"),
    }),
  },
  delete_project: {
    name: "delete_project",
    description: "Delete a project (issues are preserved but unlinked)",
    category: "projects",
    type: "mutation",
    parameters: z.object({
      projectIdOrKey: z.string().describe("Project ID or key (e.g., ACME)"),
    }),
  },

  // ==================== CYCLES / SPRINTS ====================
  get_current_cycle: {
    name: "get_current_cycle",
    description: "Get the currently active cycle with progress stats and top issues",
    category: "cycles",
    type: "query",
    parameters: z.object({}),
  },
  get_cycles: {
    name: "get_cycles",
    description: "Get all cycles/sprints for the user",
    category: "cycles",
    type: "query",
    parameters: z.object({
      status: z.string().optional().describe("Filter by status (upcoming, active, completed)"),
      limit: z.number().optional().describe("Max results (default 20)"),
    }),
  },
  create_cycle: {
    name: "create_cycle",
    description: "Create a new cycle/sprint",
    category: "cycles",
    type: "mutation",
    parameters: z.object({
      name: z.string().optional().describe("Cycle name (defaults to 'Cycle N')"),
      startDate: z.string().describe("Start date in ISO format"),
      endDate: z.string().describe("End date in ISO format"),
      goals: z.string().optional().describe("Cycle goals/objectives"),
    }),
  },
  update_cycle: {
    name: "update_cycle",
    description: "Update a cycle's details",
    category: "cycles",
    type: "mutation",
    parameters: z.object({
      cycleId: z.string().describe("Cycle ID"),
      name: z.string().optional().describe("Updated name"),
      startDate: z.string().optional().describe("Updated start date"),
      endDate: z.string().optional().describe("Updated end date"),
      status: z.string().optional().describe("upcoming, active, completed"),
      goals: z.string().optional().describe("Updated goals"),
    }),
  },
  delete_cycle: {
    name: "delete_cycle",
    description: "Delete a cycle (issues are unlinked, not deleted)",
    category: "cycles",
    type: "mutation",
    parameters: z.object({
      cycleId: z.string().describe("Cycle ID"),
    }),
  },
  close_cycle: {
    name: "close_cycle",
    description: "Close/complete a cycle, optionally rolling over incomplete issues",
    category: "cycles",
    type: "mutation",
    parameters: z.object({
      cycleId: z.string().describe("Cycle ID"),
      rolloverIncomplete: z.boolean().optional().describe("Move incomplete issues to next cycle"),
    }),
  },
  generate_cycles: {
    name: "generate_cycles",
    description: "Generate upcoming cycles based on user settings",
    category: "cycles",
    type: "mutation",
    parameters: z.object({
      count: z.number().optional().describe("Number of cycles to generate"),
    }),
  },
  assign_issue_to_cycle: {
    name: "assign_issue_to_cycle",
    description: "Assign a task to a cycle (defaults to current active cycle)",
    category: "cycles",
    type: "mutation",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
      cycleId: z.string().optional().describe("Cycle ID (defaults to active cycle)"),
    }),
  },

  // ==================== PHASES ====================
  get_phases: {
    name: "get_phases",
    description: "Get all phases for a project with issue stats",
    category: "phases",
    type: "query",
    parameters: z.object({
      projectId: z.string().describe("The project's ID"),
    }),
  },
  get_phase: {
    name: "get_phase",
    description: "Get a single phase with its issues",
    category: "phases",
    type: "query",
    parameters: z.object({
      phaseId: z.string().describe("The phase's ID"),
    }),
  },
  create_phase: {
    name: "create_phase",
    description: "Create a new phase in a project",
    category: "phases",
    type: "mutation",
    parameters: z.object({
      projectId: z.string().describe("The project's ID"),
      name: z.string().describe("The phase name"),
      description: z.string().optional().describe("Phase description (markdown supported)"),
      status: z.string().optional().describe("not_started, in_progress, or completed"),
    }),
  },
  update_phase: {
    name: "update_phase",
    description: "Update a phase's details",
    category: "phases",
    type: "mutation",
    parameters: z.object({
      phaseId: z.string().describe("The phase's ID"),
      name: z.string().optional().describe("Updated name"),
      description: z.string().optional().describe("Updated description"),
      status: z.string().optional().describe("not_started, in_progress, or completed"),
      startDate: z.string().optional().describe("ISO date string"),
      endDate: z.string().optional().describe("ISO date string"),
    }),
  },
  delete_phase: {
    name: "delete_phase",
    description: "Delete a phase (issues are unlinked, not deleted)",
    category: "phases",
    type: "mutation",
    parameters: z.object({
      phaseId: z.string().describe("The phase's ID"),
    }),
  },
  assign_issue_to_phase: {
    name: "assign_issue_to_phase",
    description: "Assign an issue to a phase, or unassign by omitting phaseId",
    category: "phases",
    type: "mutation",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
      phaseId: z.string().optional().describe("Phase ID (omit to unassign)"),
    }),
  },

  // ==================== AGENDA ====================
  get_daily_agenda: {
    name: "get_daily_agenda",
    description: "Get today's full agenda: tasks, calendar events, and voice note count",
    category: "agenda",
    type: "query",
    parameters: z.object({
      date: z.string().optional().describe("Specific date in ISO format (default: today)"),
      localTime: z.string().optional().describe("User's local time in ISO format for accurate date calculation"),
    }),
  },
  get_weekly_agenda: {
    name: "get_weekly_agenda",
    description: "Get weekly agenda: tasks and events for the next 7 days, plus AI summary",
    category: "agenda",
    type: "query",
    parameters: z.object({
      startDate: z.string().optional().describe("Start date in ISO format (default: today)"),
      localTime: z.string().optional().describe("User's local time in ISO format"),
    }),
  },
  get_monthly_agenda: {
    name: "get_monthly_agenda",
    description: "Get monthly agenda: tasks and events for the month, plus AI summary",
    category: "agenda",
    type: "query",
    parameters: z.object({
      monthStartDate: z.string().optional().describe("1st of month in ISO format"),
      localTime: z.string().optional().describe("User's local time in ISO format"),
    }),
  },
  regenerate_daily_summary: {
    name: "regenerate_daily_summary",
    description: "Regenerate AI summary for a specific day",
    category: "agenda",
    type: "mutation",
    parameters: z.object({
      date: z.string().describe("Date in ISO format (YYYY-MM-DD)"),
      model: z.string().optional().describe("AI model to use"),
    }),
  },
  regenerate_weekly_summary: {
    name: "regenerate_weekly_summary",
    description: "Regenerate AI summary for a specific week",
    category: "agenda",
    type: "mutation",
    parameters: z.object({
      weekStartDate: z.string().describe("Monday of the week in ISO format"),
      model: z.string().optional().describe("AI model to use"),
    }),
  },
  regenerate_monthly_summary: {
    name: "regenerate_monthly_summary",
    description: "Regenerate AI summary for a specific month",
    category: "agenda",
    type: "mutation",
    parameters: z.object({
      monthStartDate: z.string().describe("1st of month in ISO format"),
      model: z.string().optional().describe("AI model to use"),
    }),
  },
  update_weekly_prompt: {
    name: "update_weekly_prompt",
    description: "Update custom prompt for weekly summary generation",
    category: "agenda",
    type: "mutation",
    parameters: z.object({
      weekStartDate: z.string().describe("Monday of the week in ISO format"),
      customPrompt: z.string().describe("Custom prompt template for AI summary"),
    }),
  },
  update_monthly_prompt: {
    name: "update_monthly_prompt",
    description: "Update custom prompt for monthly summary generation",
    category: "agenda",
    type: "mutation",
    parameters: z.object({
      monthStartDate: z.string().describe("1st of month in ISO format"),
      customPrompt: z.string().describe("Custom prompt template for AI summary"),
    }),
  },

  // ==================== CLIENTS ====================
  get_clients: {
    name: "get_clients",
    description: "Get all clients with optional status filter",
    category: "clients",
    type: "query",
    parameters: z.object({
      status: z.string().optional().describe("Filter by status (active, archived)"),
    }),
  },
  get_client: {
    name: "get_client",
    description: "Get a single client's details with project stats",
    category: "clients",
    type: "query",
    parameters: z.object({
      clientId: z.string().describe("The client's ID"),
    }),
  },
  get_projects_for_client: {
    name: "get_projects_for_client",
    description: "Get all projects associated with a client",
    category: "clients",
    type: "query",
    parameters: z.object({
      clientId: z.string().describe("The client's ID"),
    }),
  },
  create_client: {
    name: "create_client",
    description: "Create a new client",
    category: "clients",
    type: "mutation",
    parameters: z.object({
      name: z.string().describe("The client's name"),
      description: z.string().optional().describe("Description of the client"),
    }),
  },
  update_client: {
    name: "update_client",
    description: "Update a client's details",
    category: "clients",
    type: "mutation",
    parameters: z.object({
      clientId: z.string().describe("The client's ID"),
      name: z.string().optional().describe("Updated name"),
      description: z.string().optional().describe("Updated description"),
      status: z.string().optional().describe("active or archived"),
    }),
  },
  delete_client: {
    name: "delete_client",
    description: "Delete a client (projects are unlinked, not deleted)",
    category: "clients",
    type: "mutation",
    parameters: z.object({
      clientId: z.string().describe("The client's ID"),
    }),
  },

  // ==================== CONTACTS / FRM ====================
  get_people: {
    name: "get_people",
    description: "Get all contacts/people with optional filters",
    category: "contacts",
    type: "query",
    parameters: z.object({
      relationshipType: z.string().optional().describe("Filter by type (family, friend, colleague, acquaintance, mentor, other)"),
      includeArchived: z.boolean().optional().describe("Include archived people"),
      limit: z.number().optional().describe("Max results (default 100)"),
    }),
  },
  get_person: {
    name: "get_person",
    description: "Get a single person's details with their AI-generated profile",
    category: "contacts",
    type: "query",
    parameters: z.object({
      personId: z.string().describe("The person's ID"),
    }),
  },
  search_people: {
    name: "search_people",
    description: "Search contacts by name using full-text search",
    category: "contacts",
    type: "query",
    parameters: z.object({
      query: z.string().describe("Search terms to find in names"),
      limit: z.number().optional().describe("Max results (default 20)"),
    }),
  },
  get_memos_for_person: {
    name: "get_memos_for_person",
    description: "Get all voice memos linked to a specific person",
    category: "contacts",
    type: "query",
    parameters: z.object({
      personId: z.string().describe("The person's ID"),
      limit: z.number().optional().describe("Max results (default 50)"),
    }),
  },
  get_person_timeline: {
    name: "get_person_timeline",
    description: "Get interaction timeline for a person or all people",
    category: "contacts",
    type: "query",
    parameters: z.object({
      personId: z.string().optional().describe("Filter to specific person"),
      limit: z.number().optional().describe("Max results (default 50)"),
    }),
  },
  create_person: {
    name: "create_person",
    description: "Create a new contact/person",
    category: "contacts",
    type: "mutation",
    parameters: z.object({
      name: z.string().describe("The person's name"),
      nickname: z.string().optional().describe("Nickname or alias"),
      relationshipType: z.string().optional().describe("family, friend, colleague, acquaintance, mentor, other"),
      avatarEmoji: z.string().optional().describe("Emoji to represent this person"),
      notes: z.string().optional().describe("User notes about this person"),
    }),
  },
  update_person: {
    name: "update_person",
    description: "Update a contact's details",
    category: "contacts",
    type: "mutation",
    parameters: z.object({
      personId: z.string().describe("The person's ID"),
      name: z.string().optional().describe("Updated name"),
      nickname: z.string().optional().describe("Updated nickname"),
      relationshipType: z.string().optional().describe("Updated relationship type"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      notes: z.string().optional().describe("Updated notes"),
    }),
  },
  link_memo_to_person: {
    name: "link_memo_to_person",
    description: "Link a voice memo to a person",
    category: "contacts",
    type: "mutation",
    parameters: z.object({
      personId: z.string().describe("The person's ID"),
      voiceMemoId: z.string().describe("The voice memo's ID"),
      context: z.string().optional().describe("Context for the link"),
    }),
  },

  // ==================== NOTES / JOURNAL ====================
  search_notes: {
    name: "search_notes",
    description: "Search voice notes/memos by content",
    category: "notes",
    type: "query",
    parameters: z.object({
      query: z.string().describe("Search terms to find in notes"),
      limit: z.number().optional().describe("Max results (default 10, max 50)"),
    }),
  },
  get_recent_notes: {
    name: "get_recent_notes",
    description: "Get recent voice notes with transcripts",
    category: "notes",
    type: "query",
    parameters: z.object({
      limit: z.number().optional().describe("Number of notes to return (default 5, max 20)"),
    }),
  },
  create_quick_note: {
    name: "create_quick_note",
    description: "Create a quick text note (captured via voice)",
    category: "notes",
    type: "mutation",
    parameters: z.object({
      content: z.string().describe("The note content"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
    }),
  },
  add_tags_to_note: {
    name: "add_tags_to_note",
    description: "Add tags to an existing note",
    category: "notes",
    type: "mutation",
    parameters: z.object({
      noteId: z.string().describe("The ID of the note"),
      tags: z.array(z.string()).describe("Tags to add"),
    }),
  },

  // ==================== VOICE MEMOS ====================
  get_voice_memo: {
    name: "get_voice_memo",
    description: "Get a single voice memo with full details including AI extraction",
    category: "voice",
    type: "query",
    parameters: z.object({
      memoId: z.string().describe("The voice memo ID"),
    }),
  },
  get_voice_memos_by_date: {
    name: "get_voice_memos_by_date",
    description: "Get voice memos within a date range with AI extractions",
    category: "voice",
    type: "query",
    parameters: z.object({
      startDate: z.string().describe("Start date in ISO format (YYYY-MM-DD)"),
      endDate: z.string().describe("End date in ISO format (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Max results (default 50, max 100)"),
    }),
  },
  get_voice_memos_by_labels: {
    name: "get_voice_memos_by_labels",
    description: "Get voice memos that have specific labels/tags from AI extraction",
    category: "voice",
    type: "query",
    parameters: z.object({
      labels: z.array(z.string()).describe("Labels to search for"),
      limit: z.number().optional().describe("Max results (default 50, max 100)"),
    }),
  },
  get_voice_memo_labels: {
    name: "get_voice_memo_labels",
    description: "Get all unique labels from voice memo extractions with counts",
    category: "voice",
    type: "query",
    parameters: z.object({}),
  },

  // ==================== AI CONVERSATION SUMMARIES ====================
  create_ai_convo_summary: {
    name: "create_ai_convo_summary",
    description: "Save a crystallized summary from an AI conversation about voice notes",
    category: "ai_summaries",
    type: "mutation",
    parameters: z.object({
      title: z.string().describe("Title for this summary"),
      summary: z.string().describe("The main summary/insights"),
      keyInsights: z.array(z.string()).optional().describe("Key insights extracted"),
      actionItems: z.array(z.string()).optional().describe("Action items that emerged"),
      ideas: z.array(z.string()).optional().describe("New ideas or plans"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      relatedMemoIds: z.array(z.string()).optional().describe("Voice memo IDs discussed"),
      summaryType: z.string().optional().describe("Type: reflection, planning, brainstorm, journal_review"),
      conversationContext: z.string().optional().describe("Topic/context of the conversation"),
    }),
  },
  get_ai_convo_summaries: {
    name: "get_ai_convo_summaries",
    description: "Get past AI conversation summaries with optional type filter",
    category: "ai_summaries",
    type: "query",
    parameters: z.object({
      summaryType: z.string().optional().describe("Filter by type (reflection, planning, etc.)"),
      limit: z.number().optional().describe("Max results (default 20, max 50)"),
    }),
  },
  get_ai_convo_summary: {
    name: "get_ai_convo_summary",
    description: "Get a single AI conversation summary with related memo details",
    category: "ai_summaries",
    type: "query",
    parameters: z.object({
      summaryId: z.string().describe("The summary ID"),
    }),
  },
  search_ai_convo_summaries: {
    name: "search_ai_convo_summaries",
    description: "Search AI conversation summaries by content",
    category: "ai_summaries",
    type: "query",
    parameters: z.object({
      query: z.string().describe("Search terms"),
      limit: z.number().optional().describe("Max results (default 10, max 50)"),
    }),
  },
  update_ai_convo_summary: {
    name: "update_ai_convo_summary",
    description: "Update an existing AI conversation summary",
    category: "ai_summaries",
    type: "mutation",
    parameters: z.object({
      summaryId: z.string().describe("The summary ID"),
      title: z.string().optional().describe("Updated title"),
      summary: z.string().optional().describe("Updated summary"),
      keyInsights: z.array(z.string()).optional().describe("Updated key insights"),
      actionItems: z.array(z.string()).optional().describe("Updated action items"),
      ideas: z.array(z.string()).optional().describe("Updated ideas"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
    }),
  },
  delete_ai_convo_summary: {
    name: "delete_ai_convo_summary",
    description: "Delete an AI conversation summary",
    category: "ai_summaries",
    type: "mutation",
    parameters: z.object({
      summaryId: z.string().describe("The summary ID"),
    }),
  },

  // ==================== BEEPER / MESSAGING ====================
  get_beeper_threads: {
    name: "get_beeper_threads",
    description: "List all business-marked Beeper threads (WhatsApp contacts)",
    category: "beeper",
    type: "query",
    parameters: z.object({
      limit: z.number().optional().describe("Max results (default 50)"),
    }),
  },
  get_beeper_thread: {
    name: "get_beeper_thread",
    description: "Get a single Beeper thread by its thread ID",
    category: "beeper",
    type: "query",
    parameters: z.object({
      threadId: z.string().describe("The Beeper thread ID string"),
    }),
  },
  get_beeper_thread_messages: {
    name: "get_beeper_thread_messages",
    description: "Get messages for a Beeper thread",
    category: "beeper",
    type: "query",
    parameters: z.object({
      threadId: z.string().describe("The Beeper thread ID string"),
      limit: z.number().optional().describe("Max results (default 100)"),
    }),
  },
  search_beeper_messages: {
    name: "search_beeper_messages",
    description: "Full-text search across all Beeper messages",
    category: "beeper",
    type: "query",
    parameters: z.object({
      query: z.string().describe("Search terms to find in messages"),
      limit: z.number().optional().describe("Max results (default 50)"),
    }),
  },
  get_beeper_threads_for_person: {
    name: "get_beeper_threads_for_person",
    description: "Get Beeper threads linked to a FRM person/contact",
    category: "beeper",
    type: "query",
    parameters: z.object({
      personId: z.string().describe("The person's ID"),
    }),
  },
  get_beeper_threads_for_client: {
    name: "get_beeper_threads_for_client",
    description: "Get Beeper threads linked to a PM client",
    category: "beeper",
    type: "query",
    parameters: z.object({
      clientId: z.string().describe("The client's ID"),
    }),
  },

  // ==================== MEETINGS / GRANOLA ====================
  get_granola_meetings: {
    name: "get_granola_meetings",
    description: "List all synced Granola meetings",
    category: "meetings",
    type: "query",
    parameters: z.object({
      limit: z.number().optional().describe("Max results (default 50)"),
    }),
  },
  get_granola_meeting: {
    name: "get_granola_meeting",
    description: "Get a single Granola meeting by its Granola doc ID (includes AI notes)",
    category: "meetings",
    type: "query",
    parameters: z.object({
      granolaDocId: z.string().describe("The Granola document ID"),
    }),
  },
  get_granola_transcript: {
    name: "get_granola_transcript",
    description: "Get full transcript for a Granola meeting",
    category: "meetings",
    type: "query",
    parameters: z.object({
      meetingId: z.string().describe("The Convex meeting ID"),
    }),
  },
  search_granola_meetings: {
    name: "search_granola_meetings",
    description: "Search Granola meetings by title or content",
    category: "meetings",
    type: "query",
    parameters: z.object({
      query: z.string().describe("Search terms"),
      limit: z.number().optional().describe("Max results (default 20)"),
    }),
  },
  get_granola_meetings_for_person: {
    name: "get_granola_meetings_for_person",
    description: "Get Granola meetings linked to a FRM person/contact",
    category: "meetings",
    type: "query",
    parameters: z.object({
      personId: z.string().describe("The person's ID"),
    }),
  },
  get_granola_meetings_for_thread: {
    name: "get_granola_meetings_for_thread",
    description: "Get Granola meetings linked to a Beeper thread",
    category: "meetings",
    type: "query",
    parameters: z.object({
      beeperThreadId: z.string().describe("The Beeper thread ID"),
    }),
  },
  get_contact_dossier: {
    name: "get_contact_dossier",
    description: "Get full contact dossier: person details, meetings, threads, memos",
    category: "meetings",
    type: "query",
    parameters: z.object({
      personId: z.string().optional().describe("The person's ID"),
      nameQuery: z.string().optional().describe("Search by name instead of ID"),
    }),
  },
  get_meeting_calendar_links: {
    name: "get_meeting_calendar_links",
    description: "Get calendar links for a meeting (Google Calendar, etc.)",
    category: "meetings",
    type: "query",
    parameters: z.object({
      meetingId: z.string().describe("The meeting ID"),
    }),
  },

  // ==================== CRM / BUSINESS ====================
  sync_beeper_contacts_to_frm: {
    name: "sync_beeper_contacts_to_frm",
    description: "Sync business Beeper contacts to FRM contacts",
    category: "crm",
    type: "mutation",
    parameters: z.object({
      dryRun: z.boolean().optional().describe("Preview without making changes"),
    }),
  },
  link_beeper_thread_to_person: {
    name: "link_beeper_thread_to_person",
    description: "Link a Beeper thread to a FRM person",
    category: "crm",
    type: "mutation",
    parameters: z.object({
      threadId: z.string().describe("The Beeper thread ID"),
      personId: z.string().optional().describe("Existing person ID"),
      personName: z.string().optional().describe("Name to create new person"),
      relationshipType: z.string().optional().describe("Relationship type for new person"),
    }),
  },
  get_business_contacts: {
    name: "get_business_contacts",
    description: "Get all business contacts from CRM",
    category: "crm",
    type: "query",
    parameters: z.object({}),
  },
  get_merge_suggestions: {
    name: "get_merge_suggestions",
    description: "Get suggestions for merging duplicate contacts",
    category: "crm",
    type: "query",
    parameters: z.object({}),
  },
  accept_merge_suggestion: {
    name: "accept_merge_suggestion",
    description: "Accept a merge suggestion to combine duplicate contacts",
    category: "crm",
    type: "mutation",
    parameters: z.object({
      suggestionId: z.string().describe("The merge suggestion ID"),
    }),
  },
  reject_merge_suggestion: {
    name: "reject_merge_suggestion",
    description: "Reject a merge suggestion",
    category: "crm",
    type: "mutation",
    parameters: z.object({
      suggestionId: z.string().describe("The merge suggestion ID"),
    }),
  },
  dismiss_all_merge_suggestions: {
    name: "dismiss_all_merge_suggestions",
    description: "Dismiss all pending merge suggestions",
    category: "crm",
    type: "mutation",
    parameters: z.object({}),
  },
  unlink_meeting_from_business_contact: {
    name: "unlink_meeting_from_business_contact",
    description: "Unlink a meeting from a business contact",
    category: "crm",
    type: "mutation",
    parameters: z.object({
      threadConvexId: z.string().describe("The thread Convex ID"),
      meetingSource: z.string().describe("Meeting source type"),
      meetingId: z.string().describe("The meeting ID"),
    }),
  },

  // ==================== INITIATIVES ====================
  get_initiatives: {
    name: "get_initiatives",
    description: "Get yearly initiatives with optional filters",
    category: "initiatives",
    type: "query",
    parameters: z.object({
      year: z.number().optional().describe("Filter by year"),
      status: z.string().optional().describe("Filter by status"),
      category: z.string().optional().describe("Filter by category"),
      includeArchived: z.boolean().optional().describe("Include archived"),
    }),
  },
  get_initiative: {
    name: "get_initiative",
    description: "Get a single initiative's details",
    category: "initiatives",
    type: "query",
    parameters: z.object({
      initiativeId: z.string().describe("The initiative ID"),
    }),
  },
  get_initiative_with_stats: {
    name: "get_initiative_with_stats",
    description: "Get initiative with linked project/issue stats",
    category: "initiatives",
    type: "query",
    parameters: z.object({
      initiativeId: z.string().describe("The initiative ID"),
    }),
  },
  create_initiative: {
    name: "create_initiative",
    description: "Create a new yearly initiative",
    category: "initiatives",
    type: "mutation",
    parameters: z.object({
      year: z.number().describe("The year"),
      title: z.string().describe("Initiative title"),
      category: z.string().describe("Initiative category"),
      description: z.string().optional().describe("Description"),
      status: z.string().optional().describe("Status"),
      targetMetric: z.string().optional().describe("Target metric"),
      manualProgress: z.number().optional().describe("Manual progress (0-100)"),
      color: z.string().optional().describe("Display color"),
      icon: z.string().optional().describe("Display icon"),
    }),
  },
  update_initiative: {
    name: "update_initiative",
    description: "Update an initiative's details",
    category: "initiatives",
    type: "mutation",
    parameters: z.object({
      initiativeId: z.string().describe("The initiative ID"),
      title: z.string().optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      category: z.string().optional().describe("Updated category"),
      status: z.string().optional().describe("Updated status"),
      targetMetric: z.string().optional().describe("Updated target metric"),
      manualProgress: z.number().optional().describe("Updated progress"),
      color: z.string().optional().describe("Updated color"),
      icon: z.string().optional().describe("Updated icon"),
    }),
  },
  archive_initiative: {
    name: "archive_initiative",
    description: "Archive an initiative",
    category: "initiatives",
    type: "mutation",
    parameters: z.object({
      initiativeId: z.string().describe("The initiative ID"),
    }),
  },
  delete_initiative: {
    name: "delete_initiative",
    description: "Delete an initiative",
    category: "initiatives",
    type: "mutation",
    parameters: z.object({
      initiativeId: z.string().describe("The initiative ID"),
    }),
  },
  link_project_to_initiative: {
    name: "link_project_to_initiative",
    description: "Link a project to an initiative",
    category: "initiatives",
    type: "mutation",
    parameters: z.object({
      projectIdOrKey: z.string().describe("Project ID or key"),
      initiativeId: z.string().optional().describe("Initiative ID (omit to unlink)"),
    }),
  },
  link_issue_to_initiative: {
    name: "link_issue_to_initiative",
    description: "Link an issue to an initiative",
    category: "initiatives",
    type: "mutation",
    parameters: z.object({
      issueIdOrIdentifier: z.string().describe("Issue ID or identifier"),
      initiativeId: z.string().optional().describe("Initiative ID (omit to unlink)"),
    }),
  },
  get_initiative_yearly_rollup: {
    name: "get_initiative_yearly_rollup",
    description: "Get yearly initiative rollup with stats",
    category: "initiatives",
    type: "query",
    parameters: z.object({
      year: z.number().describe("The year"),
    }),
  },
};

/** Get all tool names */
export const ALL_TOOL_NAMES = Object.keys(TOOL_REGISTRY);

/** Get tools for a specific category */
export function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[] {
  return Object.values(TOOL_REGISTRY).filter((t) => t.category === category);
}
