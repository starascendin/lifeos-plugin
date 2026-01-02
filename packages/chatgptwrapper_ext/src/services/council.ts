import type { Stage1Result, Stage2Result, AggregateRanking, ResponseEvaluation, CriterionScore } from '../store/councilStore';
import type { LLMType } from '../config/llm';

/**
 * Build the ranking prompt for Stage 2.
 * Responses are anonymized as Response A, B, C.
 */
export function buildRankingPrompt(
  query: string,
  responses: Stage1Result[]
): { prompt: string; labelToModel: Record<string, { model: string; llmType: LLMType }> } {
  const labels = responses.map((_, i) => String.fromCharCode(65 + i)); // A, B, C

  const labelToModel: Record<string, { model: string; llmType: LLMType }> = {};
  labels.forEach((label, i) => {
    labelToModel[`Response ${label}`] = {
      model: responses[i].model,
      llmType: responses[i].llmType
    };
  });

  const responsesText = responses
    .map((r, i) => `Response ${labels[i]}:\n${r.response}`)
    .join('\n\n');

  const prompt = `You are evaluating different responses to the following question:

Question: ${query}

Here are the responses from different models (anonymized):

${responsesText}

Your task: Evaluate each response using a structured format with scores from 1-5 for each criterion.

**SCORING SCALE (use 3 as baseline):**
- 5 = Excellent - Exceptional quality, goes above and beyond
- 4 = Good - Above average, notably strong
- 3 = Average - Meets expectations, baseline acceptable quality
- 2 = Below Average - Has notable deficiencies
- 1 = Poor - Seriously flawed or inadequate

**IMPORTANT SCORING RULES:**
- A score of 3 should be your baseline for acceptable responses
- Reserve 4 and 5 for genuinely strong aspects - you MUST provide specific reasons why it exceeds baseline
- Use 2 and 1 for genuine weaknesses - you MUST explain what specific issues caused points to be docked
- Do NOT inflate scores - average responses should receive 3s

For EACH response, provide an evaluation in this EXACT format:

=== EVALUATION: Response X ===
| Criterion | Score | Justification |
|-----------|-------|---------------|
| Accuracy | [1-5] | [If 4-5: specific reasons why it excels. If 1-2: specific issues that caused deduction. If 3: why it meets baseline.] |
| Completeness | [1-5] | [If 4-5: specific reasons why it excels. If 1-2: specific issues that caused deduction. If 3: why it meets baseline.] |
| Clarity | [1-5] | [If 4-5: specific reasons why it excels. If 1-2: specific issues that caused deduction. If 3: why it meets baseline.] |
| Relevance | [1-5] | [If 4-5: specific reasons why it excels. If 1-2: specific issues that caused deduction. If 3: why it meets baseline.] |
| Reasoning | [1-5] | [If 4-5: specific reasons why it excels. If 1-2: specific issues that caused deduction. If 3: why it meets baseline.] |

STRENGTHS (specific examples that earned high scores):
- [Strength 1 with reference to content]
- [Strength 2 with reference to content]

WEAKNESSES (specific issues that caused point deductions):
- [Weakness 1 with reference to content]
- [Weakness 2 with reference to content]

POINTS ADDED (reasons for scores above 3 baseline):
- [Criterion]: [Specific reason why this exceeded baseline and earned 4 or 5]

POINTS DOCKED (reasons for scores below 3 baseline):
- [Criterion]: [Specific reason why this fell below baseline and earned 1 or 2]

TOTAL SCORE: [Sum of all scores, max 25. Note: 15/25 = baseline average]
=== END EVALUATION ===

After evaluating ALL responses, provide your final ranking:

FINAL RANKING:
1. Response [Letter]
2. Response [Letter]
3. Response [Letter]

Now provide your structured evaluation for each response:`;

  return { prompt, labelToModel };
}

/**
 * Build the synthesis prompt for Stage 3 (Chairman).
 */
export function buildSynthesisPrompt(
  query: string,
  stage1Results: Stage1Result[],
  stage2Results: Stage2Result[]
): string {
  const stage1Text = stage1Results
    .map((r) => `Model: ${r.model}\nResponse: ${r.response}`)
    .join('\n\n');

  const stage2Text = stage2Results
    .map((r) => `Model: ${r.model}\nRanking: ${r.ranking}`)
    .join('\n\n');

  return `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${query}

STAGE 1 - Individual Responses:
${stage1Text}

STAGE 2 - Peer Rankings:
${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;
}

/**
 * Parse the FINAL RANKING section from a model's response.
 */
export function parseRanking(rankingText: string): string[] {
  // Look for "FINAL RANKING:" section
  if (rankingText.includes('FINAL RANKING:')) {
    const parts = rankingText.split('FINAL RANKING:');
    if (parts.length >= 2) {
      const rankingSection = parts[1];

      // Try to extract numbered list format (e.g., "1. Response A")
      const numberedMatches = rankingSection.match(/\d+\.\s*Response [A-Z]/g);
      if (numberedMatches) {
        return numberedMatches.map((m) => {
          const match = m.match(/Response [A-Z]/);
          return match ? match[0] : '';
        }).filter(Boolean);
      }

      // Fallback: Extract all "Response X" patterns in order
      const matches = rankingSection.match(/Response [A-Z]/g);
      if (matches) return matches;
    }
  }

  // Fallback: try to find any "Response X" patterns in order
  const matches = rankingText.match(/Response [A-Z]/g);
  return matches || [];
}

/**
 * Parse structured evaluations from the ranking text.
 */
export function parseEvaluations(rankingText: string): ResponseEvaluation[] {
  const evaluations: ResponseEvaluation[] = [];

  // Find all evaluation blocks
  const evalPattern = /=== EVALUATION: (Response [A-Z]) ===([\s\S]*?)(?:=== END EVALUATION ===|=== EVALUATION:|FINAL RANKING:)/g;
  let match;

  while ((match = evalPattern.exec(rankingText)) !== null) {
    const responseLabel = match[1];
    const evalBlock = match[2];

    const evaluation: ResponseEvaluation = {
      responseLabel,
      scores: [],
      totalScore: 0,
      strengths: [],
      weaknesses: [],
      pointsAdded: [],
      pointsDocked: []
    };

    // Parse table rows for scores
    // Match rows like: | Accuracy | 4 | Good coverage |
    const tableRowPattern = /\|\s*(Accuracy|Completeness|Clarity|Relevance|Reasoning)\s*\|\s*(\d)\s*\|\s*([^|]+)\|/gi;
    let rowMatch;
    while ((rowMatch = tableRowPattern.exec(evalBlock)) !== null) {
      const score: CriterionScore = {
        criterion: rowMatch[1],
        score: parseInt(rowMatch[2], 10),
        assessment: rowMatch[3].trim()
      };
      evaluation.scores.push(score);
    }

    // Parse STRENGTHS
    const strengthsMatch = evalBlock.match(/STRENGTHS:\s*([\s\S]*?)(?:WEAKNESSES:|POINTS DOCKED:|TOTAL SCORE:|$)/i);
    if (strengthsMatch) {
      const lines = strengthsMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned && !cleaned.startsWith('|')) {
          evaluation.strengths.push(cleaned);
        }
      }
    }

    // Parse WEAKNESSES
    const weaknessesMatch = evalBlock.match(/WEAKNESSES:\s*([\s\S]*?)(?:POINTS DOCKED:|TOTAL SCORE:|$)/i);
    if (weaknessesMatch) {
      const lines = weaknessesMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned && !cleaned.startsWith('|')) {
          evaluation.weaknesses.push(cleaned);
        }
      }
    }

    // Parse POINTS ADDED
    const addedMatch = evalBlock.match(/POINTS ADDED[^:]*:\s*([\s\S]*?)(?:POINTS DOCKED|TOTAL SCORE:|$)/i);
    if (addedMatch) {
      const lines = addedMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned && !cleaned.startsWith('|') && cleaned.toLowerCase() !== 'none' && cleaned.toLowerCase() !== 'n/a') {
          evaluation.pointsAdded.push(cleaned);
        }
      }
    }

    // Parse POINTS DOCKED
    const dockedMatch = evalBlock.match(/POINTS DOCKED[^:]*:\s*([\s\S]*?)(?:TOTAL SCORE:|$)/i);
    if (dockedMatch) {
      const lines = dockedMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned && !cleaned.startsWith('|') && cleaned.toLowerCase() !== 'none' && cleaned.toLowerCase() !== 'n/a') {
          evaluation.pointsDocked.push(cleaned);
        }
      }
    }

    // Parse TOTAL SCORE
    const totalMatch = evalBlock.match(/TOTAL SCORE:\s*(\d+)/i);
    if (totalMatch) {
      evaluation.totalScore = parseInt(totalMatch[1], 10);
    } else {
      // Calculate from individual scores if not found
      evaluation.totalScore = evaluation.scores.reduce((sum, s) => sum + s.score, 0);
    }

    evaluations.push(evaluation);
  }

  return evaluations;
}

/**
 * Calculate aggregate rankings across all models.
 */
export function calculateAggregateRankings(
  stage2Results: Stage2Result[],
  labelToModel: Record<string, { model: string; llmType: LLMType }>
): AggregateRanking[] {
  const modelPositions: Record<string, { positions: number[]; llmType: LLMType }> = {};

  for (const ranking of stage2Results) {
    const parsedRanking = ranking.parsedRanking;

    for (let position = 0; position < parsedRanking.length; position++) {
      const label = parsedRanking[position];
      if (label in labelToModel) {
        const { model, llmType } = labelToModel[label];
        if (!modelPositions[model]) {
          modelPositions[model] = { positions: [], llmType };
        }
        modelPositions[model].positions.push(position + 1); // 1-indexed
      }
    }
  }

  const aggregate: AggregateRanking[] = [];
  for (const [model, data] of Object.entries(modelPositions)) {
    if (data.positions.length > 0) {
      const avgRank = data.positions.reduce((a, b) => a + b, 0) / data.positions.length;
      aggregate.push({
        model,
        llmType: data.llmType,
        averageRank: Math.round(avgRank * 100) / 100,
        rankingsCount: data.positions.length
      });
    }
  }

  // Sort by average rank (lower is better)
  aggregate.sort((a, b) => a.averageRank - b.averageRank);

  return aggregate;
}

/**
 * De-anonymize text by replacing "Response A" with the actual model name.
 */
export function deAnonymize(
  text: string,
  labelToModel: Record<string, { model: string; llmType: LLMType }>
): string {
  let result = text;
  for (const [label, { model }] of Object.entries(labelToModel)) {
    result = result.replace(new RegExp(label, 'g'), `**${model}**`);
  }
  return result;
}
