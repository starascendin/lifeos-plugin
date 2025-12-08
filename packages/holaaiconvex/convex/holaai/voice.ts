import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";

// ==================== LIVEKIT INTEGRATION ====================

// Generate a LiveKit access token for a room
export const generateLiveKitToken = action({
  args: {
    roomName: v.string(),
    participantName: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new Error("LiveKit credentials not configured");
    }

    // Create JWT token for LiveKit
    // Using manual JWT creation since we can't use the livekit-server-sdk in Convex
    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: apiKey,
      sub: args.participantName,
      nbf: now,
      exp: now + 6 * 60 * 60, // 6 hour expiry
      video: {
        room: args.roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    // Base64url encode
    const base64UrlEncode = (obj: unknown) => {
      const str = JSON.stringify(obj);
      const base64 = btoa(str);
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    };

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);
    const message = `${headerB64}.${payloadB64}`;

    // Sign with HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const token = `${message}.${signatureB64}`;

    return {
      token,
      url: livekitUrl,
      roomName: args.roomName,
    };
  },
});

// Dispatch a LiveKit agent to join a room
export const dispatchLiveKitAgent = action({
  args: {
    roomName: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      throw new Error("LiveKit credentials not configured");
    }

    // Convert wss:// to https:// for API calls
    const httpUrl = livekitUrl.replace("wss://", "https://");

    // Create auth token for API request
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      iss: apiKey,
      nbf: now,
      exp: now + 60, // Short expiry for API call
      video: {
        roomAdmin: true,
        room: args.roomName,
      },
    };

    const base64UrlEncode = (obj: unknown) => {
      const str = JSON.stringify(obj);
      const base64 = btoa(str);
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    };

    const headerB64 = base64UrlEncode(header);
    const payloadB64 = base64UrlEncode(payload);
    const message = `${headerB64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const authToken = `${message}.${signatureB64}`;

    // Call LiveKit Agent Dispatch API
    const response = await fetch(
      `${httpUrl}/twirp/livekit.AgentDispatchService/CreateDispatch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          room: args.roomName,
          agent_name: "holaai-spanish-tutor",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Agent dispatch error:", errorText);
      throw new Error(`Failed to dispatch agent: ${response.statusText}`);
    }

    return await response.json();
  },
});

// ==================== VOICE CONVERSATIONS ====================

export const listVoiceConversations = query({
  args: {
    userId: v.id("users"),
    provider: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let conversations = await ctx.db
      .query("hola_voiceConversations")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    if (args.provider) {
      conversations = conversations.filter((c) => c.provider === args.provider);
    }

    return conversations;
  },
});

export const getVoiceConversation = query({
  args: { conversationId: v.id("hola_voiceConversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

export const createVoiceConversation = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("hola_voiceConversations", {
      userId: args.userId,
      provider: args.provider,
      title: args.title,
      transcript: [],
      createdAt: Date.now(),
    });
  },
});

export const addTranscriptMessage = mutation({
  args: {
    conversationId: v.id("hola_voiceConversations"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const newMessage = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.conversationId, {
      transcript: [...conversation.transcript, newMessage],
    });

    return newMessage;
  },
});

export const updateVoiceConversation = mutation({
  args: {
    conversationId: v.id("hola_voiceConversations"),
    title: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.duration !== undefined) updates.duration = args.duration;

    await ctx.db.patch(args.conversationId, updates);
  },
});

export const deleteVoiceConversation = mutation({
  args: { conversationId: v.id("hola_voiceConversations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.conversationId);
  },
});

// ==================== STATISTICS ====================

export const getVoiceStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("hola_voiceConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalConversations = conversations.length;
    const totalDuration = conversations.reduce(
      (sum, c) => sum + (c.duration || 0),
      0
    );
    const totalMessages = conversations.reduce(
      (sum, c) => sum + c.transcript.length,
      0
    );

    const byProvider: Record<string, number> = {};
    for (const conv of conversations) {
      byProvider[conv.provider] = (byProvider[conv.provider] || 0) + 1;
    }

    // Recent activity (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentConversations = conversations.filter(
      (c) => c.createdAt >= weekAgo
    ).length;

    return {
      totalConversations,
      totalDuration,
      totalMessages,
      byProvider,
      recentConversations,
      averageDuration:
        totalConversations > 0
          ? Math.round(totalDuration / totalConversations)
          : 0,
    };
  },
});
