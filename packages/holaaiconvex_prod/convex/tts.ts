import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Gemini TTS Action
 * Generates Spanish text-to-speech audio using Gemini 2.5 Flash Preview TTS
 * Returns base64-encoded PCM audio at 24kHz, mono, 16-bit
 */
export const generateTTS = action({
  args: {
    text: v.string(),
    voiceName: v.optional(v.string()), // default "Kore" (Spanish-friendly voice)
  },
  handler: async (_ctx, args): Promise<{ audioBase64: string; sampleRate: number; channels: number }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const text = args.text.trim();
    if (!text) {
      throw new Error("Text is required");
    }

    if (text.length > 4000) {
      throw new Error("Text must be less than 4000 characters");
    }

    const voiceName = args.voiceName || "Kore";

    // Using Gemini 2.5 Flash Preview TTS
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text }],
          },
        ],
        generationConfig: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: voiceName,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini TTS API error:", errorText);
      throw new Error(`Gemini TTS API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract base64 audio from response
    const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      console.error("No audio data in Gemini response:", JSON.stringify(data));
      throw new Error("No audio data in response from Gemini");
    }

    return {
      audioBase64,
      sampleRate: 24000,
      channels: 1,
    };
  },
});
