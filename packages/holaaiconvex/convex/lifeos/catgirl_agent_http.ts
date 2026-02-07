/**
 * CatGirl Agent HTTP Handlers
 * HTTP endpoints for CatGirl AI chat
 * Uses Clerk JWT authentication (no API key required)
 */
import { httpAction } from "../_generated/server";
import { api, internal } from "../_generated/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ==================== CATGIRL AGENT HTTP API ====================

/**
 * Create a new thread for CatGirl AI chat
 * Accessible externally via HTTP POST
 * Requires Clerk JWT Bearer token
 *
 * Response: { threadId: string } or { error: string }
 */
export const catgirlAgentCreateThreadHandler = httpAction(async (ctx, request) => {
  try {
    // Validate Clerk JWT
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a new thread via the agent action
    const result = await ctx.runAction(api.lifeos.catgirl_agent.createThread, {});

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
 * Send a message to CatGirl AI and get a response
 * Accessible externally via HTTP POST
 * Requires Clerk JWT Bearer token
 *
 * Request body: { threadId: string, message: string, modelId?: string }
 * Response: { text: string, toolCalls?: [...], toolResults?: [...], usage?: {...}, modelUsed: string } or { error: string }
 */
export const catgirlAgentSendMessageHandler = httpAction(async (ctx, request) => {
  try {
    // Validate Clerk JWT
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const result = await ctx.runAction(api.lifeos.catgirl_agent.sendMessage, {
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
    const status = errorMessage.includes("Authentication") ? 401 :
                   errorMessage.includes("not found") ? 404 : 500;
    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
