"use node";

/**
 * Custom Agent Runner
 *
 * Agentic loop action that executes custom agent configs using @convex-dev/agent.
 * Each agent gets a filtered set of LifeOS tools based on its config.
 */

import { Agent, createTool } from "@convex-dev/agent";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { TOOL_REGISTRY } from "./agents_tool_registry";

// ==================== TOOL DISPATCHER ====================

/**
 * Maps tool names to their internal function references.
 * Mirrors the switch in tool_call_http.ts but as a lookup map.
 */
const TOOL_DISPATCH: Record<
  string,
  { ref: string; type: "query" | "mutation" }
> = {
  // Tasks / Issues
  get_todays_tasks: { ref: "getTodaysTasksInternal", type: "query" },
  get_tasks: { ref: "getTasksInternal", type: "query" },
  create_issue: { ref: "createIssueInternal", type: "mutation" },
  mark_issue_complete: { ref: "markIssueCompleteInternal", type: "mutation" },
  get_issue: { ref: "getIssueInternal", type: "query" },
  update_issue: { ref: "updateIssueInternal", type: "mutation" },
  delete_issue: { ref: "deleteIssueInternal", type: "mutation" },
  // Projects
  get_projects: { ref: "getProjectsInternal", type: "query" },
  get_project: { ref: "getProjectInternal", type: "query" },
  create_project: { ref: "createProjectInternal", type: "mutation" },
  update_project: { ref: "updateProjectInternal", type: "mutation" },
  delete_project: { ref: "deleteProjectInternal", type: "mutation" },
  // Cycles
  get_current_cycle: { ref: "getCurrentCycleInternal", type: "query" },
  get_cycles: { ref: "getCyclesInternal", type: "query" },
  create_cycle: { ref: "createCycleInternal", type: "mutation" },
  update_cycle: { ref: "updateCycleInternal", type: "mutation" },
  delete_cycle: { ref: "deleteCycleInternal", type: "mutation" },
  close_cycle: { ref: "closeCycleInternal", type: "mutation" },
  generate_cycles: { ref: "generateCyclesInternal", type: "mutation" },
  assign_issue_to_cycle: { ref: "assignIssueToCycleInternal", type: "mutation" },
  // Phases
  get_phases: { ref: "getPhasesInternal", type: "query" },
  get_phase: { ref: "getPhaseInternal", type: "query" },
  create_phase: { ref: "createPhaseInternal", type: "mutation" },
  update_phase: { ref: "updatePhaseInternal", type: "mutation" },
  delete_phase: { ref: "deletePhaseInternal", type: "mutation" },
  assign_issue_to_phase: { ref: "assignIssueToPhaseInternal", type: "mutation" },
  // Agenda
  get_daily_agenda: { ref: "getDailyAgendaInternal", type: "query" },
  get_weekly_agenda: { ref: "getWeeklyAgendaInternal", type: "query" },
  get_monthly_agenda: { ref: "getMonthlyAgendaInternal", type: "query" },
  regenerate_daily_summary: { ref: "regenerateDailySummaryInternal", type: "mutation" },
  regenerate_weekly_summary: { ref: "regenerateWeeklySummaryInternal", type: "mutation" },
  regenerate_monthly_summary: { ref: "regenerateMonthlySummaryInternal", type: "mutation" },
  update_weekly_prompt: { ref: "updateWeeklyPromptInternal", type: "mutation" },
  update_monthly_prompt: { ref: "updateMonthlyPromptInternal", type: "mutation" },
  // Clients
  get_clients: { ref: "getClientsInternal", type: "query" },
  get_client: { ref: "getClientInternal", type: "query" },
  get_projects_for_client: { ref: "getProjectsForClientInternal", type: "query" },
  create_client: { ref: "createClientInternal", type: "mutation" },
  update_client: { ref: "updateClientInternal", type: "mutation" },
  delete_client: { ref: "deleteClientInternal", type: "mutation" },
  // Contacts / FRM
  get_people: { ref: "getPeopleInternal", type: "query" },
  get_person: { ref: "getPersonInternal", type: "query" },
  search_people: { ref: "searchPeopleInternal", type: "query" },
  get_memos_for_person: { ref: "getMemosForPersonInternal", type: "query" },
  get_person_timeline: { ref: "getPersonTimelineInternal", type: "query" },
  create_person: { ref: "createPersonInternal", type: "mutation" },
  update_person: { ref: "updatePersonInternal", type: "mutation" },
  link_memo_to_person: { ref: "linkMemoToPersonInternal", type: "mutation" },
  // Notes
  search_notes: { ref: "searchNotesInternal", type: "query" },
  get_recent_notes: { ref: "getRecentNotesInternal", type: "query" },
  create_quick_note: { ref: "createQuickNoteInternal", type: "mutation" },
  add_tags_to_note: { ref: "addTagsToNoteInternal", type: "mutation" },
  // Voice Memos
  get_voice_memo: { ref: "getVoiceMemoInternal", type: "query" },
  get_voice_memos_by_date: { ref: "getVoiceMemosByDateInternal", type: "query" },
  get_voice_memos_by_labels: { ref: "getVoiceMemosByLabelsInternal", type: "query" },
  get_voice_memo_labels: { ref: "getVoiceMemoLabelsInternal", type: "query" },
  // AI Summaries
  create_ai_convo_summary: { ref: "createAiConvoSummaryInternal", type: "mutation" },
  get_ai_convo_summaries: { ref: "getAiConvoSummariesInternal", type: "query" },
  get_ai_convo_summary: { ref: "getAiConvoSummaryInternal", type: "query" },
  search_ai_convo_summaries: { ref: "searchAiConvoSummariesInternal", type: "query" },
  update_ai_convo_summary: { ref: "updateAiConvoSummaryInternal", type: "mutation" },
  delete_ai_convo_summary: { ref: "deleteAiConvoSummaryInternal", type: "mutation" },
  // Beeper
  get_beeper_threads: { ref: "getBeeperThreadsInternal", type: "query" },
  get_beeper_thread: { ref: "getBeeperThreadInternal", type: "query" },
  get_beeper_thread_messages: { ref: "getBeeperThreadMessagesInternal", type: "query" },
  search_beeper_messages: { ref: "searchBeeperMessagesInternal", type: "query" },
  get_beeper_threads_for_person: { ref: "getBeeperThreadsForPersonInternal", type: "query" },
  get_beeper_threads_for_client: { ref: "getBeeperThreadsForClientInternal", type: "query" },
  // Meetings / Granola
  get_granola_meetings: { ref: "getGranolaMeetingsInternal", type: "query" },
  get_granola_meeting: { ref: "getGranolaMeetingInternal", type: "query" },
  get_granola_transcript: { ref: "getGranolaTranscriptInternal", type: "query" },
  search_granola_meetings: { ref: "searchGranolaMeetingsInternal", type: "query" },
  get_granola_meetings_for_person: { ref: "getGranolaMeetingsForPersonInternal", type: "query" },
  get_granola_meetings_for_thread: { ref: "getGranolaMeetingsForThreadInternal", type: "query" },
  get_contact_dossier: { ref: "getContactDossierInternal", type: "query" },
  get_meeting_calendar_links: { ref: "getMeetingCalendarLinksInternal", type: "query" },
  // CRM
  sync_beeper_contacts_to_frm: { ref: "syncBeeperContactsToFrmInternal", type: "mutation" },
  link_beeper_thread_to_person: { ref: "linkBeeperThreadToPersonInternal", type: "mutation" },
  get_business_contacts: { ref: "getBusinessContactsInternal", type: "query" },
  get_merge_suggestions: { ref: "getMergeSuggestionsInternal", type: "query" },
  accept_merge_suggestion: { ref: "acceptMergeSuggestionInternal", type: "mutation" },
  reject_merge_suggestion: { ref: "rejectMergeSuggestionInternal", type: "mutation" },
  dismiss_all_merge_suggestions: { ref: "dismissAllMergeSuggestionsInternal", type: "mutation" },
  unlink_meeting_from_business_contact: { ref: "unlinkMeetingFromBusinessContactInternal", type: "mutation" },
  // Initiatives
  get_initiatives: { ref: "getInitiativesInternal", type: "query" },
  get_initiative: { ref: "getInitiativeInternal", type: "query" },
  get_initiative_with_stats: { ref: "getInitiativeWithStatsInternal", type: "query" },
  create_initiative: { ref: "createInitiativeInternal", type: "mutation" },
  update_initiative: { ref: "updateInitiativeInternal", type: "mutation" },
  archive_initiative: { ref: "archiveInitiativeInternal", type: "mutation" },
  delete_initiative: { ref: "deleteInitiativeInternal", type: "mutation" },
  link_project_to_initiative: { ref: "linkProjectToInitiativeInternal", type: "mutation" },
  link_issue_to_initiative: { ref: "linkIssueToInitiativeInternal", type: "mutation" },
  get_initiative_yearly_rollup: { ref: "getInitiativeYearlyRollupInternal", type: "query" },
};

// ==================== BUILD TOOLS ====================

/**
 * Build createTool wrappers for the enabled tools.
 * Each tool dispatches to the appropriate internal query/mutation.
 */
function buildAgentTools(enabledTools: string[], userId: Id<"users">) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const toolName of enabledTools) {
    const registry = TOOL_REGISTRY[toolName];
    const dispatch = TOOL_DISPATCH[toolName];
    if (!registry || !dispatch) continue;

    // We need to capture toolName and dispatch in a closure
    const capturedRef = dispatch.ref;
    const capturedType = dispatch.type;
    const capturedUserId = userId;

    tools[toolName] = createTool({
      description: registry.description,
      args: registry.parameters,
      handler: async (ctx, args) => {
        // Build params with userId injected
        const params = { userId: capturedUserId, ...args } as Record<string, unknown>;

        // Get the internal function reference
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fnRef = (internal.lifeos.tool_call as any)[capturedRef];
        if (!fnRef) {
          return { error: `Tool function not found: ${capturedRef}` };
        }

        try {
          if (capturedType === "query") {
            return await ctx.runQuery(fnRef, params);
          } else {
            return await ctx.runMutation(fnRef, params);
          }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : "Tool execution failed",
          };
        }
      },
    });
  }

  return tools;
}

// ==================== AGENT RUNNER ====================

/**
 * Run an agent with the given config.
 * Creates a @convex-dev/agent instance, runs generateText, saves results.
 */
export const runAgentInternal = internalAction({
  args: {
    agentConfigId: v.id("lifeos_customAgentConfigs"),
    trigger: v.union(v.literal("cron"), v.literal("manual")),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, { agentConfigId, trigger, prompt }) => {
    // 1. Load agent config
    const config = await ctx.runQuery(
      internal.lifeos.agents.getAgentConfigInternal,
      { agentConfigId }
    );
    if (!config) {
      throw new Error(`Agent config not found: ${agentConfigId}`);
    }

    const runPrompt = prompt || config.cronPrompt || "Execute your instructions.";

    // 2. Create run record
    const runId = await ctx.runMutation(
      internal.lifeos.agents.createRunRecord,
      {
        userId: config.userId,
        agentConfigId,
        trigger,
        prompt: runPrompt,
        model: config.model,
      }
    );

    try {
      // 3. Build tools
      const tools = buildAgentTools(config.enabledTools, config.userId);

      // 4. Create agent
      const agent = new Agent(components.agent, {
        name: config.name,
        languageModel: gateway(config.model),
        instructions: config.instructions,
        tools,
        maxSteps: 10,
      });

      // 5. Create thread and run
      const { thread } = await agent.createThread(ctx, {});
      const result = await thread.generateText({
        prompt: runPrompt,
      });

      // 6. Extract tool calls from steps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyResult = result as any;
      const toolCallLog: Array<{ tool: string; params?: string; result?: string }> = [];

      if (anyResult.steps && Array.isArray(anyResult.steps)) {
        for (const step of anyResult.steps) {
          if (step.content && Array.isArray(step.content)) {
            for (const item of step.content) {
              if (item.type === "tool-call" && item.toolName) {
                toolCallLog.push({
                  tool: item.toolName,
                  params: JSON.stringify(item.input)?.slice(0, 2000),
                });
              }
              if (item.type === "tool-result" && item.toolName) {
                // Find matching tool call and attach result
                const existing = toolCallLog.find(
                  (tc) => tc.tool === item.toolName && !tc.result
                );
                if (existing) {
                  existing.result = JSON.stringify(item.output)?.slice(0, 2000);
                }
              }
            }
          }
        }
      }

      // 7. Update run record → completed
      await ctx.runMutation(internal.lifeos.agents.updateRunRecord, {
        runId,
        status: "completed",
        output: result.text?.slice(0, 10000) || "",
        toolCallLog,
        threadId: anyResult.threadId || undefined,
      });

      // 8. Update lastRunAt on config
      await ctx.runMutation(internal.lifeos.agents.updateAgentLastRun, {
        agentConfigId,
        lastRunAt: Date.now(),
      });

      // 9. Schedule next cron run if enabled
      if (config.cronEnabled && config.cronSchedule && trigger === "cron") {
        await ctx.runMutation(internal.lifeos.agents.scheduleNextRun, {
          agentConfigId,
        });
      }
    } catch (error) {
      // Update run record → failed
      await ctx.runMutation(internal.lifeos.agents.updateRunRecord, {
        runId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Still schedule next cron run on failure
      if (config.cronEnabled && config.cronSchedule && trigger === "cron") {
        await ctx.runMutation(internal.lifeos.agents.scheduleNextRun, {
          agentConfigId,
        });
      }
    }
  },
});
