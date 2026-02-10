import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from '@livekit/agents';
import { z } from 'zod';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Convex API configuration
const CONVEX_URL = process.env.CONVEX_URL || 'https://keen-nightingale-310.convex.site';
const TOOL_CALL_API_KEY = 'tool-call-secret-key-2024';

// Log configuration on startup
console.log('[VoiceAgent] ========================================');
console.log('[VoiceAgent] Voice Agent Starting');
console.log('[VoiceAgent] CONVEX_URL:', CONVEX_URL);
console.log('[VoiceAgent] LIVEKIT_URL:', process.env.LIVEKIT_URL || 'not set (using default)');
console.log('[VoiceAgent] Environment:', CONVEX_URL.includes('keen-nightingale-310') ? 'DEV' :
  CONVEX_URL.includes('agreeable-ibex-949') ? 'PROD' : 'PREVIEW');
console.log('[VoiceAgent] ========================================');

// Available tools on the backend - matches AVAILABLE_TOOLS in tool_call_http.ts
type ToolName =
  // Task/Project tools
  | 'get_todays_tasks'
  | 'get_projects'
  | 'get_project'
  | 'create_project'
  | 'update_project'
  | 'delete_project'
  | 'get_tasks'
  // Notes/Journal tools
  | 'search_notes'
  | 'get_recent_notes'
  | 'create_quick_note'
  | 'add_tags_to_note'
  // Voice Notes Deep Dive tools
  | 'get_voice_memo'
  | 'get_voice_memos_by_date'
  | 'get_voice_memos_by_labels'
  | 'get_voice_memo_labels'
  // AI Conversation Summary tools
  | 'create_ai_convo_summary'
  | 'get_ai_convo_summaries'
  | 'get_ai_convo_summary'
  | 'search_ai_convo_summaries'
  | 'update_ai_convo_summary'
  | 'delete_ai_convo_summary'
  // Agenda tools
  | 'get_daily_agenda'
  | 'get_weekly_agenda'
  | 'get_monthly_agenda'
  | 'regenerate_daily_summary'
  | 'regenerate_weekly_summary'
  | 'regenerate_monthly_summary'
  | 'update_weekly_prompt'
  | 'update_monthly_prompt'
  // Issue Management tools
  | 'create_issue'
  | 'mark_issue_complete'
  | 'get_issue'
  | 'update_issue'
  | 'delete_issue'
  // Cycle Management tools
  | 'get_current_cycle'
  | 'get_cycles'
  | 'create_cycle'
  | 'update_cycle'
  | 'delete_cycle'
  | 'close_cycle'
  | 'generate_cycles'
  | 'assign_issue_to_cycle'
  // FRM (Friend Relationship Management) tools
  | 'get_people'
  | 'get_person'
  | 'search_people'
  | 'get_memos_for_person'
  | 'get_person_timeline'
  | 'create_person'
  | 'update_person'
  | 'link_memo_to_person'
  // Client Management tools
  | 'get_clients'
  | 'get_client'
  | 'get_projects_for_client'
  | 'create_client'
  | 'update_client'
  | 'delete_client'
  // Phase Management tools
  | 'get_phases'
  | 'get_phase'
  | 'create_phase'
  | 'update_phase'
  | 'delete_phase'
  | 'assign_issue_to_phase'
  // Beeper Business Contacts tools
  | 'get_beeper_threads'
  | 'get_beeper_thread'
  | 'get_beeper_thread_messages'
  | 'search_beeper_messages'
  | 'get_beeper_threads_for_person'
  | 'get_beeper_threads_for_client'
  // Granola Meeting tools
  | 'get_granola_meetings'
  | 'get_granola_meeting'
  | 'get_granola_transcript'
  | 'search_granola_meetings'
  // Cross-Entity Linking tools
  | 'get_granola_meetings_for_person'
  | 'get_granola_meetings_for_thread'
  // Composite tools
  | 'get_contact_dossier'
  | 'get_meeting_calendar_links'
  // Beeper → FRM Sync tools
  | 'sync_beeper_contacts_to_frm'
  | 'link_beeper_thread_to_person'
  // CRM / Business Contact tools
  | 'get_business_contacts'
  | 'get_merge_suggestions'
  | 'accept_merge_suggestion'
  | 'reject_merge_suggestion'
  | 'dismiss_all_merge_suggestions'
  | 'unlink_meeting_from_business_contact'
  // Initiative Management tools
  | 'get_initiatives'
  | 'get_initiative'
  | 'get_initiative_with_stats'
  | 'create_initiative'
  | 'update_initiative'
  | 'archive_initiative'
  | 'delete_initiative'
  | 'link_project_to_initiative'
  | 'link_issue_to_initiative'
  | 'get_initiative_yearly_rollup';

/**
 * Call a tool on the Convex backend via the unified /tool-call endpoint
 */
async function callConvexTool(
  toolName: ToolName,
  userId: string,
  params?: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const url = `${CONVEX_URL}/tool-call`;
  console.log(`[VoiceAgent] Calling tool ${toolName} at:`, url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TOOL_CALL_API_KEY,
      },
      body: JSON.stringify({
        tool: toolName,
        userId,
        params,
      }),
    });

    console.log('[VoiceAgent] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VoiceAgent] Tool failed with response:', errorText);
      return { success: false, error: `API error: ${errorText}` };
    }

    const data = await response.json();
    console.log(`[VoiceAgent] Tool ${toolName} response:`, data.success ? 'success' : data.error);

    if (!data.success) {
      return { success: false, error: data.error };
    }

    return { success: true, result: data.result };
  } catch (error) {
    console.error('[VoiceAgent] Tool fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Supported models across providers
const SUPPORTED_MODELS = [
  // Gemini models
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  // OpenAI models
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-5-mini',
  'gpt-4.1-mini',
  'gpt-5.1-codex-mini',
] as const;
type ModelId = (typeof SUPPORTED_MODELS)[number];

function isValidModel(model: string): model is ModelId {
  return SUPPORTED_MODELS.includes(model as ModelId);
}

function isGeminiModel(model: ModelId): boolean {
  return model.startsWith('gemini-');
}

function createLLM(model: ModelId): google.LLM | openai.LLM {
  if (isGeminiModel(model)) {
    return new google.LLM({ model });
  }
  return new openai.LLM({ model });
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    // Connect first to receive participant info
    await ctx.connect();

    // Wait for the first participant (the user) to get their metadata
    const participant = await ctx.waitForParticipant();

    // Parse model, userId, localTime, and timezone from participant metadata
    let selectedModel: ModelId = 'gemini-3-flash-preview'; // default
    let userId: string | undefined;
    let localTime: string | undefined;
    let timezone: string | undefined;
    try {
      console.log('[VoiceAgent] Raw participant metadata:', participant.metadata);
      if (participant.metadata) {
        const metadata = JSON.parse(participant.metadata);
        console.log('[VoiceAgent] Parsed metadata:', metadata);
        if (metadata.model && isValidModel(metadata.model)) {
          selectedModel = metadata.model;
        }
        if (metadata.userId) {
          userId = metadata.userId;
        }
        if (metadata.localTime) {
          localTime = metadata.localTime;
        }
        if (metadata.timezone) {
          timezone = metadata.timezone;
        }
      }
    } catch (e) {
      console.log('[VoiceAgent] Could not parse participant metadata, using default model. Error:', e);
    }

    console.log(`[VoiceAgent] Using model: ${selectedModel}, userId: ${userId || 'NOT PROVIDED - tools will fail!'}, timezone: ${timezone || 'unknown'}`);
    if (!userId) {
      console.warn('[VoiceAgent] WARNING: No userId in metadata. All tools requiring user context will return errors.');
    }

    // Helper to create voice tools with standard execute pattern
    const makeTool = (
      backendName: ToolName,
      description: string,
      parameters: z.ZodObject<z.ZodRawShape>,
      opts?: { passLocalTime?: boolean }
    ) => {
      const execute = async (params: Record<string, unknown>) => {
        console.log(`[VoiceAgent] Tool ${backendName} called`, Object.keys(params || {}).length > 0 ? JSON.stringify(params) : '');
        if (!userId) {
          console.error('[VoiceAgent] Tool failed: No userId available');
          return { error: 'User not authenticated.' };
        }
        const hasParams = params && Object.keys(params).length > 0;
        const callParams = opts?.passLocalTime
          ? { ...(hasParams ? params : {}), localTime }
          : hasParams ? params : undefined;
        const response = await callConvexTool(backendName, userId, callParams);
        if (!response.success) {
          return { error: response.error };
        }
        return response.result;
      };
      return llm.tool({ description, parameters, execute });
    };

    // Create agent with ALL LifeOS tools
    const assistant = new voice.Agent({
      instructions: `You are a helpful voice AI assistant for LifeOS - a personal productivity and life management system. You have access to a comprehensive set of tools to help manage all aspects of the user's professional and personal life.

User's timezone: ${timezone || 'unknown'}
User's local time when connected: ${localTime || 'unknown'}

Available capabilities:
- **Agenda**: Daily, weekly, and monthly agendas with AI summaries
- **Tasks/Issues**: Create, update, complete, delete tasks; filter by project/status/priority
- **Projects**: Full project CRUD, status tracking, completion stats
- **Cycles/Sprints**: Manage sprint cycles, assign tasks, track progress
- **Phases**: Organize project work into phases/milestones
- **Clients**: Client management for consulting/freelance work
- **Contacts/People (FRM)**: Contact management with relationship tracking
- **Voice Notes**: Search, browse, and explore voice memos with AI extractions
- **AI Conversation Summaries**: Save and search crystallized insights from conversations
- **Meetings (Granola)**: Access meeting notes, transcripts, and search meetings
- **Messages (Beeper)**: Access synced WhatsApp/Beeper threads and messages
- **Contact Dossier**: Get everything about a person in one call
- **Business Contacts/CRM**: Manage business contacts and merge suggestions
- **Initiatives**: Yearly goal tracking that cascades to projects and tasks

Please be concise in your responses as this is voice interaction. When referencing tasks, use their identifiers (like PROJ-123) when available.`,
      tools: {
        // ==================== AGENDA ====================
        get_my_daily_agenda: makeTool('get_daily_agenda',
          "Get today's full agenda: tasks due today, calendar events, top priorities, and voice note count.",
          z.object({
            date: z.string().optional().describe('Specific date in YYYY-MM-DD format. Defaults to today.'),
          }),
          { passLocalTime: true },
        ),
        get_my_weekly_agenda: makeTool('get_weekly_agenda',
          "Get weekly agenda: tasks and events for the next 7 days, plus AI weekly summary.",
          z.object({
            startDate: z.string().optional().describe('Start date in YYYY-MM-DD format. Defaults to today.'),
          }),
          { passLocalTime: true },
        ),
        get_my_monthly_agenda: makeTool('get_monthly_agenda',
          "Get monthly agenda: tasks and events for the month, plus AI monthly summary.",
          z.object({
            monthStartDate: z.string().optional().describe("First day of month like '2024-01-01'. Defaults to current month."),
          }),
          { passLocalTime: true },
        ),
        regenerate_daily_summary: makeTool('regenerate_daily_summary',
          "Regenerate the AI summary for a specific day.",
          z.object({
            date: z.string().describe("Date in YYYY-MM-DD format."),
            model: z.string().optional().describe('AI model to use. Default: openai/gpt-4o-mini'),
          }),
        ),
        regenerate_weekly_summary: makeTool('regenerate_weekly_summary',
          "Regenerate the AI summary for a specific week.",
          z.object({
            weekStartDate: z.string().describe("Monday of the week in YYYY-MM-DD format."),
            model: z.string().optional().describe('AI model to use. Default: openai/gpt-4o-mini'),
          }),
        ),
        regenerate_monthly_summary: makeTool('regenerate_monthly_summary',
          "Regenerate the AI summary for a specific month.",
          z.object({
            monthStartDate: z.string().describe("First day of month in YYYY-MM-DD format."),
            model: z.string().optional().describe('AI model to use. Default: openai/gpt-4o-mini'),
          }),
        ),
        update_weekly_prompt: makeTool('update_weekly_prompt',
          "Update the custom prompt used for generating weekly summaries.",
          z.object({
            weekStartDate: z.string().describe("Monday of the week in YYYY-MM-DD format."),
            customPrompt: z.string().describe('Custom prompt template for AI summary generation.'),
          }),
        ),
        update_monthly_prompt: makeTool('update_monthly_prompt',
          "Update the custom prompt used for generating monthly summaries.",
          z.object({
            monthStartDate: z.string().describe("First day of month in YYYY-MM-DD format."),
            customPrompt: z.string().describe('Custom prompt template for AI summary generation.'),
          }),
        ),

        // ==================== TASKS / ISSUES ====================
        get_my_todays_tasks: makeTool('get_todays_tasks',
          "Get today's tasks: tasks due today and top priority items.",
          z.object({}),
        ),
        get_my_tasks: makeTool('get_tasks',
          "Get tasks with optional filters by project, status, or priority.",
          z.object({
            projectId: z.string().optional().describe('Filter by project ID'),
            status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional().describe('Filter by status'),
            priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().describe('Filter by priority'),
            limit: z.number().optional().describe('Max results (default 50, max 100)'),
          }),
        ),
        get_issue: makeTool('get_issue',
          "Get a single task/issue's full details. Accepts ID or identifier like 'PROJ-123'.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
          }),
        ),
        create_new_task: makeTool('create_issue',
          "Create a new task. Can assign to a project (by key like 'ACME'), set priority, due date, cycle, phase, or initiative.",
          z.object({
            title: z.string().describe('Task title'),
            description: z.string().optional().describe('Detailed description'),
            projectIdOrKey: z.string().optional().describe("Project ID or key like 'ACME'"),
            priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().describe('Priority level'),
            dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
            cycleId: z.string().optional().describe('Assign to a specific cycle'),
            phaseId: z.string().optional().describe('Assign to a specific phase'),
            initiativeId: z.string().optional().describe('Link to a yearly initiative'),
          }),
        ),
        update_task: makeTool('update_issue',
          "Update a task's details. Accepts ID or identifier like 'PROJ-123'.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
            title: z.string().optional().describe('Updated title'),
            description: z.string().optional().describe('Updated description'),
            status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional().describe('Updated status'),
            priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().describe('Updated priority'),
            dueDate: z.string().optional().describe('Due date in YYYY-MM-DD, or empty to clear'),
            isTopPriority: z.boolean().optional().describe('Mark as top priority'),
            initiativeId: z.string().optional().describe('Link to initiative, or empty to unlink'),
          }),
        ),
        mark_task_complete: makeTool('mark_issue_complete',
          "Mark a task as complete. Accepts identifier like 'ACME-45' or ID.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Task identifier like 'ACME-45' or ID"),
          }),
        ),
        delete_task: makeTool('delete_issue',
          "Delete a task permanently. Accepts ID or identifier like 'PROJ-123'.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
          }),
        ),

        // ==================== PROJECTS ====================
        get_my_projects: makeTool('get_projects',
          "Get projects with status and completion stats.",
          z.object({
            status: z.enum(['planned', 'in_progress', 'paused', 'completed', 'cancelled']).optional().describe('Filter by status'),
            includeArchived: z.boolean().optional().describe('Include archived projects'),
          }),
        ),
        get_project: makeTool('get_project',
          "Get a single project's full details with stats.",
          z.object({
            projectIdOrKey: z.string().describe("Project ID or key like 'ACME'"),
          }),
        ),
        create_project: makeTool('create_project',
          "Create a new project with a unique key.",
          z.object({
            name: z.string().describe('Project name'),
            key: z.string().describe("Unique project key like 'ACME', uppercase"),
            description: z.string().optional().describe('Project description'),
            clientId: z.string().optional().describe('Associate with a client'),
            status: z.enum(['planned', 'in_progress', 'paused', 'completed', 'cancelled']).optional().describe('Status (default: planned)'),
            priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().describe('Priority level'),
            initiativeId: z.string().optional().describe('Link to a yearly initiative'),
          }),
        ),
        update_project: makeTool('update_project',
          "Update a project's details.",
          z.object({
            projectIdOrKey: z.string().describe("Project ID or key like 'ACME'"),
            name: z.string().optional().describe('Updated name'),
            description: z.string().optional().describe('Updated description'),
            status: z.enum(['planned', 'in_progress', 'paused', 'completed', 'cancelled']).optional().describe('Updated status'),
            health: z.enum(['on_track', 'at_risk', 'off_track']).optional().describe('Updated health'),
            priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']).optional().describe('Updated priority'),
            clientId: z.string().optional().describe('Associate with client, or empty to unlink'),
            initiativeId: z.string().optional().describe('Link to initiative, or empty to unlink'),
          }),
        ),
        delete_project: makeTool('delete_project',
          "Delete a project. Issues are preserved but unlinked.",
          z.object({
            projectIdOrKey: z.string().describe("Project ID or key like 'ACME'"),
          }),
        ),

        // ==================== CYCLES / SPRINTS ====================
        get_my_current_cycle: makeTool('get_current_cycle',
          "Get the active cycle/sprint with progress stats, days remaining, and top priority issues.",
          z.object({}),
        ),
        get_cycles: makeTool('get_cycles',
          "Get all cycles/sprints with stats and progress.",
          z.object({
            status: z.enum(['upcoming', 'active', 'completed']).optional().describe('Filter by cycle status'),
            limit: z.number().optional().describe('Max results (default 20)'),
          }),
        ),
        create_cycle: makeTool('create_cycle',
          "Create a new cycle/sprint.",
          z.object({
            name: z.string().optional().describe("Cycle name (defaults to 'Cycle N')"),
            startDate: z.string().describe('Start date in YYYY-MM-DD format'),
            endDate: z.string().describe('End date in YYYY-MM-DD format'),
            goals: z.string().optional().describe('Cycle goals/objectives'),
          }),
        ),
        update_cycle: makeTool('update_cycle',
          "Update a cycle's details.",
          z.object({
            cycleId: z.string().describe('Cycle ID'),
            name: z.string().optional().describe('Updated name'),
            startDate: z.string().optional().describe('Updated start date'),
            endDate: z.string().optional().describe('Updated end date'),
            status: z.enum(['upcoming', 'active', 'completed']).optional().describe('Updated status'),
            goals: z.string().optional().describe('Updated goals'),
          }),
        ),
        delete_cycle: makeTool('delete_cycle',
          "Delete a cycle. Issues in the cycle are unlinked.",
          z.object({
            cycleId: z.string().describe('Cycle ID'),
          }),
        ),
        close_cycle: makeTool('close_cycle',
          "Close/complete a cycle. Can optionally roll over incomplete issues to next cycle.",
          z.object({
            cycleId: z.string().describe('Cycle ID to close'),
            rolloverIncomplete: z.boolean().optional().describe('Move incomplete issues to next cycle'),
          }),
        ),
        generate_cycles: makeTool('generate_cycles',
          "Generate upcoming cycles based on cycle settings (duration, start day, timezone).",
          z.object({
            count: z.number().optional().describe('Number of cycles to generate'),
          }),
        ),
        add_task_to_cycle: makeTool('assign_issue_to_cycle',
          "Add a task to a cycle/sprint. Defaults to current active cycle if no cycleId specified.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Task identifier like 'ACME-45' or ID"),
            cycleId: z.string().optional().describe('Specific cycle ID. Defaults to current active cycle.'),
          }),
        ),

        // ==================== PHASES ====================
        get_phases: makeTool('get_phases',
          "Get all phases for a project with issue stats.",
          z.object({
            projectId: z.string().describe('Project ID'),
          }),
        ),
        get_phase: makeTool('get_phase',
          "Get a single phase with its issues.",
          z.object({
            phaseId: z.string().describe('Phase ID'),
          }),
        ),
        create_phase: makeTool('create_phase',
          "Create a new phase in a project to organize work into stages.",
          z.object({
            projectId: z.string().describe('Project ID'),
            name: z.string().describe('Phase name'),
            description: z.string().optional().describe('Phase description'),
            status: z.enum(['not_started', 'in_progress', 'completed']).optional().describe('Status (default: not_started)'),
          }),
        ),
        update_phase: makeTool('update_phase',
          "Update a phase's details.",
          z.object({
            phaseId: z.string().describe('Phase ID'),
            name: z.string().optional().describe('Updated name'),
            description: z.string().optional().describe('Updated description'),
            status: z.enum(['not_started', 'in_progress', 'completed']).optional().describe('Updated status'),
            startDate: z.string().optional().describe('Start date in YYYY-MM-DD'),
            endDate: z.string().optional().describe('End date in YYYY-MM-DD'),
          }),
        ),
        delete_phase: makeTool('delete_phase',
          "Delete a phase. Issues are unlinked, not deleted.",
          z.object({
            phaseId: z.string().describe('Phase ID'),
          }),
        ),
        assign_issue_to_phase: makeTool('assign_issue_to_phase',
          "Assign a task to a phase, or unassign by omitting phaseId.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
            phaseId: z.string().optional().describe('Phase ID. Omit to unassign from current phase.'),
          }),
        ),

        // ==================== CLIENTS ====================
        get_clients: makeTool('get_clients',
          "Get all clients for consulting/freelance work.",
          z.object({
            status: z.enum(['active', 'archived']).optional().describe('Filter by status'),
          }),
        ),
        get_client: makeTool('get_client',
          "Get a single client's details with project statistics.",
          z.object({
            clientId: z.string().describe('Client ID'),
          }),
        ),
        get_projects_for_client: makeTool('get_projects_for_client',
          "Get all projects associated with a client.",
          z.object({
            clientId: z.string().describe('Client ID'),
          }),
        ),
        create_client: makeTool('create_client',
          "Create a new client.",
          z.object({
            name: z.string().describe('Client name'),
            description: z.string().optional().describe('Description'),
          }),
        ),
        update_client: makeTool('update_client',
          "Update a client's details.",
          z.object({
            clientId: z.string().describe('Client ID'),
            name: z.string().optional().describe('Updated name'),
            description: z.string().optional().describe('Updated description'),
            status: z.enum(['active', 'archived']).optional().describe('Updated status'),
          }),
        ),
        delete_client: makeTool('delete_client',
          "Delete a client. Projects are unlinked, not deleted.",
          z.object({
            clientId: z.string().describe('Client ID'),
          }),
        ),

        // ==================== CONTACTS / PEOPLE (FRM) ====================
        get_people: makeTool('get_people',
          "Get all contacts/people with optional filters.",
          z.object({
            relationshipType: z.enum(['family', 'friend', 'colleague', 'acquaintance', 'mentor', 'other']).optional().describe('Filter by relationship type'),
            includeArchived: z.boolean().optional().describe('Include archived contacts'),
            limit: z.number().optional().describe('Max results (default 100)'),
          }),
        ),
        get_person: makeTool('get_person',
          "Get a person's details with AI-generated profile, communication style, and relationship tips.",
          z.object({
            personId: z.string().describe('Person ID'),
          }),
        ),
        search_people: makeTool('search_people',
          "Search contacts by name.",
          z.object({
            query: z.string().describe('Search terms to find in names'),
            limit: z.number().optional().describe('Max results (default 20)'),
          }),
        ),
        create_person: makeTool('create_person',
          "Create a new contact/person.",
          z.object({
            name: z.string().describe('Person name'),
            nickname: z.string().optional().describe('Nickname or alias'),
            relationshipType: z.enum(['family', 'friend', 'colleague', 'acquaintance', 'mentor', 'other']).optional().describe('Relationship type'),
            avatarEmoji: z.string().optional().describe('Emoji to represent this person'),
            notes: z.string().optional().describe('Notes about this person'),
          }),
        ),
        update_person: makeTool('update_person',
          "Update a contact's details.",
          z.object({
            personId: z.string().describe('Person ID'),
            name: z.string().optional().describe('Updated name'),
            nickname: z.string().optional().describe('Updated nickname'),
            relationshipType: z.enum(['family', 'friend', 'colleague', 'acquaintance', 'mentor', 'other']).optional().describe('Updated relationship type'),
            email: z.string().optional().describe('Email address'),
            phone: z.string().optional().describe('Phone number'),
            notes: z.string().optional().describe('Updated notes'),
          }),
        ),
        get_memos_for_person: makeTool('get_memos_for_person',
          "Get all voice memos linked to a specific person.",
          z.object({
            personId: z.string().describe('Person ID'),
            limit: z.number().optional().describe('Max results (default 50)'),
          }),
        ),
        get_person_timeline: makeTool('get_person_timeline',
          "Get interaction timeline for a person or all people. Shows voice memos and notes chronologically.",
          z.object({
            personId: z.string().optional().describe('Filter to specific person (omit for all)'),
            limit: z.number().optional().describe('Max results (default 50)'),
          }),
        ),
        link_memo_to_person: makeTool('link_memo_to_person',
          "Link a voice memo to a person.",
          z.object({
            personId: z.string().describe('Person ID'),
            voiceMemoId: z.string().describe('Voice memo ID'),
            context: z.string().optional().describe("Context like 'Phone call', 'Coffee meetup'"),
          }),
        ),

        // ==================== NOTES / VOICE MEMOS ====================
        search_my_notes: makeTool('search_notes',
          "Search voice notes by content.",
          z.object({
            query: z.string().describe('Search terms to find in voice notes'),
            limit: z.number().optional().describe('Max results (default 10, max 50)'),
          }),
        ),
        get_my_recent_notes: makeTool('get_recent_notes',
          "Get recent voice notes with transcripts.",
          z.object({
            limit: z.number().optional().describe('Number of notes to return (default 5, max 20)'),
          }),
        ),
        create_quick_note: makeTool('create_quick_note',
          "Create a quick text note to capture thoughts.",
          z.object({
            content: z.string().describe('Note content'),
            tags: z.array(z.string()).optional().describe('Tags for categorization'),
          }),
        ),
        add_tags_to_note: makeTool('add_tags_to_note',
          "Add tags to an existing note.",
          z.object({
            noteId: z.string().describe('Note ID'),
            tags: z.array(z.string()).describe('Tags to add'),
          }),
        ),
        get_voice_memo: makeTool('get_voice_memo',
          "Get a single voice memo with full details: transcript, AI summary, labels, action items, key points, sentiment.",
          z.object({
            memoId: z.string().describe('Voice memo ID'),
          }),
        ),
        get_voice_memos_by_date: makeTool('get_voice_memos_by_date',
          "Get voice memos within a date range with transcripts and AI extractions.",
          z.object({
            startDate: z.string().describe('Start date in YYYY-MM-DD format'),
            endDate: z.string().describe('End date in YYYY-MM-DD format'),
            limit: z.number().optional().describe('Max results (default 50, max 100)'),
          }),
        ),
        get_voice_memos_by_labels: makeTool('get_voice_memos_by_labels',
          "Get voice memos by specific labels/tags from AI extraction. Matches are fuzzy/partial.",
          z.object({
            labels: z.array(z.string()).describe('Labels to search for'),
            limit: z.number().optional().describe('Max results (default 50, max 100)'),
          }),
        ),
        get_voice_memo_labels: makeTool('get_voice_memo_labels',
          "Get all unique labels from voice memo AI extractions with counts. Discover what topics exist.",
          z.object({}),
        ),

        // ==================== AI CONVERSATION SUMMARIES ====================
        create_ai_convo_summary: makeTool('create_ai_convo_summary',
          "Save a crystallized summary from a conversation. Preserve insights, plans, and ideas.",
          z.object({
            title: z.string().describe('Summary title'),
            summary: z.string().describe('Main summary/insights'),
            keyInsights: z.array(z.string()).optional().describe('Key insights extracted'),
            actionItems: z.array(z.string()).optional().describe('Action items'),
            ideas: z.array(z.string()).optional().describe('Ideas or plans formulated'),
            tags: z.array(z.string()).optional().describe('Tags for categorization'),
            relatedMemoIds: z.array(z.string()).optional().describe('IDs of related voice memos'),
            summaryType: z.string().optional().describe('Type: reflection, planning, brainstorm, journal_review, idea_refinement'),
            conversationContext: z.string().optional().describe('Topic/context of the conversation'),
          }),
        ),
        get_ai_convo_summaries: makeTool('get_ai_convo_summaries',
          "Get past AI conversation summaries. Review previous crystallized insights.",
          z.object({
            summaryType: z.string().optional().describe('Filter by type: reflection, planning, brainstorm, journal_review'),
            limit: z.number().optional().describe('Max results (default 20, max 50)'),
          }),
        ),
        get_ai_convo_summary: makeTool('get_ai_convo_summary',
          "Get a single AI conversation summary with full details.",
          z.object({
            summaryId: z.string().describe('Summary ID'),
          }),
        ),
        search_ai_convo_summaries: makeTool('search_ai_convo_summaries',
          "Search AI conversation summaries by content.",
          z.object({
            query: z.string().describe('Search terms'),
            limit: z.number().optional().describe('Max results (default 10, max 50)'),
          }),
        ),
        update_ai_convo_summary: makeTool('update_ai_convo_summary',
          "Update an existing AI conversation summary.",
          z.object({
            summaryId: z.string().describe('Summary ID'),
            title: z.string().optional().describe('Updated title'),
            summary: z.string().optional().describe('Updated summary'),
            keyInsights: z.array(z.string()).optional().describe('Updated key insights'),
            actionItems: z.array(z.string()).optional().describe('Updated action items'),
            ideas: z.array(z.string()).optional().describe('Updated ideas'),
            tags: z.array(z.string()).optional().describe('Updated tags'),
          }),
        ),
        delete_ai_convo_summary: makeTool('delete_ai_convo_summary',
          "Delete an AI conversation summary.",
          z.object({
            summaryId: z.string().describe('Summary ID'),
          }),
        ),

        // ==================== BEEPER THREADS / MESSAGES ====================
        get_beeper_threads: makeTool('get_beeper_threads',
          "List all business-marked Beeper threads (WhatsApp contacts synced via Beeper).",
          z.object({
            limit: z.number().optional().describe('Max results (default 50)'),
          }),
        ),
        get_beeper_thread: makeTool('get_beeper_thread',
          "Get a single Beeper thread by its thread ID.",
          z.object({
            threadId: z.string().describe('Beeper thread ID'),
          }),
        ),
        get_beeper_thread_messages: makeTool('get_beeper_thread_messages',
          "Get messages for a Beeper thread.",
          z.object({
            threadId: z.string().describe('Beeper thread ID'),
            limit: z.number().optional().describe('Max results (default 100)'),
          }),
        ),
        search_beeper_messages: makeTool('search_beeper_messages',
          "Full-text search across all synced Beeper messages.",
          z.object({
            query: z.string().describe('Search terms'),
            limit: z.number().optional().describe('Max results (default 50)'),
          }),
        ),
        get_beeper_threads_for_person: makeTool('get_beeper_threads_for_person',
          "Get Beeper threads linked to a contact/person.",
          z.object({
            personId: z.string().describe('Person ID'),
          }),
        ),
        get_beeper_threads_for_client: makeTool('get_beeper_threads_for_client',
          "Get Beeper threads linked to a client.",
          z.object({
            clientId: z.string().describe('Client ID'),
          }),
        ),

        // ==================== GRANOLA MEETINGS ====================
        get_granola_meetings: makeTool('get_granola_meetings',
          "List all synced Granola meeting notes.",
          z.object({
            limit: z.number().optional().describe('Max results (default 50)'),
          }),
        ),
        get_granola_meeting: makeTool('get_granola_meeting',
          "Get a single Granola meeting with full AI-generated notes.",
          z.object({
            granolaDocId: z.string().describe('Granola document ID'),
          }),
        ),
        get_granola_transcript: makeTool('get_granola_transcript',
          "Get the full transcript for a Granola meeting.",
          z.object({
            meetingId: z.string().describe('Convex meeting ID'),
          }),
        ),
        search_granola_meetings: makeTool('search_granola_meetings',
          "Search Granola meetings by title or content.",
          z.object({
            query: z.string().describe('Search terms'),
            limit: z.number().optional().describe('Max results (default 20)'),
          }),
        ),

        // ==================== CROSS-ENTITY LINKING ====================
        get_granola_meetings_for_person: makeTool('get_granola_meetings_for_person',
          "Get Granola meetings linked to a contact/person.",
          z.object({
            personId: z.string().describe('Person ID'),
          }),
        ),
        get_granola_meetings_for_thread: makeTool('get_granola_meetings_for_thread',
          "Get Granola meetings linked to a Beeper thread.",
          z.object({
            beeperThreadId: z.string().describe('Beeper thread Convex ID'),
          }),
        ),

        // ==================== COMPOSITE / DOSSIER ====================
        get_contact_dossier: makeTool('get_contact_dossier',
          "Get everything about a contact in one call: person info, AI profile, Beeper threads, meetings, voice memos, emails. Supports lookup by ID or fuzzy name search.",
          z.object({
            personId: z.string().optional().describe('Person ID (provide this OR nameQuery)'),
            nameQuery: z.string().optional().describe('Fuzzy name search (provide this OR personId)'),
          }),
        ),
        get_meeting_calendar_links: makeTool('get_meeting_calendar_links',
          "Get calendar events linked to a Granola meeting, including attendees.",
          z.object({
            meetingId: z.string().describe('Convex meeting ID'),
          }),
        ),

        // ==================== BEEPER → FRM SYNC ====================
        sync_beeper_contacts_to_frm: makeTool('sync_beeper_contacts_to_frm',
          "Bulk sync all unlinked business Beeper threads to contacts. Creates a new contact for each unlinked thread.",
          z.object({
            dryRun: z.boolean().optional().describe('Preview without making changes (default: false)'),
          }),
        ),
        link_beeper_thread_to_person: makeTool('link_beeper_thread_to_person',
          "Link a Beeper thread to an existing or new contact. If personId is provided, links to existing. Otherwise creates new.",
          z.object({
            threadId: z.string().describe('Beeper thread ID'),
            personId: z.string().optional().describe('Existing person ID to link to'),
            personName: z.string().optional().describe('Name for new person (defaults to thread name)'),
            relationshipType: z.string().optional().describe('Relationship type (default: colleague)'),
          }),
        ),

        // ==================== CRM / BUSINESS CONTACTS ====================
        get_business_contacts: makeTool('get_business_contacts',
          "Get all business contacts with linked person/client info and meeting counts.",
          z.object({}),
        ),
        get_merge_suggestions: makeTool('get_merge_suggestions',
          "Get pending contact merge suggestions. Returns pairs that may be duplicates.",
          z.object({}),
        ),
        accept_merge_suggestion: makeTool('accept_merge_suggestion',
          "Accept a merge suggestion and merge contacts. Re-links all memos, threads, and meetings.",
          z.object({
            suggestionId: z.string().describe('Merge suggestion ID'),
          }),
        ),
        reject_merge_suggestion: makeTool('reject_merge_suggestion',
          "Reject a merge suggestion. Won't appear again.",
          z.object({
            suggestionId: z.string().describe('Merge suggestion ID'),
          }),
        ),
        dismiss_all_merge_suggestions: makeTool('dismiss_all_merge_suggestions',
          "Dismiss all pending merge suggestions at once.",
          z.object({}),
        ),
        unlink_meeting_from_business_contact: makeTool('unlink_meeting_from_business_contact',
          "Remove the link between a meeting and a business contact.",
          z.object({
            threadConvexId: z.string().describe('Convex ID of the Beeper thread'),
            meetingSource: z.enum(['granola', 'fathom']).describe("Meeting source: 'granola' or 'fathom'"),
            meetingId: z.string().describe('Meeting ID'),
          }),
        ),

        // ==================== INITIATIVES ====================
        get_initiatives: makeTool('get_initiatives',
          "Get yearly initiatives (highest-order goals like 'Career Growth'). Cascades to projects and tasks.",
          z.object({
            year: z.number().optional().describe('Filter by year, e.g. 2026'),
            status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional().describe('Filter by status'),
            category: z.enum(['career', 'health', 'learning', 'relationships', 'finance', 'personal']).optional().describe('Filter by category'),
            includeArchived: z.boolean().optional().describe('Include archived initiatives'),
          }),
        ),
        get_initiative: makeTool('get_initiative',
          "Get a single initiative's details.",
          z.object({
            initiativeId: z.string().describe('Initiative ID'),
          }),
        ),
        get_initiative_with_stats: makeTool('get_initiative_with_stats',
          "Get an initiative with full stats: linked projects, tasks, completion counts, progress.",
          z.object({
            initiativeId: z.string().describe('Initiative ID'),
          }),
        ),
        create_initiative: makeTool('create_initiative',
          "Create a new yearly initiative/goal.",
          z.object({
            year: z.number().describe('Year, e.g. 2026'),
            title: z.string().describe('Initiative title'),
            category: z.enum(['career', 'health', 'learning', 'relationships', 'finance', 'personal']).describe('Category'),
            description: z.string().optional().describe('Description'),
            status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional().describe('Status (default: active)'),
            targetMetric: z.string().optional().describe('Target metric'),
            manualProgress: z.number().optional().describe('Manual progress (0-100)'),
            color: z.string().optional().describe('Display color'),
            icon: z.string().optional().describe('Display icon'),
          }),
        ),
        update_initiative: makeTool('update_initiative',
          "Update an initiative's details.",
          z.object({
            initiativeId: z.string().describe('Initiative ID'),
            title: z.string().optional().describe('Updated title'),
            description: z.string().optional().describe('Updated description'),
            category: z.enum(['career', 'health', 'learning', 'relationships', 'finance', 'personal']).optional().describe('Updated category'),
            status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional().describe('Updated status'),
            targetMetric: z.string().optional().describe('Updated target metric'),
            manualProgress: z.number().optional().describe('Updated manual progress (0-100)'),
            color: z.string().optional().describe('Updated color'),
            icon: z.string().optional().describe('Updated icon'),
          }),
        ),
        archive_initiative: makeTool('archive_initiative',
          "Archive an initiative.",
          z.object({
            initiativeId: z.string().describe('Initiative ID'),
          }),
        ),
        delete_initiative: makeTool('delete_initiative',
          "Delete an initiative permanently.",
          z.object({
            initiativeId: z.string().describe('Initiative ID'),
          }),
        ),
        link_project_to_initiative: makeTool('link_project_to_initiative',
          "Link a project to an initiative, or unlink by omitting initiativeId.",
          z.object({
            projectIdOrKey: z.string().describe("Project ID or key like 'ACME'"),
            initiativeId: z.string().optional().describe('Initiative ID. Omit to unlink.'),
          }),
        ),
        link_issue_to_initiative: makeTool('link_issue_to_initiative',
          "Link a task/issue directly to an initiative, or unlink by omitting initiativeId.",
          z.object({
            issueIdOrIdentifier: z.string().describe("Issue ID or identifier like PROJ-123"),
            initiativeId: z.string().optional().describe('Initiative ID. Omit to unlink.'),
          }),
        ),
        get_initiative_yearly_rollup: makeTool('get_initiative_yearly_rollup',
          "Get yearly rollup of all initiatives with progress and stats.",
          z.object({
            year: z.number().describe('Year, e.g. 2026'),
          }),
        ),
      },
    });

    // Create session with dynamic model (Gemini or OpenAI for LLM, OpenAI for STT/TTS)
    const session = new voice.AgentSession({
      vad,
      stt: new openai.STT(),
      llm: createLLM(selectedModel),
      tts: new openai.TTS({ voice: 'alloy' }),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
    });

    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    session.generateReply({
      instructions: `Greet the user briefly. You are their LifeOS voice assistant with full access to their productivity system. Offer to help with their agenda, tasks, projects, clients, contacts, meetings, notes, or initiatives.`,
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
