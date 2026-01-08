"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Translation API
 *
 * Provides AI-powered translation between Spanish and English.
 * Now uses centralized AI service with credit metering.
 */

const TRANSLATION_PROMPT = `You are a Spanish-English translator. Translate the following text accurately and naturally.

Rules:
1. Provide ONLY the translation, no explanations or additional text
2. Maintain the tone and formality of the original text
3. For idiomatic expressions, provide the equivalent expression in the target language if one exists
4. Preserve punctuation and capitalization style

Text to translate: "{text}"
Source language: {sourceLanguage}
Target language: {targetLanguage}

Translation:`;

const LANGUAGE_DETECTION_PROMPT = `Detect the language of this text. Reply with ONLY "es" for Spanish or "en" for English, nothing else: "{text}"`;

/**
 * Translate text between Spanish and English using Gemini AI
 * Now with credit metering via executeAICall
 */
export const translateText = action({
  args: {
    text: v.string(),
    sourceLanguage: v.string(), // "es" | "en" | "auto"
    targetLanguage: v.string(), // "es" | "en"
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    translation: string;
    detectedLanguage?: string;
    error?: string;
  }> => {
    // Validate input
    if (!args.text.trim()) {
      return {
        translation: "",
        error: "No text provided",
      };
    }

    // Detect language if set to auto
    let sourceLanguage = args.sourceLanguage;
    let detectedLanguage: string | undefined;

    if (sourceLanguage === "auto") {
      // Simple language detection based on common patterns (fallback)
      const spanishIndicators = /[¿¡ñáéíóúü]/i;
      const hasSpanishChars = spanishIndicators.test(args.text);

      try {
        // Use AI for better detection
        const detectResult = await ctx.runAction(
          internal.common.ai.executeAICall,
          {
            request: {
              model: "gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: LANGUAGE_DETECTION_PROMPT.replace("{text}", args.text),
                },
              ],
              maxTokens: 5,
              temperature: 0,
            },
            context: {
              feature: "holaai_translate",
              description: "Language detection for translation",
            },
          }
        );

        const detected = detectResult.content?.trim().toLowerCase();
        if (detected === "es" || detected === "en") {
          sourceLanguage = detected;
          detectedLanguage = detected;
        } else {
          // Fallback to character-based detection
          sourceLanguage = hasSpanishChars ? "es" : "en";
          detectedLanguage = sourceLanguage;
        }
      } catch (error) {
        // Fallback to character-based detection on error
        sourceLanguage = hasSpanishChars ? "es" : "en";
        detectedLanguage = sourceLanguage;
        console.error("Language detection failed, using fallback:", error);
      }
    }

    // Build the translation prompt
    const fullPrompt = TRANSLATION_PROMPT.replace("{text}", args.text)
      .replace(
        "{sourceLanguage}",
        sourceLanguage === "es" ? "Spanish" : "English"
      )
      .replace(
        "{targetLanguage}",
        args.targetLanguage === "es" ? "Spanish" : "English"
      );

    try {
      // Use centralized AI service for translation (with credit metering)
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: fullPrompt }],
          maxTokens: 1000,
          temperature: 0.3, // Lower temperature for more accurate translation
        },
        context: {
          feature: "holaai_translate",
          description: `Translate ${sourceLanguage} → ${args.targetLanguage}`,
        },
      });

      const translation = result.content?.trim();

      if (!translation) {
        return {
          translation: "",
          detectedLanguage,
          error: "No translation received",
        };
      }

      return {
        translation,
        detectedLanguage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Translation failed";

      // Check for credit-specific errors
      if (errorMessage.includes("OUT_OF_CREDITS")) {
        return {
          translation: "",
          detectedLanguage,
          error: "You have run out of AI credits. Please request more credits.",
        };
      }

      return {
        translation: "",
        detectedLanguage,
        error: errorMessage,
      };
    }
  },
});

/**
 * Batch translate multiple texts
 * Useful for translating multiple phrases at once
 * Now with credit metering via executeAICall
 */
export const translateBatch = action({
  args: {
    texts: v.array(v.string()),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    translations: Array<{
      original: string;
      translation: string;
      error?: string;
    }>;
  }> => {
    const batchPrompt = `You are a Spanish-English translator. Translate each of the following texts from ${
      args.sourceLanguage === "es" ? "Spanish" : "English"
    } to ${args.targetLanguage === "es" ? "Spanish" : "English"}.

Return a JSON array with translations in the same order. Each item should have "original" and "translation" keys.

Texts to translate:
${args.texts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}

Return ONLY valid JSON array:`;

    try {
      // Use centralized AI service for batch translation (with credit metering)
      const result = await ctx.runAction(internal.common.ai.executeAICall, {
        request: {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: batchPrompt }],
          temperature: 0.3,
          responseFormat: "json",
        },
        context: {
          feature: "holaai_translate",
          description: `Batch translate ${args.texts.length} texts (${args.sourceLanguage} → ${args.targetLanguage})`,
        },
      });

      const parsed = JSON.parse(result.content) as Array<{
        original: string;
        translation: string;
      }>;

      return {
        translations: Array.isArray(parsed)
          ? parsed
          : args.texts.map((text) => ({
              original: text,
              translation: "",
              error: "Invalid response format",
            })),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Batch translation failed";

      // Check for credit-specific errors
      if (errorMessage.includes("OUT_OF_CREDITS")) {
        return {
          translations: args.texts.map((text) => ({
            original: text,
            translation: "",
            error:
              "You have run out of AI credits. Please request more credits.",
          })),
        };
      }

      return {
        translations: args.texts.map((text) => ({
          original: text,
          translation: "",
          error: errorMessage,
        })),
      };
    }
  },
});
