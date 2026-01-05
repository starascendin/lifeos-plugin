/**
 * LiveKit Service
 *
 * Provides token generation and config access via Convex.
 * Works for both Tauri desktop and web deployments.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@holaai/convex";

// Types matching Convex response
export interface LiveKitTokenResponse {
  server_url: string;
  token: string;
  room_name: string;
  participant_identity: string;
}

export interface LiveKitConfig {
  server_url: string;
  is_configured: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
}

// Create HTTP client for actions (can't use reactive client for actions in some contexts)
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const httpClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

/**
 * Generate a LiveKit access token via Convex action
 */
export async function generateToken(
  roomName: string,
  participantIdentity?: string,
  participantName?: string,
  participantMetadata?: string
): Promise<LiveKitTokenResponse> {
  if (!httpClient) {
    throw new Error("Convex URL not configured");
  }

  const result = await httpClient.action(api.lifeos.livekit.generateToken, {
    roomName,
    participantIdentity,
    participantName,
    participantMetadata,
  });

  return result;
}

/**
 * Get LiveKit configuration via Convex query
 */
export async function getLiveKitConfig(): Promise<LiveKitConfig> {
  if (!httpClient) {
    return {
      server_url: "",
      is_configured: false,
    };
  }

  const result = await httpClient.query(api.lifeos.livekit_config.getConfig);
  return result;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format a timestamp for display
 */
export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
