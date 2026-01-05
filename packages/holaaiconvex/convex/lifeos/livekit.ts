"use node";

/**
 * LiveKit Voice Agent - Token Generation (Node.js runtime)
 *
 * Generates JWT access tokens for LiveKit connections.
 * Used by both Tauri desktop and web deployments.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import jwt from "jsonwebtoken";

// LiveKit JWT video grant structure
interface VideoGrant {
  roomJoin: boolean;
  room: string;
  canPublish: boolean;
  canSubscribe: boolean;
  canUpdateOwnMetadata: boolean;
}

// LiveKit JWT claims
interface LiveKitClaims {
  exp: number;
  iss: string;
  nbf: number;
  sub: string;
  name: string;
  video: VideoGrant;
  metadata?: string;
}

/**
 * Generate a LiveKit access token for room connection
 */
export const generateToken = action({
  args: {
    roomName: v.string(),
    participantIdentity: v.optional(v.string()),
    participantName: v.optional(v.string()),
    participantMetadata: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const serverUrl = process.env.LIVEKIT_URL;

    if (!apiKey) {
      throw new Error("LIVEKIT_API_KEY not configured in Convex environment");
    }
    if (!apiSecret) {
      throw new Error("LIVEKIT_API_SECRET not configured in Convex environment");
    }
    if (!serverUrl) {
      throw new Error("LIVEKIT_URL not configured in Convex environment");
    }

    // Generate participant identity if not provided
    const identity =
      args.participantIdentity || `user-${crypto.randomUUID().slice(0, 8)}`;
    const name = args.participantName || identity;

    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const expiration = now + 10 * 60; // 10 minutes from now

    // Create claims
    const claims: LiveKitClaims = {
      exp: expiration,
      iss: apiKey,
      nbf: now,
      sub: identity,
      name: name,
      video: {
        roomJoin: true,
        room: args.roomName,
        canPublish: true,
        canSubscribe: true,
        canUpdateOwnMetadata: true,
      },
    };

    if (args.participantMetadata) {
      claims.metadata = args.participantMetadata;
    }

    // Generate JWT token
    const token = jwt.sign(claims, apiSecret, { algorithm: "HS256" });

    return {
      server_url: serverUrl,
      token,
      room_name: args.roomName,
      participant_identity: identity,
    };
  },
});
