import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Translation API
 * Provides AI-powered translation between Spanish and English
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

/**
 * Translate text between Spanish and English using Gemini AI
 */
export const translateText = action({
  args: {
    text: v.string(),
    sourceLanguage: v.string(), // "es" | "en" | "auto"
    targetLanguage: v.string(), // "es" | "en"
  },
  handler: async (ctx, args): Promise<{
    translation: string;
    detectedLanguage?: string;
    error?: string;
  }> => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        translation: "",
        error: "Translation service not configured",
      };
    }

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
      // Simple language detection based on common patterns
      const spanishIndicators = /[¿¡ñáéíóúü]/i;
      const hasSpanishChars = spanishIndicators.test(args.text);

      // Use AI for better detection
      try {
        const detectResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Detect the language of this text. Reply with ONLY "es" for Spanish or "en" for English, nothing else: "${args.text}"`,
                    },
                  ],
                },
              ],
              generationConfig: {
                maxOutputTokens: 5,
                temperature: 0,
              },
            }),
          }
        );

        if (detectResponse.ok) {
          const detectData = await detectResponse.json();
          const detected =
            detectData.candidates?.[0]?.content?.parts?.[0]?.text
              ?.trim()
              .toLowerCase();
          if (detected === "es" || detected === "en") {
            sourceLanguage = detected;
            detectedLanguage = detected;
          } else {
            // Fallback to character-based detection
            sourceLanguage = hasSpanishChars ? "es" : "en";
            detectedLanguage = sourceLanguage;
          }
        } else {
          sourceLanguage = hasSpanishChars ? "es" : "en";
          detectedLanguage = sourceLanguage;
        }
      } catch {
        sourceLanguage = hasSpanishChars ? "es" : "en";
        detectedLanguage = sourceLanguage;
      }
    }

    // Build the translation prompt
    const fullPrompt = TRANSLATION_PROMPT.replace("{text}", args.text)
      .replace("{sourceLanguage}", sourceLanguage === "es" ? "Spanish" : "English")
      .replace(
        "{targetLanguage}",
        args.targetLanguage === "es" ? "Spanish" : "English"
      );

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.3, // Lower temperature for more accurate translation
              maxOutputTokens: 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          translation: "",
          detectedLanguage,
          error: errorData.error?.message || `Translation failed: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const translation = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

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
      return {
        translation: "",
        detectedLanguage,
        error: error instanceof Error ? error.message : "Translation failed",
      };
    }
  },
});

/**
 * Batch translate multiple texts
 * Useful for translating multiple phrases at once
 */
export const translateBatch = action({
  args: {
    texts: v.array(v.string()),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args): Promise<{
    translations: Array<{ original: string; translation: string; error?: string }>;
  }> => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        translations: args.texts.map((text) => ({
          original: text,
          translation: "",
          error: "Translation service not configured",
        })),
      };
    }

    const batchPrompt = `You are a Spanish-English translator. Translate each of the following texts from ${
      args.sourceLanguage === "es" ? "Spanish" : "English"
    } to ${
      args.targetLanguage === "es" ? "Spanish" : "English"
    }.

Return a JSON array with translations in the same order. Each item should have "original" and "translation" keys.

Texts to translate:
${args.texts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}

Return ONLY valid JSON array:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: batchPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
            },
          }),
        }
      );

      if (!response.ok) {
        return {
          translations: args.texts.map((text) => ({
            original: text,
            translation: "",
            error: "Batch translation failed",
          })),
        };
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(content);

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
      return {
        translations: args.texts.map((text) => ({
          original: text,
          translation: "",
          error: error instanceof Error ? error.message : "Batch translation failed",
        })),
      };
    }
  },
});
