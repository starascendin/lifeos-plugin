import { action } from "../_generated/server";

// ==================== DEVELOPER DIAGNOSTICS ====================

// Test Gemini API connection
export const testGeminiConnection = action({
  handler: async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY not configured" };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Say hello in one word" }] }],
            generationConfig: {
              maxOutputTokens: 10,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          status: response.status,
          error: errorData.error?.message || response.statusText,
        };
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return {
        success: true,
        status: response.status,
        response: responseText || "OK",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Test LiveKit configuration
export const testLiveKitConnection = action({
  handler: async () => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;

    const configured = {
      apiKey: !!apiKey,
      apiSecret: !!apiSecret,
      url: !!url,
    };

    const allConfigured = configured.apiKey && configured.apiSecret && configured.url;

    return {
      success: allConfigured,
      configured,
      url: url || null,
      error: allConfigured ? null : "Missing LiveKit configuration",
    };
  },
});

// Get environment info (non-sensitive)
export const getEnvironmentInfo = action({
  handler: async () => {
    return {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasLiveKitKey: !!process.env.LIVEKIT_API_KEY,
      hasLiveKitSecret: !!process.env.LIVEKIT_API_SECRET,
      livekitUrl: process.env.LIVEKIT_URL || null,
    };
  },
});

// Test Convex connection (basic ping)
export const testConvexConnection = action({
  handler: async () => {
    return {
      success: true,
      message: "Convex connection successful",
      timestamp: new Date().toISOString(),
    };
  },
});
