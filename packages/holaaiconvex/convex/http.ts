import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// ==================== CHAT NEXUS STREAMING ====================

/**
 * Stream chat responses from multiple LLMs in parallel via Vercel AI Gateway
 * https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
 *
 * Request body:
 * {
 *   conversationId: string,
 *   message: string,
 *   broadcastId: string,
 *   panels: [{ panelId: string, modelId: string, modelProvider: string }]
 * }
 *
 * Response: SSE stream with format:
 * data: {"panelId":"...","content":"...","done":false}\n\n
 * data: {"panelId":"...","done":true}\n\n
 */
http.route({
  path: "/chatnexus/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // CORS headers for preflight
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 1. Authenticate user
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user from database
      const user = await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
        tokenIdentifier: identity.tokenIdentifier,
      });

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Parse request body
      const body = await request.json();
      const { conversationId, message, broadcastId, panels } = body as {
        conversationId: string;
        message: string;
        broadcastId: string;
        panels: Array<{
          panelId: string;
          modelId: string;
          modelProvider: string;
        }>;
      };

      if (!conversationId || !message || !broadcastId || !panels?.length) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Verify conversation ownership
      const conversation = await ctx.runQuery(
        internal.lifeos.chatnexus.getConversationInternal,
        { conversationId: conversationId as Id<"lifeos_chatnexusConversations"> }
      );

      if (!conversation || conversation.userId !== user._id) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. Get conversation history for context
      const messages = await ctx.runQuery(
        internal.lifeos.chatnexus.getMessagesInternal,
        { conversationId: conversationId as Id<"lifeos_chatnexusConversations"> }
      );

      // Build conversation history for LLM
      type MessageRecord = {
        role: string;
        content: string;
        isComplete: boolean;
        error?: string;
      };
      const conversationHistory = (messages as MessageRecord[])
        .filter((m) => m.isComplete && !m.error)
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

      // Add the new user message
      conversationHistory.push({ role: "user", content: message });

      // 5. Store user message
      await ctx.runMutation(internal.lifeos.chatnexus.addUserMessageInternal, {
        userId: user._id,
        conversationId: conversationId as Id<"lifeos_chatnexusConversations">,
        content: message,
        broadcastId,
      });

      // 6. Get AI Gateway API key
      const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
      if (!aiGatewayKey) {
        return new Response(JSON.stringify({ error: "AI Gateway API key not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 7. Create SSE stream
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (data: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          // Process all panels in parallel
          const panelPromises = panels.map(async (panel) => {
            try {
              let fullContent = "";

              // Call Vercel AI Gateway streaming API
              // https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
              const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${aiGatewayKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: panel.modelId,
                  messages: conversationHistory,
                  stream: true,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
              }

              // Process streaming response
              const reader = response.body?.getReader();
              if (!reader) {
                throw new Error("No response body");
              }

              const decoder = new TextDecoder();
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") continue;

                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content;
                      if (content) {
                        fullContent += content;
                        sendEvent({ panelId: panel.panelId, content, done: false });
                      }
                    } catch {
                      // Ignore parse errors for incomplete JSON
                    }
                  }
                }
              }

              // Store complete message
              await ctx.runMutation(internal.lifeos.chatnexus.upsertAssistantMessageInternal, {
                userId: user._id,
                conversationId: conversationId as Id<"lifeos_chatnexusConversations">,
                panelId: panel.panelId,
                modelId: panel.modelId,
                modelProvider: panel.modelProvider,
                broadcastId,
                content: fullContent,
                isComplete: true,
              });

              sendEvent({ panelId: panel.panelId, done: true });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error";

              // Store error message
              await ctx.runMutation(internal.lifeos.chatnexus.upsertAssistantMessageInternal, {
                userId: user._id,
                conversationId: conversationId as Id<"lifeos_chatnexusConversations">,
                panelId: panel.panelId,
                modelId: panel.modelId,
                modelProvider: panel.modelProvider,
                broadcastId,
                content: "",
                isComplete: true,
                error: errorMessage,
              });

              sendEvent({ panelId: panel.panelId, error: errorMessage, done: true });
            }
          });

          // Wait for all panels to complete
          await Promise.all(panelPromises);
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }
  }),
});

// Handle CORS preflight for chatnexus streaming
http.route({
  path: "/chatnexus/stream",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

// ==================== API KEY VALIDATION ====================

/**
 * Test Vercel AI Gateway API key by making a minimal request
 * Uses gpt-4o-mini for cheap validation
 *
 * Response: { success: true, model: string } or { success: false, error: string }
 */
http.route({
  path: "/chatnexus/test-api-key",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    try {
      // 1. Authenticate user
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Get AI Gateway API key
      const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
      if (!aiGatewayKey) {
        return new Response(
          JSON.stringify({ success: false, error: "AI Gateway API key not configured on server" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // 3. Make a minimal test request using Gemini 2.5 Flash Lite (cheapest model)
      const testModel = "google/gemini-2.5-flash-lite";
      const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiGatewayKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API key validation failed (${response.status})`;

        // Parse error for better message
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          }
        } catch {
          if (errorText) {
            errorMessage = errorText.slice(0, 200);
          }
        }

        return new Response(JSON.stringify({ success: false, error: errorMessage }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. Parse response to confirm it worked
      const data = await response.json();
      const modelUsed = data.model || testModel;

      return new Response(
        JSON.stringify({
          success: true,
          model: modelUsed,
          message: "API key is valid",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
});

// Handle CORS preflight for API key test
http.route({
  path: "/chatnexus/test-api-key",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;
