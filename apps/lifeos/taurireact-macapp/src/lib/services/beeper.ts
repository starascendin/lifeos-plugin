import { invoke } from "@tauri-apps/api/core";

// Types matching the Rust structs

export interface BeeperThread {
  thread_id: string;
  name: string;
  thread_type: string; // "dm" | "group"
  participant_count: number;
  message_count: number;
  last_message_at: string;
}

export interface BeeperMessage {
  thread_id?: string;
  thread_name?: string;
  sender: string;
  text: string;
  timestamp_readable: string;
}

export interface BeeperSyncResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface BeeperSyncProgress {
  status: "idle" | "checking" | "syncing" | "error" | "complete";
  currentStep: string;
  error?: string;
}

export const initialSyncProgress: BeeperSyncProgress = {
  status: "idle",
  currentStep: "",
};

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Check if Beeper is available (BeeperTexts folder exists)
 */
export async function checkBeeperAvailable(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    return await invoke<boolean>("check_beeper_available");
  } catch (error) {
    console.error("Failed to check Beeper availability:", error);
    return false;
  }
}

/**
 * Check if the Beeper database has been synced (clean.duckdb exists)
 */
export async function checkBeeperDatabaseExists(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    return await invoke<boolean>("check_beeper_database_exists");
  } catch (error) {
    console.error("Failed to check Beeper database:", error);
    return false;
  }
}

/**
 * Sync the Beeper database (runs pnpm sync && pnpm clean)
 */
export async function syncBeeperDatabase(): Promise<BeeperSyncResult> {
  if (!isTauri) {
    return { success: false, error: "Not running in Tauri" };
  }
  try {
    return await invoke<BeeperSyncResult>("sync_beeper_database");
  } catch (error) {
    console.error("Failed to sync Beeper database:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get list of threads/conversations with optional search filter
 */
export async function getBeeperThreads(
  search?: string
): Promise<BeeperThread[]> {
  if (!isTauri) return [];
  try {
    return await invoke<BeeperThread[]>("get_beeper_threads", { search });
  } catch (error) {
    console.error("Failed to get Beeper threads:", error);
    return [];
  }
}

/**
 * Get conversation messages for a specific thread by exact name
 */
export async function getBeeperConversation(
  threadName: string,
  limit?: number
): Promise<BeeperMessage[]> {
  if (!isTauri) return [];
  try {
    return await invoke<BeeperMessage[]>("get_beeper_conversation", {
      threadName,
      limit,
    });
  } catch (error) {
    console.error("Failed to get Beeper conversation:", error);
    return [];
  }
}

/**
 * Get conversation messages for a specific thread by thread ID (preferred)
 * This avoids issues with duplicate thread names like "WhatsApp private chat"
 */
export async function getBeeperConversationById(
  threadId: string,
  limit?: number
): Promise<BeeperMessage[]> {
  if (!isTauri) return [];
  try {
    return await invoke<BeeperMessage[]>("get_beeper_conversation_by_id", {
      threadId,
      limit,
    });
  } catch (error) {
    console.error("Failed to get Beeper conversation by ID:", error);
    return [];
  }
}

/**
 * Get messages by contact/thread name (fuzzy search)
 */
export async function getBeeperMessages(
  name: string,
  limit?: number
): Promise<BeeperMessage[]> {
  if (!isTauri) return [];
  try {
    return await invoke<BeeperMessage[]>("get_beeper_messages", { name, limit });
  } catch (error) {
    console.error("Failed to get Beeper messages:", error);
    return [];
  }
}

/**
 * Search messages by text content
 */
export async function searchBeeperMessages(
  query: string
): Promise<BeeperMessage[]> {
  if (!isTauri) return [];
  try {
    return await invoke<BeeperMessage[]>("search_beeper_messages", { query });
  } catch (error) {
    console.error("Failed to search Beeper messages:", error);
    return [];
  }
}
