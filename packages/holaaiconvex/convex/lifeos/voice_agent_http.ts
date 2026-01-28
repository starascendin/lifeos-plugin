import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { VOICE_AGENT_API_KEY } from "../_lib/http_utils";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  "X-Deprecated": "Use /tool-call with tool: get_todays_tasks instead",
};

// ==================== VOICE AGENT HTTP API (DEPRECATED) ====================
// Use /tool-call with tool: "get_todays_tasks" instead

/**
 * @deprecated Use /tool-call with tool: "get_todays_tasks" instead
 * Get today's tasks for voice agent
 * Used by LiveKit voice agent to retrieve user's tasks
 *
 * Request body: { userId: string }
 * Response: { tasks: [...], summary: {...} } or { error: string }
 */
export const voiceAgentTodaysTasksHandler = httpAction(async (ctx, request) => {
  // Validate API key
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
  if (apiKey !== VOICE_AGENT_API_KEY) {
    return new Response(JSON.stringify({ error: "Invalid or missing API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing required field: userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward to new tool_call module
    const result = await ctx.runQuery(internal.lifeos.tool_call.getTodaysTasksInternal, {
      userId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
