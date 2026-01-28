import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Import for type safety in httpAction handlers
type HttpActionCtx = Parameters<Parameters<typeof httpAction>[0]>[0];

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

      // Check credits before processing AI request
      const creditCheck = await ctx.runQuery(internal.common.credits.checkCreditsInternal, {
        userId: user._id,
      });
      if (!creditCheck.allowed) {
        return new Response(
          JSON.stringify({
            error: "OUT_OF_CREDITS",
            message: creditCheck.reason || "You have run out of AI credits.",
            currentBalance: creditCheck.currentBalance,
          }),
          {
            status: 402, // Payment Required
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
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

              // Deduct credits for this streaming response (if not unlimited)
              if (!creditCheck.hasUnlimitedAccess && fullContent.length > 0) {
                await ctx.runMutation(internal.common.credits.deductStreamingCreditsFromText, {
                  userId: user._id,
                  feature: "chatnexus",
                  model: panel.modelId,
                  generatedText: fullContent,
                  promptText: message,
                  description: `ChatNexus: ${panel.modelId}`,
                });
              }

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

// ==================== LLM COUNCIL DELIBERATION ====================

/**
 * LLM Council Deliberation - 3-stage multi-model deliberation process
 *
 * Stage 1: All council models answer the query in parallel
 * Stage 2: Each model evaluates and ranks other responses (anonymized)
 * Stage 3: Chairman synthesizes all inputs into final answer
 *
 * Request body:
 * {
 *   conversationId: string,
 *   query: string,
 *   queryId: string,
 *   councilModels: [{ modelId: string, modelName: string }],
 *   chairmanModel: { modelId: string, modelName: string }
 * }
 *
 * Response: SSE stream with events for each stage
 */
http.route({
  path: "/llmcouncil/deliberate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    try {
      // 1. Authenticate user
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const user = await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
        tokenIdentifier: identity.tokenIdentifier,
      });

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check credits before processing AI request
      const creditCheck = await ctx.runQuery(internal.common.credits.checkCreditsInternal, {
        userId: user._id,
      });
      if (!creditCheck.allowed) {
        return new Response(
          JSON.stringify({
            error: "OUT_OF_CREDITS",
            message: creditCheck.reason || "You have run out of AI credits.",
            currentBalance: creditCheck.currentBalance,
          }),
          {
            status: 402, // Payment Required
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // 2. Parse request body
      const body = await request.json();
      const { conversationId, query, queryId, councilModels, chairmanModel } = body as {
        conversationId: string;
        query: string;
        queryId: string;
        councilModels: Array<{ modelId: string; modelName: string }>;
        chairmanModel: { modelId: string; modelName: string };
      };

      if (!conversationId || !query || !queryId || !councilModels?.length || !chairmanModel) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Verify conversation ownership
      const conversation = await ctx.runQuery(
        internal.lifeos.llmcouncil.getConversationInternal,
        { conversationId: conversationId as Id<"lifeos_llmcouncilConversations"> }
      );

      if (!conversation || conversation.userId !== user._id) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. Get AI Gateway API key
      const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
      if (!aiGatewayKey) {
        return new Response(JSON.stringify({ error: "AI Gateway API key not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 5. Store user query and create deliberation placeholder
      await ctx.runMutation(internal.lifeos.llmcouncil.addQueryInternal, {
        userId: user._id,
        conversationId: conversationId as Id<"lifeos_llmcouncilConversations">,
        query,
        queryId,
      });

      const deliberationId = await ctx.runMutation(
        internal.lifeos.llmcouncil.createDeliberationInternal,
        {
          userId: user._id,
          conversationId: conversationId as Id<"lifeos_llmcouncilConversations">,
          queryId,
        }
      );

      // 6. Create SSE stream for progressive updates
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            // ==================== STAGE 1: COLLECT RESPONSES ====================
            sendEvent("stage1_start", { message: "Collecting responses from council members" });

            const stage1Responses: Array<{
              modelId: string;
              modelName: string;
              response: string;
            }> = [];

            // Query all council models in parallel
            // Each model gets a tier-appropriate timeout (pro-tier models get 5 min, normal get 4 min)
            const stage1Promises = councilModels.map(async (model) => {
              try {
                const stage1Timeout = getModelTimeout(model.modelId, "query");
                const response = await queryModel(
                  aiGatewayKey,
                  model.modelId,
                  [{ role: "user", content: query }],
                  stage1Timeout
                );

                stage1Responses.push({
                  modelId: model.modelId,
                  modelName: model.modelName,
                  response,
                });

                // Update database
                await ctx.runMutation(internal.lifeos.llmcouncil.updateStage1Internal, {
                  messageId: deliberationId,
                  modelId: model.modelId,
                  modelName: model.modelName,
                  response,
                  isComplete: true,
                });

                // Deduct credits for Stage 1 response (if not unlimited)
                if (!creditCheck.hasUnlimitedAccess && response.length > 0) {
                  await ctx.runMutation(internal.common.credits.deductStreamingCreditsFromText, {
                    userId: user._id,
                    feature: "llm_council",
                    model: model.modelId,
                    generatedText: response,
                    promptText: query,
                    description: `LLM Council Stage 1: ${model.modelName}`,
                  });
                }

                sendEvent("stage1_model_complete", {
                  modelId: model.modelId,
                  modelName: model.modelName,
                  response,
                });
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";

                await ctx.runMutation(internal.lifeos.llmcouncil.updateStage1Internal, {
                  messageId: deliberationId,
                  modelId: model.modelId,
                  modelName: model.modelName,
                  response: "",
                  isComplete: true,
                  error: errorMessage,
                });

                sendEvent("stage1_model_error", {
                  modelId: model.modelId,
                  modelName: model.modelName,
                  error: errorMessage,
                });
              }
            });

            await Promise.all(stage1Promises);

            // Mark stage 1 complete
            await ctx.runMutation(internal.lifeos.llmcouncil.updateStage1Internal, {
              messageId: deliberationId,
              modelId: councilModels[0].modelId,
              modelName: councilModels[0].modelName,
              response: stage1Responses[0]?.response ?? "",
              isComplete: true,
              stage1Complete: true,
            });

            sendEvent("stage1_complete", {
              responseCount: stage1Responses.length,
            });

            // Need at least 2 responses for ranking
            if (stage1Responses.length < 2) {
              throw new Error("Not enough responses for ranking stage");
            }

            // ==================== STAGE 2: PEER RANKINGS ====================
            sendEvent("stage2_start", { message: "Council members are evaluating responses" });

            // Create anonymous labels for responses
            const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
            const labelToModel: Record<string, string> = {};
            const modelToLabel: Record<string, string> = {};

            stage1Responses.forEach((r, i) => {
              const label = `Response ${labels[i]}`;
              labelToModel[label] = r.modelId;
              modelToLabel[r.modelId] = label;
            });

            // Build anonymized responses string
            const anonymizedResponses = stage1Responses
              .map((r, i) => `### Response ${labels[i]}\n\n${r.response}`)
              .join("\n\n---\n\n");

            const rankingPrompt = `You are evaluating multiple responses to the following question:

**Question:** ${query}

Here are the responses to evaluate:

${anonymizedResponses}

---

## Evaluation Instructions

For EACH response, provide a detailed evaluation using the following table format:

### Response [Letter]

| Aspect | Points For (Strengths) | Points Against (Weaknesses) |
|--------|----------------------|---------------------------|
| **Accuracy** | [What is correct/accurate] | [Any errors or inaccuracies] |
| **Completeness** | [What is thorough/comprehensive] | [What is missing or lacking] |
| **Clarity** | [What is well-explained/organized] | [What is confusing or unclear] |
| **Practicality** | [What is useful/actionable] | [What is impractical or unhelpful] |

**Summary:** [1-2 sentence overall assessment]

---

After evaluating ALL responses with the table format above, provide your final ranking.

**IMPORTANT:** You MUST end your response with a line in this exact format:
FINAL RANKING: ${labels.slice(0, stage1Responses.length).join(" > ")}

Replace the order with your actual ranking (best first). For example: "FINAL RANKING: B > A > C"`;

            const stage2Evaluations: Array<{
              evaluatorModelId: string;
              evaluatorModelName: string;
              evaluation: string;
              parsedRanking: string[];
            }> = [];

            // Each council member evaluates (except their own response is anonymized)
            // Each model gets a tier-appropriate timeout (pro-tier models get 5 min, normal get 4 min)
            const stage2Promises = councilModels.map(async (evaluator) => {
              try {
                const stage2Timeout = getModelTimeout(evaluator.modelId, "query");
                const evaluation = await queryModel(
                  aiGatewayKey,
                  evaluator.modelId,
                  [{ role: "user", content: rankingPrompt }],
                  stage2Timeout
                );

                // Parse ranking from response
                const parsedRanking = parseRanking(evaluation, stage1Responses.length, labelToModel);

                stage2Evaluations.push({
                  evaluatorModelId: evaluator.modelId,
                  evaluatorModelName: evaluator.modelName,
                  evaluation,
                  parsedRanking,
                });

                await ctx.runMutation(internal.lifeos.llmcouncil.updateStage2Internal, {
                  messageId: deliberationId,
                  evaluatorModelId: evaluator.modelId,
                  evaluatorModelName: evaluator.modelName,
                  evaluation,
                  parsedRanking,
                  isComplete: true,
                  labelToModel,
                });

                // Deduct credits for Stage 2 evaluation (if not unlimited)
                if (!creditCheck.hasUnlimitedAccess && evaluation.length > 0) {
                  await ctx.runMutation(internal.common.credits.deductStreamingCreditsFromText, {
                    userId: user._id,
                    feature: "llm_council",
                    model: evaluator.modelId,
                    generatedText: evaluation,
                    promptText: rankingPrompt,
                    description: `LLM Council Stage 2: ${evaluator.modelName}`,
                  });
                }

                sendEvent("stage2_model_complete", {
                  evaluatorModelId: evaluator.modelId,
                  evaluatorModelName: evaluator.modelName,
                  evaluation,
                  parsedRanking,
                });
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";

                await ctx.runMutation(internal.lifeos.llmcouncil.updateStage2Internal, {
                  messageId: deliberationId,
                  evaluatorModelId: evaluator.modelId,
                  evaluatorModelName: evaluator.modelName,
                  evaluation: "",
                  isComplete: true,
                  error: errorMessage,
                  labelToModel,
                });

                sendEvent("stage2_model_error", {
                  evaluatorModelId: evaluator.modelId,
                  evaluatorModelName: evaluator.modelName,
                  error: errorMessage,
                });
              }
            });

            await Promise.all(stage2Promises);

            // Calculate aggregate rankings
            const aggregateRankings = calculateAggregateRankings(
              stage2Evaluations,
              stage1Responses
            );

            // Update with aggregate rankings
            await ctx.runMutation(internal.lifeos.llmcouncil.updateStage2Internal, {
              messageId: deliberationId,
              evaluatorModelId: councilModels[0].modelId,
              evaluatorModelName: councilModels[0].modelName,
              evaluation: stage2Evaluations[0]?.evaluation ?? "",
              parsedRanking: stage2Evaluations[0]?.parsedRanking,
              isComplete: true,
              stage2Complete: true,
              labelToModel,
              aggregateRankings,
            });

            sendEvent("stage2_complete", {
              evaluationCount: stage2Evaluations.length,
              aggregateRankings,
              labelToModel,
            });

            // ==================== STAGE 3: CHAIRMAN SYNTHESIS ====================
            sendEvent("stage3_start", { message: "Chairman is synthesizing final answer" });

            // Build synthesis prompt with all context
            const rankingsSummary = aggregateRankings
              .map((r, i) => `${i + 1}. ${r.modelName} (avg rank: ${r.averageRank.toFixed(2)})`)
              .join("\n");

            const synthesisPrompt = `You are the Chairman of an AI Council. Your council members have answered the following question and evaluated each other's responses.

**Original Question:** ${query}

**Council Responses:**

${stage1Responses.map((r) => `### ${r.modelName}\n\n${r.response}`).join("\n\n---\n\n")}

**Aggregate Rankings (based on peer evaluation):**
${rankingsSummary}

---

As Chairman, please synthesize the best elements from all responses into a comprehensive, authoritative final answer. Consider:
1. The strengths identified in each response
2. The peer ranking results
3. Any consensus points across responses
4. Unique valuable insights from individual responses

Provide a well-structured, complete answer that represents the wisdom of the council.`;

            // Log synthesis prompt size for monitoring
            const promptSizeKB = (synthesisPrompt.length / 1024).toFixed(2);
            const isChairmanProTier = isProTierModel(chairmanModel.modelId);
            const synthesisTimeout = getModelTimeout(chairmanModel.modelId, "synthesis");
            console.log(
              `[Stage 3] Synthesis prompt size: ${synthesisPrompt.length} chars (${promptSizeKB}KB), ` +
              `Chairman: ${chairmanModel.modelId} (pro-tier: ${isChairmanProTier}), ` +
              `Timeout: ${synthesisTimeout / 1000}s`
            );

            try {
              // Use tier-aware timeout for synthesis (10 min for pro-tier, 5 min for normal)
              // Pro-tier models are slower and synthesis prompts can be 40KB+
              const synthesizedResponse = await queryModel(
                aiGatewayKey,
                chairmanModel.modelId,
                [{ role: "user", content: synthesisPrompt }],
                synthesisTimeout
              );

              await ctx.runMutation(internal.lifeos.llmcouncil.updateStage3Internal, {
                messageId: deliberationId,
                modelId: chairmanModel.modelId,
                modelName: chairmanModel.modelName,
                response: synthesizedResponse,
                isComplete: true,
              });

              // Deduct credits for Stage 3 synthesis (if not unlimited)
              if (!creditCheck.hasUnlimitedAccess && synthesizedResponse.length > 0) {
                await ctx.runMutation(internal.common.credits.deductStreamingCreditsFromText, {
                  userId: user._id,
                  feature: "llm_council",
                  model: chairmanModel.modelId,
                  generatedText: synthesizedResponse,
                  promptText: synthesisPrompt,
                  description: `LLM Council Stage 3: ${chairmanModel.modelName}`,
                });
              }

              sendEvent("stage3_complete", {
                modelId: chairmanModel.modelId,
                modelName: chairmanModel.modelName,
                response: synthesizedResponse,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error";

              await ctx.runMutation(internal.lifeos.llmcouncil.updateStage3Internal, {
                messageId: deliberationId,
                modelId: chairmanModel.modelId,
                modelName: chairmanModel.modelName,
                response: "",
                isComplete: true,
                error: errorMessage,
              });

              sendEvent("stage3_error", {
                modelId: chairmanModel.modelId,
                modelName: chairmanModel.modelName,
                error: errorMessage,
              });
            }

            // Mark deliberation complete
            await ctx.runMutation(internal.lifeos.llmcouncil.completeDeliberationInternal, {
              messageId: deliberationId,
            });

            sendEvent("complete", { message: "Deliberation complete" });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";

            await ctx.runMutation(internal.lifeos.llmcouncil.completeDeliberationInternal, {
              messageId: deliberationId,
              error: errorMessage,
            });

            sendEvent("error", { error: errorMessage });
          }

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

// Handle CORS preflight for LLM Council deliberation
http.route({
  path: "/llmcouncil/deliberate",
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Pro-tier model IDs that are slower and require longer timeouts
 * These models are the most capable but take 2-5x longer to generate responses
 */
const PRO_TIER_MODELS = [
  "anthropic/claude-opus-4.5",
  "openai/gpt-5.2-pro",
  "google/gemini-3-pro-preview",
  "xai/grok-4",
] as const;

/**
 * Check if a model is pro-tier (slower, more capable)
 */
function isProTierModel(modelId: string): boolean {
  return PRO_TIER_MODELS.includes(modelId as (typeof PRO_TIER_MODELS)[number]);
}

/**
 * Get timeout for a model based on its tier and operation type
 * Pro-tier models get longer timeouts due to their slower response times
 */
function getModelTimeout(modelId: string, operation: "query" | "synthesis"): number {
  const isProTier = isProTierModel(modelId);

  if (operation === "synthesis") {
    // Synthesis needs extra time due to large prompts (all Stage 1 responses + rankings)
    return isProTier ? 600000 : 300000; // 10 min for pro-tier, 5 min for normal
  }

  // Regular query (Stage 1 and Stage 2)
  return isProTier ? 300000 : 240000; // 5 min for pro-tier, 4 min for normal
}

/**
 * Query a single model via AI Gateway (non-streaming)
 */
async function queryModel(
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  timeoutMs: number = 240000 // 4 minute default timeout
): Promise<string> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Model ${modelId} request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse ranking from model evaluation response
 * Expects format like "FINAL RANKING: A > B > C"
 */
function parseRanking(
  evaluation: string,
  responseCount: number,
  labelToModel: Record<string, string>
): string[] {
  // Try to find "FINAL RANKING:" line
  const rankingMatch = evaluation.match(/FINAL RANKING:\s*([A-Z](?:\s*>\s*[A-Z])*)/i);

  if (rankingMatch) {
    const rankingStr = rankingMatch[1];
    const labels = rankingStr.split(/\s*>\s*/).map((l) => l.trim().toUpperCase());

    // Convert labels to model IDs
    return labels
      .map((label) => labelToModel[`Response ${label}`])
      .filter((id): id is string => id !== undefined);
  }

  // Fallback: try to extract any letter sequence that could be a ranking
  const fallbackMatch = evaluation.match(/([A-Z])\s*>\s*([A-Z])(?:\s*>\s*([A-Z]))*/gi);
  if (fallbackMatch && fallbackMatch.length > 0) {
    const labels = fallbackMatch[0].split(/\s*>\s*/).map((l) => l.trim().toUpperCase());
    return labels
      .map((label) => labelToModel[`Response ${label}`])
      .filter((id): id is string => id !== undefined);
  }

  // If no ranking found, return empty array
  return [];
}

/**
 * Calculate aggregate rankings from all evaluations
 */
function calculateAggregateRankings(
  evaluations: Array<{
    evaluatorModelId: string;
    evaluatorModelName: string;
    parsedRanking: string[];
  }>,
  responses: Array<{ modelId: string; modelName: string }>
): Array<{
  modelId: string;
  modelName: string;
  averageRank: number;
  rankingsCount: number;
}> {
  // Track sum of ranks and count for each model
  const rankData: Record<string, { sum: number; count: number; modelName: string }> = {};

  // Initialize with all response models
  for (const r of responses) {
    rankData[r.modelId] = { sum: 0, count: 0, modelName: r.modelName };
  }

  // Process each evaluation's ranking
  for (const evaluation of evaluations) {
    if (evaluation.parsedRanking.length === 0) continue;

    evaluation.parsedRanking.forEach((modelId, index) => {
      if (rankData[modelId]) {
        rankData[modelId].sum += index + 1; // Rank is 1-indexed
        rankData[modelId].count += 1;
      }
    });
  }

  // Calculate averages and sort
  const results = Object.entries(rankData)
    .map(([modelId, data]) => ({
      modelId,
      modelName: data.modelName,
      averageRank: data.count > 0 ? data.sum / data.count : responses.length + 1,
      rankingsCount: data.count,
    }))
    .sort((a, b) => a.averageRank - b.averageRank);

  return results;
}

// ==================== DEMO AGENT HTTP API ====================

// Hardcoded API key for demo agent endpoints
// In production, use environment variables: process.env.DEMO_AGENT_API_KEY
const DEMO_AGENT_API_KEY = "demo-agent-secret-key-2024";

/**
 * Validate API key from request headers
 */
function validateDemoAgentApiKey(request: Request): boolean {
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
  return apiKey === DEMO_AGENT_API_KEY;
}

/**
 * Create a new thread for Demo AI chat
 * Accessible externally via HTTP POST
 * Requires X-API-Key header
 *
 * Response: { threadId: string } or { error: string }
 */
http.route({
  path: "/demo-agent/create-thread",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    };

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
  }),
});

// Handle CORS preflight for create-thread
http.route({
  path: "/demo-agent/create-thread",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  }),
});

/**
 * Send a message to the Demo AI and get a response
 * Accessible externally via HTTP POST
 * Requires X-API-Key header
 *
 * Request body: { threadId: string, message: string, modelId?: string }
 * Response: { text: string, toolCalls?: [...], toolResults?: [...], usage?: {...}, modelUsed: string } or { error: string }
 */
http.route({
  path: "/demo-agent/send-message",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    };

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
  }),
});

// Handle CORS preflight for send-message
http.route({
  path: "/demo-agent/send-message",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  }),
});

// ==================== TOOL CALL API ====================

// API key for tool call endpoints (used by external agents)
const TOOL_CALL_API_KEY = "tool-call-secret-key-2024";

// Available tools and their internal query mappings
const AVAILABLE_TOOLS = [
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
] as const;
type ToolName = (typeof AVAILABLE_TOOLS)[number];

/**
 * Authenticate request via API key or Bearer token
 * Returns userId if authenticated, null otherwise
 */
async function authenticateToolCall(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request,
  body: { userId?: string }
): Promise<{ userId: string | null; error?: string }> {
  // Try Bearer token auth first (Clerk)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const user = await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
        tokenIdentifier: identity.tokenIdentifier,
      }) as { _id: string } | null;
      if (user) {
        return { userId: user._id };
      }
    }
    return { userId: null, error: "Invalid Bearer token" };
  }

  // Fall back to API key auth
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
  if (apiKey === TOOL_CALL_API_KEY) {
    if (!body.userId) {
      return { userId: null, error: "userId required when using API key auth" };
    }
    return { userId: body.userId };
  }

  return { userId: null, error: "Invalid or missing authentication" };
}

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
http.route({
  path: "/tool-call",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    };

    try {
      // Parse request body
      const body = await request.json() as {
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
          }
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
          }
        );
      }

      // Route to appropriate tool handler
      let result: unknown;

      switch (tool as ToolName) {
        case "get_todays_tasks":
          result = await ctx.runQuery(internal.lifeos.tool_call.getTodaysTasksInternal, {
            userId: auth.userId,
          });
          break;

        case "get_projects":
          result = await ctx.runQuery(internal.lifeos.tool_call.getProjectsInternal, {
            userId: auth.userId,
            status: params?.status as string | undefined,
            includeArchived: params?.includeArchived as boolean | undefined,
          });
          break;

        case "get_project":
          result = await ctx.runQuery(internal.lifeos.tool_call.getProjectInternal, {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
          });
          break;

        case "create_project":
          result = await ctx.runMutation(internal.lifeos.tool_call.createProjectInternal, {
            userId: auth.userId,
            name: params?.name as string,
            key: params?.key as string,
            description: params?.description as string | undefined,
            clientId: params?.clientId as string | undefined,
            status: params?.status as string | undefined,
            priority: params?.priority as string | undefined,
          });
          break;

        case "update_project":
          result = await ctx.runMutation(internal.lifeos.tool_call.updateProjectInternal, {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
            name: params?.name as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            health: params?.health as string | undefined,
            priority: params?.priority as string | undefined,
            clientId: params?.clientId as string | undefined,
          });
          break;

        case "delete_project":
          result = await ctx.runMutation(internal.lifeos.tool_call.deleteProjectInternal, {
            userId: auth.userId,
            projectIdOrKey: params?.projectIdOrKey as string,
          });
          break;

        case "get_tasks":
          result = await ctx.runQuery(internal.lifeos.tool_call.getTasksInternal, {
            userId: auth.userId,
            projectId: params?.projectId as string | undefined,
            status: params?.status as string | undefined,
            priority: params?.priority as string | undefined,
            limit: params?.limit as number | undefined,
          });
          break;

        // Notes/Journal tools
        case "search_notes":
          result = await ctx.runQuery(internal.lifeos.tool_call.searchNotesInternal, {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          });
          break;

        case "get_recent_notes":
          result = await ctx.runQuery(internal.lifeos.tool_call.getRecentNotesInternal, {
            userId: auth.userId,
            limit: params?.limit as number | undefined,
          });
          break;

        case "create_quick_note":
          result = await ctx.runMutation(internal.lifeos.tool_call.createQuickNoteInternal, {
            userId: auth.userId,
            content: params?.content as string,
            tags: params?.tags as string[] | undefined,
          });
          break;

        case "add_tags_to_note":
          result = await ctx.runMutation(internal.lifeos.tool_call.addTagsToNoteInternal, {
            userId: auth.userId,
            noteId: params?.noteId as string,
            tags: params?.tags as string[],
          });
          break;

        // Agenda tools
        case "get_daily_agenda":
          result = await ctx.runQuery(internal.lifeos.tool_call.getDailyAgendaInternal, {
            userId: auth.userId,
            date: params?.date as string | undefined,
            localTime: params?.localTime as string | undefined,
          });
          break;

        case "get_weekly_agenda":
          result = await ctx.runQuery(internal.lifeos.tool_call.getWeeklyAgendaInternal, {
            userId: auth.userId,
            startDate: params?.startDate as string | undefined,
            localTime: params?.localTime as string | undefined,
          });
          break;

        case "get_monthly_agenda":
          result = await ctx.runQuery(internal.lifeos.tool_call.getMonthlyAgendaInternal, {
            userId: auth.userId,
            monthStartDate: params?.monthStartDate as string | undefined,
            localTime: params?.localTime as string | undefined,
          });
          break;

        case "regenerate_daily_summary":
          result = await ctx.runMutation(internal.lifeos.tool_call.regenerateDailySummaryInternal, {
            userId: auth.userId,
            date: params?.date as string,
            model: params?.model as string | undefined,
          });
          break;

        case "regenerate_weekly_summary":
          result = await ctx.runMutation(internal.lifeos.tool_call.regenerateWeeklySummaryInternal, {
            userId: auth.userId,
            weekStartDate: params?.weekStartDate as string,
            model: params?.model as string | undefined,
          });
          break;

        case "regenerate_monthly_summary":
          result = await ctx.runMutation(internal.lifeos.tool_call.regenerateMonthlySummaryInternal, {
            userId: auth.userId,
            monthStartDate: params?.monthStartDate as string,
            model: params?.model as string | undefined,
          });
          break;

        case "update_weekly_prompt":
          result = await ctx.runMutation(internal.lifeos.tool_call.updateWeeklyPromptInternal, {
            userId: auth.userId,
            weekStartDate: params?.weekStartDate as string,
            customPrompt: params?.customPrompt as string,
          });
          break;

        case "update_monthly_prompt":
          result = await ctx.runMutation(internal.lifeos.tool_call.updateMonthlyPromptInternal, {
            userId: auth.userId,
            monthStartDate: params?.monthStartDate as string,
            customPrompt: params?.customPrompt as string,
          });
          break;

        // Issue Management tools
        case "create_issue":
          result = await ctx.runMutation(internal.lifeos.tool_call.createIssueInternal, {
            userId: auth.userId,
            title: params?.title as string,
            description: params?.description as string | undefined,
            projectIdOrKey: params?.projectIdOrKey as string | undefined,
            priority: params?.priority as string | undefined,
            dueDate: params?.dueDate as string | undefined,
            cycleId: params?.cycleId as string | undefined,
            phaseId: params?.phaseId as string | undefined,
          });
          break;

        case "mark_issue_complete":
          result = await ctx.runMutation(internal.lifeos.tool_call.markIssueCompleteInternal, {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
          });
          break;

        case "get_issue":
          result = await ctx.runQuery(internal.lifeos.tool_call.getIssueInternal, {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
          });
          break;

        case "update_issue":
          result = await ctx.runMutation(internal.lifeos.tool_call.updateIssueInternal, {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            title: params?.title as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            priority: params?.priority as string | undefined,
            dueDate: params?.dueDate as string | undefined,
            isTopPriority: params?.isTopPriority as boolean | undefined,
          });
          break;

        case "delete_issue":
          result = await ctx.runMutation(internal.lifeos.tool_call.deleteIssueInternal, {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
          });
          break;

        // Cycle Management tools
        case "get_current_cycle":
          result = await ctx.runQuery(internal.lifeos.tool_call.getCurrentCycleInternal, {
            userId: auth.userId,
          });
          break;

        case "assign_issue_to_cycle":
          result = await ctx.runMutation(internal.lifeos.tool_call.assignIssueToCycleInternal, {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            cycleId: params?.cycleId as string | undefined,
          });
          break;

        case "get_cycles":
          result = await ctx.runQuery(internal.lifeos.tool_call.getCyclesInternal, {
            userId: auth.userId,
            status: params?.status as string | undefined,
            limit: params?.limit as number | undefined,
          });
          break;

        case "create_cycle":
          result = await ctx.runMutation(internal.lifeos.tool_call.createCycleInternal, {
            userId: auth.userId,
            name: params?.name as string | undefined,
            startDate: params?.startDate as string,
            endDate: params?.endDate as string,
            goals: params?.goals as string | undefined,
          });
          break;

        case "update_cycle":
          result = await ctx.runMutation(internal.lifeos.tool_call.updateCycleInternal, {
            userId: auth.userId,
            cycleId: params?.cycleId as string,
            name: params?.name as string | undefined,
            startDate: params?.startDate as string | undefined,
            endDate: params?.endDate as string | undefined,
            status: params?.status as string | undefined,
            goals: params?.goals as string | undefined,
          });
          break;

        case "delete_cycle":
          result = await ctx.runMutation(internal.lifeos.tool_call.deleteCycleInternal, {
            userId: auth.userId,
            cycleId: params?.cycleId as string,
          });
          break;

        // FRM (Friend Relationship Management) tools
        case "get_people":
          result = await ctx.runQuery(internal.lifeos.tool_call.getPeopleInternal, {
            userId: auth.userId,
            relationshipType: params?.relationshipType as string | undefined,
            includeArchived: params?.includeArchived as boolean | undefined,
            limit: params?.limit as number | undefined,
          });
          break;

        case "get_person":
          result = await ctx.runQuery(internal.lifeos.tool_call.getPersonInternal, {
            userId: auth.userId,
            personId: params?.personId as string,
          });
          break;

        case "search_people":
          result = await ctx.runQuery(internal.lifeos.tool_call.searchPeopleInternal, {
            userId: auth.userId,
            query: params?.query as string,
            limit: params?.limit as number | undefined,
          });
          break;

        case "get_memos_for_person":
          result = await ctx.runQuery(internal.lifeos.tool_call.getMemosForPersonInternal, {
            userId: auth.userId,
            personId: params?.personId as string,
            limit: params?.limit as number | undefined,
          });
          break;

        case "get_person_timeline":
          result = await ctx.runQuery(internal.lifeos.tool_call.getPersonTimelineInternal, {
            userId: auth.userId,
            personId: params?.personId as string | undefined,
            limit: params?.limit as number | undefined,
          });
          break;

        case "create_person":
          result = await ctx.runMutation(internal.lifeos.tool_call.createPersonInternal, {
            userId: auth.userId,
            name: params?.name as string,
            nickname: params?.nickname as string | undefined,
            relationshipType: params?.relationshipType as string | undefined,
            avatarEmoji: params?.avatarEmoji as string | undefined,
            notes: params?.notes as string | undefined,
          });
          break;

        case "update_person":
          result = await ctx.runMutation(internal.lifeos.tool_call.updatePersonInternal, {
            userId: auth.userId,
            personId: params?.personId as string,
            name: params?.name as string | undefined,
            nickname: params?.nickname as string | undefined,
            relationshipType: params?.relationshipType as string | undefined,
            email: params?.email as string | undefined,
            phone: params?.phone as string | undefined,
            notes: params?.notes as string | undefined,
          });
          break;

        case "link_memo_to_person":
          result = await ctx.runMutation(internal.lifeos.tool_call.linkMemoToPersonInternal, {
            userId: auth.userId,
            personId: params?.personId as string,
            voiceMemoId: params?.voiceMemoId as string,
            context: params?.context as string | undefined,
          });
          break;

        // Client Management tools
        case "get_clients":
          result = await ctx.runQuery(internal.lifeos.tool_call.getClientsInternal, {
            userId: auth.userId,
            status: params?.status as string | undefined,
          });
          break;

        case "get_client":
          result = await ctx.runQuery(internal.lifeos.tool_call.getClientInternal, {
            userId: auth.userId,
            clientId: params?.clientId as string,
          });
          break;

        case "get_projects_for_client":
          result = await ctx.runQuery(internal.lifeos.tool_call.getProjectsForClientInternal, {
            userId: auth.userId,
            clientId: params?.clientId as string,
          });
          break;

        case "create_client":
          result = await ctx.runMutation(internal.lifeos.tool_call.createClientInternal, {
            userId: auth.userId,
            name: params?.name as string,
            description: params?.description as string | undefined,
          });
          break;

        case "update_client":
          result = await ctx.runMutation(internal.lifeos.tool_call.updateClientInternal, {
            userId: auth.userId,
            clientId: params?.clientId as string,
            name: params?.name as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
          });
          break;

        case "delete_client":
          result = await ctx.runMutation(internal.lifeos.tool_call.deleteClientInternal, {
            userId: auth.userId,
            clientId: params?.clientId as string,
          });
          break;

        // Phase Management tools
        case "get_phases":
          result = await ctx.runQuery(internal.lifeos.tool_call.getPhasesInternal, {
            userId: auth.userId,
            projectId: params?.projectId as string,
          });
          break;

        case "get_phase":
          result = await ctx.runQuery(internal.lifeos.tool_call.getPhaseInternal, {
            userId: auth.userId,
            phaseId: params?.phaseId as string,
          });
          break;

        case "create_phase":
          result = await ctx.runMutation(internal.lifeos.tool_call.createPhaseInternal, {
            userId: auth.userId,
            projectId: params?.projectId as string,
            name: params?.name as string,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
          });
          break;

        case "update_phase":
          result = await ctx.runMutation(internal.lifeos.tool_call.updatePhaseInternal, {
            userId: auth.userId,
            phaseId: params?.phaseId as string,
            name: params?.name as string | undefined,
            description: params?.description as string | undefined,
            status: params?.status as string | undefined,
            startDate: params?.startDate as string | undefined,
            endDate: params?.endDate as string | undefined,
          });
          break;

        case "delete_phase":
          result = await ctx.runMutation(internal.lifeos.tool_call.deletePhaseInternal, {
            userId: auth.userId,
            phaseId: params?.phaseId as string,
          });
          break;

        case "assign_issue_to_phase":
          result = await ctx.runMutation(internal.lifeos.tool_call.assignIssueToPhaseInternal, {
            userId: auth.userId,
            issueIdOrIdentifier: params?.issueIdOrIdentifier as string,
            phaseId: params?.phaseId as string | undefined,
          });
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
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// Handle CORS preflight for tool-call
http.route({
  path: "/tool-call",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  }),
});

// ==================== VOICE AGENT HTTP API (DEPRECATED) ====================
// Use /tool-call with tool: "get_todays_tasks" instead

// API key for voice agent endpoints (kept for backwards compatibility)
const VOICE_AGENT_API_KEY = "voice-agent-secret-key-2024";

/**
 * @deprecated Use /tool-call with tool: "get_todays_tasks" instead
 * Get today's tasks for voice agent
 * Used by LiveKit voice agent to retrieve user's tasks
 *
 * Request body: { userId: string }
 * Response: { tasks: [...], summary: {...} } or { error: string }
 */
http.route({
  path: "/voice-agent/todays-tasks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      "X-Deprecated": "Use /tool-call with tool: get_todays_tasks instead",
    };

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
  }),
});

// Handle CORS preflight for voice-agent/todays-tasks
http.route({
  path: "/voice-agent/todays-tasks",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
      },
    });
  }),
});

// ==================== CONTROLPLANE HTTP API ====================
// These endpoints are used by the Go controlplane backend and frontend
// Auth: X-API-Key header (for Go backend) or Bearer token (for frontend)

const CONTROLPLANE_API_KEY = process.env.CONTROLPLANE_API_KEY || "controlplane-api-key-2024";

const CONTROLPLANE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

/**
 * Authenticate controlplane request via API key or Bearer token
 */
async function authenticateControlplane(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request
): Promise<{ authenticated: boolean; error?: string }> {
  // Try Bearer token auth first (Clerk)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      return { authenticated: true };
    }
    return { authenticated: false, error: "Invalid Bearer token" };
  }

  // Fall back to API key auth
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
  if (apiKey === CONTROLPLANE_API_KEY) {
    return { authenticated: true };
  }

  return { authenticated: false, error: "Invalid or missing authentication" };
}

// --- Agent Configs ---

/**
 * GET /controlplane/configs - List all agent configs
 * POST /controlplane/configs - Create a new agent config
 */
http.route({
  path: "/controlplane/configs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const configs = await ctx.runQuery(api.lifeos.controlplane.listAgentConfigs, {});
      return new Response(JSON.stringify(configs), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/configs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json() as {
        name: string;
        repos?: string;
        taskPrompt?: string;
        systemPrompt?: string;
        maxTurns?: number;
        maxBudgetUsd?: number;
        cpuLimit?: string;
        memoryLimit?: string;
        allowedTools?: string;
        enabledMcps?: string;
        enabledSkills?: string;
      };

      if (!body.name) {
        return new Response(JSON.stringify({ error: "Name is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createAgentConfig, {
        name: body.name,
        repos: body.repos,
        taskPrompt: body.taskPrompt,
        systemPrompt: body.systemPrompt,
        maxTurns: body.maxTurns,
        maxBudgetUsd: body.maxBudgetUsd,
        cpuLimit: body.cpuLimit,
        memoryLimit: body.memoryLimit,
        allowedTools: body.allowedTools,
        enabledMcps: body.enabledMcps,
        enabledSkills: body.enabledSkills,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/configs",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/config?id=xxx - Get a single agent config
 * PUT /controlplane/config?id=xxx - Update an agent config
 * DELETE /controlplane/config?id=xxx - Delete an agent config
 */
http.route({
  path: "/controlplane/config",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneAgentConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const config = await ctx.runQuery(api.lifeos.controlplane.getAgentConfig, { id });
      if (!config) {
        return new Response(JSON.stringify({ error: "Config not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/config",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneAgentConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = await request.json() as {
        name: string;
        repos?: string;
        taskPrompt?: string;
        systemPrompt?: string;
        maxTurns?: number;
        maxBudgetUsd?: number;
        cpuLimit?: string;
        memoryLimit?: string;
        allowedTools?: string;
        enabledMcps?: string;
        enabledSkills?: string;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateAgentConfig, {
        id,
        name: body.name,
        repos: body.repos,
        taskPrompt: body.taskPrompt,
        systemPrompt: body.systemPrompt,
        maxTurns: body.maxTurns,
        maxBudgetUsd: body.maxBudgetUsd,
        cpuLimit: body.cpuLimit,
        memoryLimit: body.memoryLimit,
        allowedTools: body.allowedTools,
        enabledMcps: body.enabledMcps,
        enabledSkills: body.enabledSkills,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/config",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneAgentConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteAgentConfig, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/config",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

// --- MCP Configs ---

/**
 * GET /controlplane/mcp-configs - List all MCP configs
 * POST /controlplane/mcp-configs - Create a new MCP config
 */
http.route({
  path: "/controlplane/mcp-configs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const enabledOnly = new URL(request.url).searchParams.get("enabled") === "true";
      const configs = enabledOnly
        ? await ctx.runQuery(api.lifeos.controlplane.getEnabledMcpConfigs, {})
        : await ctx.runQuery(api.lifeos.controlplane.listMcpConfigs, {});

      return new Response(JSON.stringify(configs), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/mcp-configs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json() as {
        name: string;
        content: string;
        isDefault?: boolean;
        enabled?: boolean;
      };

      if (!body.name || !body.content) {
        return new Response(JSON.stringify({ error: "Name and content are required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createMcpConfig, {
        name: body.name,
        content: body.content,
        isDefault: body.isDefault,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/mcp-configs",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/mcp-config?id=xxx - Get a single MCP config
 * PUT /controlplane/mcp-config?id=xxx - Update an MCP config
 * DELETE /controlplane/mcp-config?id=xxx - Delete an MCP config
 */
http.route({
  path: "/controlplane/mcp-config",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneMcpConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const config = await ctx.runQuery(api.lifeos.controlplane.getMcpConfig, { id });
      if (!config) {
        return new Response(JSON.stringify({ error: "MCP config not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/mcp-config",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneMcpConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = await request.json() as {
        content?: string;
        enabled?: boolean;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateMcpConfig, {
        id,
        content: body.content,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/mcp-config",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneMcpConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteMcpConfig, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/mcp-config",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

// --- Skills ---

/**
 * GET /controlplane/skills - List all skills
 * POST /controlplane/skills - Create a new skill
 */
http.route({
  path: "/controlplane/skills",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const enabledOnly = new URL(request.url).searchParams.get("enabled") === "true";
      const skills = enabledOnly
        ? await ctx.runQuery(api.lifeos.controlplane.getEnabledSkills, {})
        : await ctx.runQuery(api.lifeos.controlplane.listSkills, {});

      return new Response(JSON.stringify(skills), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/skills",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json() as {
        name: string;
        installCommand: string;
        description?: string;
        category?: string;
        isBuiltin?: boolean;
        enabled?: boolean;
      };

      if (!body.name || !body.installCommand) {
        return new Response(JSON.stringify({ error: "Name and installCommand are required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createSkill, {
        name: body.name,
        installCommand: body.installCommand,
        description: body.description,
        category: body.category,
        isBuiltin: body.isBuiltin,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/skills",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/skill?id=xxx - Get a single skill
 * PUT /controlplane/skill?id=xxx - Update a skill
 * DELETE /controlplane/skill?id=xxx - Delete a skill
 */
http.route({
  path: "/controlplane/skill",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneSkills">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const skill = await ctx.runQuery(api.lifeos.controlplane.getSkill, { id });
      if (!skill) {
        return new Response(JSON.stringify({ error: "Skill not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(skill), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/skill",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneSkills">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = await request.json() as {
        installCommand?: string;
        description?: string;
        category?: string;
        enabled?: boolean;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateSkill, {
        id,
        installCommand: body.installCommand,
        description: body.description,
        category: body.category,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/skill",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneSkills">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteSkill, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/skill",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/skill-by-name?name=xxx - Get a skill by name
 */
http.route({
  path: "/controlplane/skill-by-name",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const skill = await ctx.runQuery(api.lifeos.controlplane.getSkillByName, { name });
      if (!skill) {
        return new Response(JSON.stringify({ error: "Skill not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(skill), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/skill-by-name",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/mcp-config-by-name?name=xxx - Get an MCP config by name
 */
http.route({
  path: "/controlplane/mcp-config-by-name",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const config = await ctx.runQuery(api.lifeos.controlplane.getMcpConfigByName, { name });
      if (!config) {
        return new Response(JSON.stringify({ error: "MCP config not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/mcp-config-by-name",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/conversation-by-thread?threadId=xxx - Get conversation by thread ID
 * POST /controlplane/conversation-by-thread?threadId=xxx - Get or create conversation by thread ID
 */
http.route({
  path: "/controlplane/conversation-by-thread",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const threadId = url.searchParams.get("threadId");

      if (!threadId) {
        return new Response(JSON.stringify({ error: "threadId is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const conversation = await ctx.runQuery(api.lifeos.controlplane.getConversationByThreadId, { threadId });
      if (!conversation) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(conversation), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/conversation-by-thread",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

// --- Conversations ---

/**
 * GET /controlplane/conversations - List conversations
 * POST /controlplane/conversations - Create a new conversation
 */
http.route({
  path: "/controlplane/conversations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const includeArchived = url.searchParams.get("includeArchived") === "true";

      const conversations = await ctx.runQuery(api.lifeos.controlplane.listConversations, {
        limit,
        includeArchived,
      });

      return new Response(JSON.stringify(conversations), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/conversations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json() as {
        agentConfigId?: Id<"lifeos_controlplaneAgentConfigs">;
        podName?: string;
        threadId: string;
        title?: string;
      };

      if (!body.threadId) {
        return new Response(JSON.stringify({ error: "threadId is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createConversation, {
        agentConfigId: body.agentConfigId,
        podName: body.podName,
        threadId: body.threadId,
        title: body.title,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/conversations",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

/**
 * GET /controlplane/conversation?id=xxx - Get a conversation
 * PUT /controlplane/conversation?id=xxx - Update a conversation
 * DELETE /controlplane/conversation?id=xxx - Delete a conversation
 */
http.route({
  path: "/controlplane/conversation",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneConversations">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const conversation = await ctx.runQuery(api.lifeos.controlplane.getConversation, { id });
      if (!conversation) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(conversation), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/conversation",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneConversations">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = await request.json() as {
        title?: string;
        isArchived?: boolean;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateConversation, {
        id,
        title: body.title,
        isArchived: body.isArchived,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/conversation",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneConversations">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteConversation, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/conversation",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

// --- Messages ---

/**
 * GET /controlplane/messages?conversationId=xxx - Get messages for a conversation
 * POST /controlplane/messages - Add a message to a conversation
 */
http.route({
  path: "/controlplane/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const conversationId = url.searchParams.get("conversationId") as Id<"lifeos_controlplaneConversations">;
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);

      if (!conversationId) {
        return new Response(JSON.stringify({ error: "conversationId is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const messages = await ctx.runQuery(api.lifeos.controlplane.getMessages, {
        conversationId,
        limit,
      });

      return new Response(JSON.stringify(messages), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json() as {
        conversationId: Id<"lifeos_controlplaneConversations">;
        role: "user" | "assistant" | "system";
        content: string;
        metadata?: {
          toolCalls?: Array<{
            name: string;
            input?: string;
            output?: string;
          }>;
          model?: string;
          tokens?: {
            prompt?: number;
            completion?: number;
          };
          error?: string;
        };
      };

      if (!body.conversationId || !body.role || !body.content) {
        return new Response(JSON.stringify({ error: "conversationId, role, and content are required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.addMessage, {
        conversationId: body.conversationId,
        role: body.role,
        content: body.content,
        metadata: body.metadata,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/controlplane/messages",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
  }),
});

export default http;
