import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { validateDemoAgentApiKey } from "../_lib/http_utils";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

// ==================== DEMO AGENT HTTP API ====================

/**
 * Create a new thread for Demo AI chat
 * Accessible externally via HTTP POST
 * Requires X-API-Key header
 *
 * Response: { threadId: string } or { error: string }
 */
export const demoAgentCreateThreadHandler = httpAction(async (ctx, request) => {
  // Validate API key
  if (!validateDemoAgentApiKey(request)) {
    return new Response(JSON.stringify({ error: "Invalid or missing API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Create a new thread via the agent action
    const result = await ctx.runAction(api.lifeos.demo_agent.createThread, {});

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

/**
 * Send a message to the Demo AI and get a response
 * Accessible externally via HTTP POST
 * Requires X-API-Key header
 *
 * Request body: { threadId: string, message: string, modelId?: string }
 * Response: { text: string, toolCalls?: [...], toolResults?: [...], usage?: {...}, modelUsed: string } or { error: string }
 */
export const demoAgentSendMessageHandler = httpAction(async (ctx, request) => {
  // Validate API key
  if (!validateDemoAgentApiKey(request)) {
    return new Response(JSON.stringify({ error: "Invalid or missing API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse request body
    const body = await request.json();
    const { threadId, message, modelId } = body as {
      threadId: string;
      message: string;
      modelId?: string;
    };

    if (!threadId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: threadId and message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send message via the agent action with optional model selection
    const result = await ctx.runAction(api.lifeos.demo_agent.sendMessage, {
      threadId,
      message,
      modelId,
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
