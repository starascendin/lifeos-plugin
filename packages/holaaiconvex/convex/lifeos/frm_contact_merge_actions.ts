"use node";

import { action } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

// ==================== TYPES ====================

interface MergeSuggestion {
  targetPersonId: string;
  sourcePersonId: string;
  targetName: string;
  sourceName: string;
  confidence: number;
  reasons: string[];
  matchedFields: {
    email?: { target: string; source: string };
    phone?: { target: string; source: string };
    name?: { target: string; source: string; similarity: number };
  };
}

// ==================== ACTIONS ====================

/**
 * Analyze contacts and generate merge suggestions using AI
 */
export const analyzeMergeSuggestions = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.lifeos.frm_people.getPeople, {
      includeArchived: false,
    });

    if (!user || user.length < 2) {
      return { success: true, suggestionsCount: 0, message: "Not enough contacts to analyze" };
    }

    const people = user;

    // Step 1: Find obvious matches (same email, same phone)
    const suggestions: MergeSuggestion[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const personA = people[i];
        const personB = people[j];

        const pairKey = [personA._id, personB._id].sort().join("-");
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const matchedFields: MergeSuggestion["matchedFields"] = {};
        const reasons: string[] = [];
        let confidence = 0;

        // Check email match
        if (personA.email && personB.email) {
          const emailA = personA.email.toLowerCase().trim();
          const emailB = personB.email.toLowerCase().trim();
          if (emailA === emailB) {
            matchedFields.email = { target: emailA, source: emailB };
            reasons.push("Same email address");
            confidence += 0.8;
          }
        }

        // Check phone match
        if (personA.phone && personB.phone) {
          const phoneA = personA.phone.replace(/\D/g, "");
          const phoneB = personB.phone.replace(/\D/g, "");
          if (phoneA === phoneB && phoneA.length >= 7) {
            matchedFields.phone = { target: personA.phone, source: personB.phone };
            reasons.push("Same phone number");
            confidence += 0.7;
          }
        }

        // Check name similarity
        const nameA = personA.name.toLowerCase().trim();
        const nameB = personB.name.toLowerCase().trim();
        const nameSimilarity = calculateNameSimilarity(nameA, nameB);

        if (nameSimilarity > 0.8) {
          matchedFields.name = { target: personA.name, source: personB.name, similarity: nameSimilarity };
          reasons.push(`Similar names (${Math.round(nameSimilarity * 100)}% match)`);
          confidence += nameSimilarity * 0.5;
        }

        // Only suggest if confidence is above threshold
        if (confidence >= 0.5 && reasons.length > 0) {
          // Determine target (prefer the one with more data)
          const scoreA = (personA.memoCount || 0) * 2 + (personA.email ? 1 : 0) + (personA.phone ? 1 : 0);
          const scoreB = (personB.memoCount || 0) * 2 + (personB.email ? 1 : 0) + (personB.phone ? 1 : 0);

          const [target, source] = scoreA >= scoreB ? [personA, personB] : [personB, personA];

          suggestions.push({
            targetPersonId: target._id,
            sourcePersonId: source._id,
            targetName: target.name,
            sourceName: source.name,
            confidence: Math.min(confidence, 1),
            reasons,
            matchedFields,
          });
        }
      }
    }

    // Step 2: Use AI for more complex matching if we have OpenRouter configured
    let aiSuggestions: MergeSuggestion[] = [];
    if (suggestions.length < 10 && people.length <= 50) {
      aiSuggestions = await findAIMergeSuggestions(people, processedPairs);
    }

    const allSuggestions = [...suggestions, ...aiSuggestions];

    // Step 3: Store suggestions in database
    for (const suggestion of allSuggestions) {
      await ctx.runMutation(internal.lifeos.frm_contact_merge.createMergeSuggestion, {
        targetPersonId: suggestion.targetPersonId as Id<"lifeos_frmPeople">,
        sourcePersonId: suggestion.sourcePersonId as Id<"lifeos_frmPeople">,
        confidence: suggestion.confidence,
        reasons: suggestion.reasons,
        matchedFields: suggestion.matchedFields,
      });
    }

    return {
      success: true,
      suggestionsCount: allSuggestions.length,
      message: `Found ${allSuggestions.length} potential merge suggestions`,
    };
  },
});

/**
 * Use AI to find potential contact merges
 */
async function findAIMergeSuggestions(
  people: Array<{
    _id: Id<"lifeos_frmPeople">;
    name: string;
    email?: string;
    phone?: string;
    nickname?: string;
    autoCreatedFrom?: string;
  }>,
  alreadyProcessed: Set<string>
): Promise<MergeSuggestion[]> {

  // Prepare contact list for AI analysis
  const contactList = people.map((p, i) => ({
    index: i,
    id: p._id,
    name: p.name,
    nickname: p.nickname,
    email: p.email,
    phone: p.phone,
    source: p.autoCreatedFrom,
  }));

  const prompt = `You are a contact deduplication assistant. Analyze the following contacts and identify potential duplicates that should be merged.

CONTACTS:
${JSON.stringify(contactList, null, 2)}

Find contacts that likely represent the SAME person but have slightly different data. Look for:
- Similar names (nicknames, typos, different formats like "John Smith" vs "J. Smith")
- Same person from different sources (e.g., one from "fathom" and one from "beeper")
- Partial email matches or related email addresses

Return a JSON array of merge suggestions. Each suggestion should have:
- targetIndex: index of the contact to keep (prefer the one with more data)
- sourceIndex: index of the contact to merge into target
- confidence: 0-1 score
- reason: explanation

Only return HIGH confidence matches (0.7+). Return empty array if no matches found.

IMPORTANT: Return ONLY valid JSON array, no other text.`;

  try {
    const result = await generateText({
      model: gateway("google/gemini-2.0-flash"),
      prompt,
      temperature: 0.2,
    });

    const responseText = result.text.trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const aiMatches = JSON.parse(jsonMatch[0]) as Array<{
      targetIndex: number;
      sourceIndex: number;
      confidence: number;
      reason: string;
    }>;

    const suggestions: MergeSuggestion[] = [];

    for (const match of aiMatches) {
      if (match.confidence < 0.7) continue;

      const target = contactList[match.targetIndex];
      const source = contactList[match.sourceIndex];

      if (!target || !source) continue;

      const pairKey = [target.id, source.id].sort().join("-");
      if (alreadyProcessed.has(pairKey)) continue;

      suggestions.push({
        targetPersonId: target.id,
        sourcePersonId: source.id,
        targetName: target.name,
        sourceName: source.name,
        confidence: match.confidence,
        reasons: [match.reason, "AI-detected similarity"],
        matchedFields: {},
      });
    }

    return suggestions;
  } catch (error) {
    console.error("AI merge analysis failed:", error);
    return [];
  }
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(nameA: string, nameB: string): number {
  if (nameA === nameB) return 1;
  if (!nameA || !nameB) return 0;

  // Check if one name is contained in the other
  if (nameA.includes(nameB) || nameB.includes(nameA)) {
    return 0.85;
  }

  // Simple Levenshtein-based similarity
  const matrix: number[][] = [];
  const lenA = nameA.length;
  const lenB = nameB.length;

  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = nameA[i - 1] === nameB[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(lenA, lenB);
  return (maxLen - matrix[lenA][lenB]) / maxLen;
}
