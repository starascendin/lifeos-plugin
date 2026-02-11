import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { authenticateToolCall } from "../_lib/http_utils";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

// ==================== TOOL CALL API ====================

// Available tools and their internal query mappings
export const AVAILABLE_TOOLS = [
  // Task/Project tools
  "get_todays_tasks",
  "get_projects",
  "get_project",
  "create_project",
  "update_project",
  "delete_project",
  "get_tasks",
  // Notes/Journal tools
  "search_notes",
  "get_recent_notes",
  "create_quick_note",
  "add_tags_to_note",
  // Voice Notes Deep Dive tools
  "get_voice_memo",
  "get_voice_memos_by_date",
  "get_voice_memos_by_labels",
  "get_voice_memo_labels",
  // AI Conversation Summary tools
  "create_ai_convo_summary",
  "get_ai_convo_summaries",
  "get_ai_convo_summary",
  "search_ai_convo_summaries",
  "update_ai_convo_summary",
  "delete_ai_convo_summary",
  // Agenda tools
  "get_daily_agenda",
  "get_weekly_agenda",
  "get_monthly_agenda",
  "regenerate_daily_summary",
  "regenerate_weekly_summary",
  "regenerate_monthly_summary",
  "update_weekly_prompt",
  "update_monthly_prompt",
  // Issue Management tools
  "create_issue",
  "mark_issue_complete",
  "get_issue",
  "update_issue",
  "delete_issue",
  // Cycle Management tools
  "get_current_cycle",
  "get_cycles",
  "create_cycle",
  "update_cycle",
  "delete_cycle",
  "close_cycle",
  "generate_cycles",
  "assign_issue_to_cycle",
  // FRM (Friend Relationship Management) tools
  "get_people",
  "get_person",
  "search_people",
  "get_memos_for_person",
  "get_person_timeline",
  "create_person",
  "update_person",
  "link_memo_to_person",
  // Client Management tools
  "get_clients",
  "get_client",
  "get_projects_for_client",
  "create_client",
  "update_client",
  "delete_client",
  // Phase Management tools
  "get_phases",
  "get_phase",
  "create_phase",
  "update_phase",
  "delete_phase",
  "assign_issue_to_phase",
  // Beeper Business Contacts tools
  "get_beeper_threads",
  "get_beeper_thread",
  "get_beeper_thread_messages",
  "search_beeper_messages",
  "get_beeper_threads_for_person",
  "get_beeper_threads_for_client",
  // Granola Meeting tools
  "get_granola_meetings",
  "get_granola_meeting",
  "get_granola_transcript",
  "search_granola_meetings",
  // Cross-Entity Linking tools
  "get_granola_meetings_for_person",
  "get_granola_meetings_for_thread",
  // Composite tools
  "get_contact_dossier",
  "get_meeting_calendar_links",
  // Beeper → FRM Sync tools
  "sync_beeper_contacts_to_frm",
  "link_beeper_thread_to_person",
  // CRM / Business Contact tools
  "get_business_contacts",
  "get_merge_suggestions",
  "accept_merge_suggestion",
  "reject_merge_suggestion",
  "dismiss_all_merge_suggestions",
  "unlink_meeting_from_business_contact",
  // Initiative Management tools
  "get_initiatives",
  "get_initiative",
  "get_initiative_with_stats",
  "create_initiative",
  "update_initiative",
  "archive_initiative",
  "delete_initiative",
  "link_project_to_initiative",
  "link_issue_to_initiative",
  "get_initiative_yearly_rollup",
] as const;
type ToolName = (typeof AVAILABLE_TOOLS)[number];

/**
 * Unified tool call endpoint
 * POST /tool-call
 *
 * Auth: X-API-Key header OR Authorization: Bearer token
 * Body: { tool: string, userId?: string, params?: object }
 *
 * Note: userId required for API key auth, derived from token for Bearer auth
 *
 * Available tools:
 * - get_todays_tasks: Get today's tasks (due today + top priority)
 * - get_projects: Get user's projects with summary stats
 * - get_tasks: Get tasks with optional filters
 * - search_notes: Search voice notes by content
 * - get_recent_notes: Get recent voice notes
 * - create_quick_note: Create a text note via voice
 * - add_tags_to_note: Add tags to an existing note
 */
export const toolCallHandler = httpAction(async (ctx, request) => {
  try {
    // Parse request body
    const body = (await request.json()) as {
      tool: string;
      userId?: string;
      params?: Record<string, unknown>;
    };
    const { tool, params } = body;

    // Validate tool name
    if (!tool || !AVAILABLE_TOOLS.includes(tool as ToolName)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown tool: ${tool}`,
          availableTools: AVAILABLE_TOOLS,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Authenticate
    const auth = await authenticateToolCall(ctx, request, body);
    if (!auth.userId) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Route to appropriate tool handler
    let result: unknown;

    switch (tool as ToolName) {
      case "get_todays_tasks":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getTodaysTasksInternal,
          {
            userId: auth.userId,
          },
        );
        break;

      case "get_projects":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getProjectsInternal,
          {
            userId: auth.userId,
            status: params?.status as string | undefined,
            includeArchived: params?.includeArchived as boolean | undefined,
          },
        );
        break;

      case "get_project":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getProjectInternal,
          {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
          },
        );
        break;

      case "create_project":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createProjectInternal,
          {
            userId: auth.userId,
            name: params?.name as string,
            key: params?.key as string,
            description: params?.description as string | undefined,
            clientId: params?.clientId as string | undefined,
            status: params?.status as string | undefined,
            priority: params?.priority as string | undefined,
            initiativeId: params?.initiativeId as string | undefined,
          },
        );
        break;

      case "update_project":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateProjectInternal,
          {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
            name: params?.name as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            health: params?.health as string | undefined,
            priority: params?.priority as string | undefined,
            clientId: params?.clientId as string | undefined,
            initiativeId: params?.initiativeId as string | undefined,
          },
        );
        break;

      case "delete_project":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deleteProjectInternal,
          {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
          },
        );
        break;

      case "get_tasks":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getTasksInternal,
          {
            userId: auth.userId,
            projectId: params?.projectId as string | undefined,
            status: params?.status as string | undefined,
            priority: params?.priority as string | undefined,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      // Notes/Journal tools
      case "search_notes":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.searchNotesInternal,
          {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_recent_notes":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getRecentNotesInternal,
          {
            userId: auth.userId,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "create_quick_note":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createQuickNoteInternal,
          {
            userId: auth.userId,
            content: params?.content as string,
            tags: params?.tags as string[] | undefined,
          },
        );
        break;

      case "add_tags_to_note":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.addTagsToNoteInternal,
          {
            userId: auth.userId,
            noteId: params?.noteId as string,
            tags: params?.tags as string[],
          },
        );
        break;

      // Voice Notes Deep Dive tools
      case "get_voice_memo":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getVoiceMemoInternal,
          {
            userId: auth.userId,
            memoId: params?.memoId as string,
          },
        );
        break;

      case "get_voice_memos_by_date":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getVoiceMemosByDateInternal,
          {
            userId: auth.userId,
            startDate: params?.startDate as string,
            endDate: params?.endDate as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_voice_memos_by_labels":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getVoiceMemosByLabelsInternal,
          {
            userId: auth.userId,
            labels: params?.labels as string[],
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_voice_memo_labels":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getVoiceMemoLabelsInternal,
          {
            userId: auth.userId,
          },
        );
        break;

      // AI Conversation Summary tools
      case "create_ai_convo_summary":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createAiConvoSummaryInternal,
          {
            userId: auth.userId,
            title: params?.title as string,
            summary: params?.summary as string,
            keyInsights: params?.keyInsights as string[] | undefined,
            actionItems: params?.actionItems as string[] | undefined,
            ideas: params?.ideas as string[] | undefined,
            tags: params?.tags as string[] | undefined,
            relatedMemoIds: params?.relatedMemoIds as string[] | undefined,
            summaryType: params?.summaryType as string | undefined,
            conversationContext: params?.conversationContext as
              | string
              | undefined,
            rawConversation: params?.rawConversation as string | undefined,
          },
        );
        break;

      case "get_ai_convo_summaries":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getAiConvoSummariesInternal,
          {
            userId: auth.userId,
            summaryType: params?.summaryType as string | undefined,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_ai_convo_summary":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getAiConvoSummaryInternal,
          {
            userId: auth.userId,
            summaryId: params?.summaryId as string,
          },
        );
        break;

      case "search_ai_convo_summaries":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.searchAiConvoSummariesInternal,
          {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "update_ai_convo_summary":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateAiConvoSummaryInternal,
          {
            userId: auth.userId,
            summaryId: params?.summaryId as string,
            title: params?.title as string | undefined,
            summary: params?.summary as string | undefined,
            keyInsights: params?.keyInsights as string[] | undefined,
            actionItems: params?.actionItems as string[] | undefined,
            ideas: params?.ideas as string[] | undefined,
            tags: params?.tags as string[] | undefined,
          },
        );
        break;

      case "delete_ai_convo_summary":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deleteAiConvoSummaryInternal,
          {
            userId: auth.userId,
            summaryId: params?.summaryId as string,
          },
        );
        break;

      // Agenda tools
      case "get_daily_agenda":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getDailyAgendaInternal,
          {
            userId: auth.userId,
            date: params?.date as string | undefined,
            localTime: params?.localTime as string | undefined,
          },
        );
        break;

      case "get_weekly_agenda":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getWeeklyAgendaInternal,
          {
            userId: auth.userId,
            startDate: params?.startDate as string | undefined,
            localTime: params?.localTime as string | undefined,
          },
        );
        break;

      case "get_monthly_agenda":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getMonthlyAgendaInternal,
          {
            userId: auth.userId,
            monthStartDate: params?.monthStartDate as string | undefined,
            localTime: params?.localTime as string | undefined,
          },
        );
        break;

      case "regenerate_daily_summary":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.regenerateDailySummaryInternal,
          {
            userId: auth.userId,
            date: params?.date as string,
            model: params?.model as string | undefined,
          },
        );
        break;

      case "regenerate_weekly_summary":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.regenerateWeeklySummaryInternal,
          {
            userId: auth.userId,
            weekStartDate: params?.weekStartDate as string,
            model: params?.model as string | undefined,
          },
        );
        break;

      case "regenerate_monthly_summary":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.regenerateMonthlySummaryInternal,
          {
            userId: auth.userId,
            monthStartDate: params?.monthStartDate as string,
            model: params?.model as string | undefined,
          },
        );
        break;

      case "update_weekly_prompt":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateWeeklyPromptInternal,
          {
            userId: auth.userId,
            weekStartDate: params?.weekStartDate as string,
            customPrompt: params?.customPrompt as string,
          },
        );
        break;

      case "update_monthly_prompt":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateMonthlyPromptInternal,
          {
            userId: auth.userId,
            monthStartDate: params?.monthStartDate as string,
            customPrompt: params?.customPrompt as string,
          },
        );
        break;

      // Issue Management tools
      case "create_issue":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createIssueInternal,
          {
            userId: auth.userId,
            title: params?.title as string,
            description: params?.description as string | undefined,
            projectIdOrKey: params?.projectIdOrKey as string | undefined,
            priority: params?.priority as string | undefined,
            dueDate: params?.dueDate as string | undefined,
            cycleId: params?.cycleId as string | undefined,
            phaseId: params?.phaseId as string | undefined,
            initiativeId: params?.initiativeId as string | undefined,
          },
        );
        break;

      case "mark_issue_complete":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.markIssueCompleteInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
          },
        );
        break;

      case "get_issue":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getIssueInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
          },
        );
        break;

      case "update_issue":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateIssueInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            title: params?.title as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            priority: params?.priority as string | undefined,
            dueDate: params?.dueDate as string | undefined,
            isTopPriority: params?.isTopPriority as boolean | undefined,
            initiativeId: params?.initiativeId as string | undefined,
          },
        );
        break;

      case "delete_issue":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deleteIssueInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
          },
        );
        break;

      // Cycle Management tools
      case "get_current_cycle":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getCurrentCycleInternal,
          {
            userId: auth.userId,
          },
        );
        break;

      case "assign_issue_to_cycle":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.assignIssueToCycleInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            cycleId: params?.cycleId as string | undefined,
          },
        );
        break;

      case "get_cycles":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getCyclesInternal,
          {
            userId: auth.userId,
            status: params?.status as string | undefined,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "create_cycle":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createCycleInternal,
          {
            userId: auth.userId,
            name: params?.name as string | undefined,
            startDate: params?.startDate as string,
            endDate: params?.endDate as string,
            goals: params?.goals as string | undefined,
          },
        );
        break;

      case "update_cycle":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateCycleInternal,
          {
            userId: auth.userId,
            cycleId: params?.cycleId as string,
            name: params?.name as string | undefined,
            startDate: params?.startDate as string | undefined,
            endDate: params?.endDate as string | undefined,
            status: params?.status as string | undefined,
            goals: params?.goals as string | undefined,
          },
        );
        break;

      case "delete_cycle":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deleteCycleInternal,
          {
            userId: auth.userId,
            cycleId: params?.cycleId as string,
          },
        );
        break;

      case "close_cycle":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.closeCycleInternal,
          {
            userId: auth.userId,
            cycleId: params?.cycleId as string,
            rolloverIncomplete: params?.rolloverIncomplete as
              | boolean
              | undefined,
          },
        );
        break;

      case "generate_cycles":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.generateCyclesInternal,
          {
            userId: auth.userId,
            count: params?.count as number | undefined,
          },
        );
        break;

      // FRM (Friend Relationship Management) tools
      case "get_people":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getPeopleInternal,
          {
            userId: auth.userId,
            relationshipType: params?.relationshipType as string | undefined,
            includeArchived: params?.includeArchived as boolean | undefined,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_person":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getPersonInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string,
          },
        );
        break;

      case "search_people":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.searchPeopleInternal,
          {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_memos_for_person":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getMemosForPersonInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_person_timeline":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getPersonTimelineInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string | undefined,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "create_person":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createPersonInternal,
          {
            userId: auth.userId,
            name: params?.name as string,
            nickname: params?.nickname as string | undefined,
            relationshipType: params?.relationshipType as string | undefined,
            avatarEmoji: params?.avatarEmoji as string | undefined,
            notes: params?.notes as string | undefined,
          },
        );
        break;

      case "update_person":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updatePersonInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string,
            name: params?.name as string | undefined,
            nickname: params?.nickname as string | undefined,
            relationshipType: params?.relationshipType as string | undefined,
            email: params?.email as string | undefined,
            phone: params?.phone as string | undefined,
            notes: params?.notes as string | undefined,
          },
        );
        break;

      case "link_memo_to_person":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.linkMemoToPersonInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string,
            voiceMemoId: params?.voiceMemoId as string,
            context: params?.context as string | undefined,
          },
        );
        break;

      // Client Management tools
      case "get_clients":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getClientsInternal,
          {
            userId: auth.userId,
            status: params?.status as string | undefined,
          },
        );
        break;

      case "get_client":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getClientInternal,
          {
            userId: auth.userId,
            clientId: params?.clientId as string,
          },
        );
        break;

      case "get_projects_for_client":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getProjectsForClientInternal,
          {
            userId: auth.userId,
            clientId: params?.clientId as string,
          },
        );
        break;

      case "create_client":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createClientInternal,
          {
            userId: auth.userId,
            name: params?.name as string,
            description: params?.description as string | undefined,
          },
        );
        break;

      case "update_client":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateClientInternal,
          {
            userId: auth.userId,
            clientId: params?.clientId as string,
            name: params?.name as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
          },
        );
        break;

      case "delete_client":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deleteClientInternal,
          {
            userId: auth.userId,
            clientId: params?.clientId as string,
          },
        );
        break;

      // Phase Management tools
      case "get_phases":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getPhasesInternal,
          {
            userId: auth.userId,
            projectId: params?.projectId as string,
          },
        );
        break;

      case "get_phase":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getPhaseInternal,
          {
            userId: auth.userId,
            phaseId: params?.phaseId as string,
          },
        );
        break;

      case "create_phase":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createPhaseInternal,
          {
            userId: auth.userId,
            projectId: params?.projectId as string,
            name: params?.name as string,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
          },
        );
        break;

      case "update_phase":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updatePhaseInternal,
          {
            userId: auth.userId,
            phaseId: params?.phaseId as string,
            name: params?.name as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            startDate: params?.startDate as string | undefined,
            endDate: params?.endDate as string | undefined,
          },
        );
        break;

      case "delete_phase":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deletePhaseInternal,
          {
            userId: auth.userId,
            phaseId: params?.phaseId as string,
          },
        );
        break;

      case "assign_issue_to_phase":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.assignIssueToPhaseInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            phaseId: params?.phaseId as string | undefined,
          },
        );
        break;

      // Beeper Business Contacts tools
      case "get_beeper_threads":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getBeeperThreadsInternal,
          {
            userId: auth.userId,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_beeper_thread":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getBeeperThreadInternal,
          {
            userId: auth.userId,
            threadId: params?.threadId as string,
          },
        );
        break;

      case "get_beeper_thread_messages":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getBeeperThreadMessagesInternal,
          {
            userId: auth.userId,
            threadId: params?.threadId as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "search_beeper_messages":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.searchBeeperMessagesInternal,
          {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_beeper_threads_for_person":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getBeeperThreadsForPersonInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string,
          },
        );
        break;

      case "get_beeper_threads_for_client":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getBeeperThreadsForClientInternal,
          {
            userId: auth.userId,
            clientId: params?.clientId as string,
          },
        );
        break;

      // Granola Meeting tools
      case "get_granola_meetings":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getGranolaMeetingsInternal,
          {
            userId: auth.userId,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      case "get_granola_meeting":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getGranolaMeetingInternal,
          {
            userId: auth.userId,
            granolaDocId: params?.granolaDocId as string,
          },
        );
        break;

      case "get_granola_transcript":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getGranolaTranscriptInternal,
          {
            userId: auth.userId,
            meetingId: params?.meetingId as string,
          },
        );
        break;

      case "search_granola_meetings":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.searchGranolaMeetingsInternal,
          {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          },
        );
        break;

      // Cross-Entity Linking tools
      case "get_granola_meetings_for_person":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getGranolaMeetingsForPersonInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string,
          },
        );
        break;

      case "get_granola_meetings_for_thread":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getGranolaMeetingsForThreadInternal,
          {
            userId: auth.userId,
            beeperThreadId: params?.beeperThreadId as string,
          },
        );
        break;

      // Composite tools
      case "get_contact_dossier":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getContactDossierInternal,
          {
            userId: auth.userId,
            personId: params?.personId as string | undefined,
            nameQuery: params?.nameQuery as string | undefined,
          },
        );
        break;

      case "get_meeting_calendar_links":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getMeetingCalendarLinksInternal,
          {
            userId: auth.userId,
            meetingId: params?.meetingId as string,
          },
        );
        break;

      // Beeper → FRM Sync tools
      case "sync_beeper_contacts_to_frm":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.syncBeeperContactsToFrmInternal,
          {
            userId: auth.userId,
            dryRun: params?.dryRun as boolean | undefined,
          },
        );
        break;

      case "link_beeper_thread_to_person":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.linkBeeperThreadToPersonInternal,
          {
            userId: auth.userId,
            threadId: params?.threadId as string,
            personId: params?.personId as string | undefined,
            personName: params?.personName as string | undefined,
            relationshipType: params?.relationshipType as string | undefined,
          },
        );
        break;

      // CRM / Business Contact tools
      case "get_business_contacts":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getBusinessContactsInternal,
          {
            userId: auth.userId,
          },
        );
        break;

      case "get_merge_suggestions":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getMergeSuggestionsInternal,
          {
            userId: auth.userId,
          },
        );
        break;

      case "accept_merge_suggestion":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.acceptMergeSuggestionInternal,
          {
            userId: auth.userId,
            suggestionId: params?.suggestionId as string,
          },
        );
        break;

      case "reject_merge_suggestion":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.rejectMergeSuggestionInternal,
          {
            userId: auth.userId,
            suggestionId: params?.suggestionId as string,
          },
        );
        break;

      case "dismiss_all_merge_suggestions":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.dismissAllMergeSuggestionsInternal,
          {
            userId: auth.userId,
          },
        );
        break;

      case "unlink_meeting_from_business_contact":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.unlinkMeetingFromBusinessContactInternal,
          {
            userId: auth.userId,
            threadConvexId: params?.threadConvexId as string,
            meetingSource: params?.meetingSource as string,
            meetingId: params?.meetingId as string,
          },
        );
        break;

      // ==================== INITIATIVE MANAGEMENT ====================
      case "get_initiatives":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getInitiativesInternal,
          {
            userId: auth.userId,
            year: params?.year as number | undefined,
            status: params?.status as string | undefined,
            category: params?.category as string | undefined,
            includeArchived: params?.includeArchived as boolean | undefined,
          },
        );
        break;

      case "get_initiative":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getInitiativeInternal,
          {
            userId: auth.userId,
            initiativeId: params?.initiativeId as string,
          },
        );
        break;

      case "get_initiative_with_stats":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getInitiativeWithStatsInternal,
          {
            userId: auth.userId,
            initiativeId: params?.initiativeId as string,
          },
        );
        break;

      case "create_initiative":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.createInitiativeInternal,
          {
            userId: auth.userId,
            year: params?.year as number,
            title: params?.title as string,
            category: params?.category as string,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            targetMetric: params?.targetMetric as string | undefined,
            manualProgress: params?.manualProgress as number | undefined,
            color: params?.color as string | undefined,
            icon: params?.icon as string | undefined,
          },
        );
        break;

      case "update_initiative":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.updateInitiativeInternal,
          {
            userId: auth.userId,
            initiativeId: params?.initiativeId as string,
            title: params?.title as string | undefined,
            description: params?.description as string | undefined,
            category: params?.category as string | undefined,
            status: params?.status as string | undefined,
            targetMetric: params?.targetMetric as string | undefined,
            manualProgress: params?.manualProgress as number | undefined,
            color: params?.color as string | undefined,
            icon: params?.icon as string | undefined,
          },
        );
        break;

      case "archive_initiative":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.archiveInitiativeInternal,
          {
            userId: auth.userId,
            initiativeId: params?.initiativeId as string,
          },
        );
        break;

      case "delete_initiative":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.deleteInitiativeInternal,
          {
            userId: auth.userId,
            initiativeId: params?.initiativeId as string,
          },
        );
        break;

      case "link_project_to_initiative":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.linkProjectToInitiativeInternal,
          {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
            initiativeId: params?.initiativeId as string | undefined,
          },
        );
        break;

      case "link_issue_to_initiative":
        result = await ctx.runMutation(
          internal.lifeos.tool_call.linkIssueToInitiativeInternal,
          {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            initiativeId: params?.initiativeId as string | undefined,
          },
        );
        break;

      case "get_initiative_yearly_rollup":
        result = await ctx.runQuery(
          internal.lifeos.tool_call.getInitiativeYearlyRollupInternal,
          {
            userId: auth.userId,
            year: params?.year as number,
          },
        );
        break;
    }

    return new Response(
      JSON.stringify({
        success: true,
        tool,
        result,
        executedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
