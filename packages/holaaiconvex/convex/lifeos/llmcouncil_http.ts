import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    const data = (await response.json()) as {
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
  _responseCount: number,
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
export const llmCouncilDeliberateHandler = httpAction(async (ctx, request) => {
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
});
