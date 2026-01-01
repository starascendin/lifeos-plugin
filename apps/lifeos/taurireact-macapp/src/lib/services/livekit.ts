import { invoke } from "@tauri-apps/api/core";

// Types matching Rust structs
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

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Generate a LiveKit access token
 */
export async function generateToken(
  roomName: string,
  participantIdentity?: string,
  participantName?: string
): Promise<LiveKitTokenResponse> {
  if (!isTauri) {
    throw new Error("Not running in Tauri");
  }

  return await invoke<LiveKitTokenResponse>("generate_livekit_token", {
    roomName,
    participantIdentity,
    participantName,
  });
}

/**
 * Get LiveKit configuration (server URL and status)
 */
export async function getLiveKitConfig(): Promise<LiveKitConfig> {
  if (!isTauri) {
    return {
      server_url: "",
      is_configured: false,
    };
  }

  return await invoke<LiveKitConfig>("get_livekit_config");
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
