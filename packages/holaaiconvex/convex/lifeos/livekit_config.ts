/**
 * LiveKit Voice Agent - Configuration Query (default runtime)
 */

import { query } from "../_generated/server";

/**
 * Get LiveKit configuration status
 * Returns public config info (URL) and whether it's fully configured
 */
export const getConfig = query({
  handler: async () => {
    const serverUrl = process.env.LIVEKIT_URL || "";
    const hasApiKey = !!process.env.LIVEKIT_API_KEY;
    const hasApiSecret = !!process.env.LIVEKIT_API_SECRET;

    const isConfigured = !!serverUrl && hasApiKey && hasApiSecret;

    return {
      server_url: isConfigured ? serverUrl : "",
      is_configured: isConfigured,
    };
  },
});
