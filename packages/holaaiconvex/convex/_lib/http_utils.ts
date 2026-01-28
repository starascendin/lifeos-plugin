import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Re-export the HttpActionCtx type for use in handler files
export type HttpActionCtx = Parameters<Parameters<typeof httpAction>[0]>[0];

// ==================== CORS HEADERS ====================

export const CHATNEXUS_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const GENERIC_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

export const VOICE_AGENT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

export const CONTROLPLANE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

// ==================== CORS PREFLIGHT FACTORY ====================

export function createCorsPreflightHandler(corsHeaders: Record<string, string>) {
  return httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  });
}

// ==================== RESPONSE HELPERS ====================

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = GENERIC_CORS_HEADERS
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  message: string,
  status = 500,
  headers: Record<string, string> = GENERIC_CORS_HEADERS
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// ==================== API KEYS ====================

export const TOOL_CALL_API_KEY = "tool-call-secret-key-2024";
export const VOICE_AGENT_API_KEY = "voice-agent-secret-key-2024";
export const DEMO_AGENT_API_KEY = "demo-agent-secret-key-2024";
export const CONTROLPLANE_API_KEY = process.env.CONTROLPLANE_API_KEY || "controlplane-api-key-2024";

// ==================== AUTH FUNCTIONS ====================

export async function authenticateToolCall(
  ctx: HttpActionCtx,
  request: Request,
  body: { userId?: string }
): Promise<{ userId: string | null; error?: string }> {
  // Try Bearer token auth first (Clerk)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const user = (await ctx.runQuery(internal.common.users.getUserByTokenIdentifier, {
        tokenIdentifier: identity.tokenIdentifier,
      })) as { _id: string } | null;
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

export async function authenticateControlplane(
  ctx: HttpActionCtx,
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

export function validateDemoAgentApiKey(request: Request): boolean {
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
  return apiKey === DEMO_AGENT_API_KEY;
}
