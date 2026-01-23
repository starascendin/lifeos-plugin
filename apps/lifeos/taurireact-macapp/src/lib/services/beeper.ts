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
  message_id?: string;
  thread_id?: string;
  thread_name?: string;
  sender: string;
  text: string;
  timestamp_readable: string;
  timestamp?: number;
}

// Message for syncing to Convex
export interface BeeperSyncMessage {
  message_id: string;
  thread_id: string;
  sender: string;
  text: string;
  timestamp: number;
}

// Business thread marking (stored locally)
export interface BusinessThreadMark {
  threadId: string;
  isBusinessChat: boolean;
  businessNote?: string;
  markedAt: number;
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

// ==================== SYNC INTERVAL SETTINGS ====================

export const SYNC_INTERVAL_OPTIONS = [
  { value: 1, label: "1 min" },
  { value: 3, label: "3 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
];

/**
 * Get the Beeper sync interval setting (default 3 minutes)
 */
export async function getBeeperSyncInterval(): Promise<number> {
  if (!isTauri) return 3;
  try {
    return await invoke<number>("get_beeper_sync_interval");
  } catch (error) {
    console.error("Failed to get Beeper sync interval:", error);
    return 3; // Default
  }
}

/**
 * Save the Beeper sync interval setting
 */
export async function saveBeeperSyncInterval(interval: number): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("save_beeper_sync_interval", { interval });
  } catch (error) {
    console.error("Failed to save Beeper sync interval:", error);
    throw error;
  }
}

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

/**
 * Get all messages for a thread (for syncing to Convex)
 */
export async function getBeeperMessagesForSync(
  threadId: string
): Promise<BeeperSyncMessage[]> {
  if (!isTauri) return [];
  try {
    return await invoke<BeeperSyncMessage[]>("get_beeper_messages_for_sync", {
      threadId,
    });
  } catch (error) {
    console.error("Failed to get Beeper messages for sync:", error);
    return [];
  }
}

// ==================== LOCAL STORAGE FOR BUSINESS MARKS ====================

const BUSINESS_MARKS_KEY = "beeper_business_marks";

/**
 * Get all business thread marks from localStorage
 */
export function getBusinessMarks(): Map<string, BusinessThreadMark> {
  if (typeof window === "undefined") return new Map();
  try {
    const stored = localStorage.getItem(BUSINESS_MARKS_KEY);
    if (!stored) return new Map();
    const marks = JSON.parse(stored) as BusinessThreadMark[];
    return new Map(marks.map((m) => [m.threadId, m]));
  } catch (error) {
    console.error("Failed to load business marks:", error);
    return new Map();
  }
}

/**
 * Save business thread marks to localStorage
 */
function saveBusinessMarks(marks: Map<string, BusinessThreadMark>): void {
  if (typeof window === "undefined") return;
  try {
    const marksArray = Array.from(marks.values());
    localStorage.setItem(BUSINESS_MARKS_KEY, JSON.stringify(marksArray));
  } catch (error) {
    console.error("Failed to save business marks:", error);
  }
}

/**
 * Mark a thread as business (or unmark)
 */
export function markThreadAsBusiness(
  threadId: string,
  isBusinessChat: boolean,
  businessNote?: string
): void {
  const marks = getBusinessMarks();
  if (isBusinessChat) {
    marks.set(threadId, {
      threadId,
      isBusinessChat: true,
      businessNote,
      markedAt: Date.now(),
    });
  } else {
    marks.delete(threadId);
  }
  saveBusinessMarks(marks);
}

/**
 * Check if a thread is marked as business
 */
export function isThreadMarkedAsBusiness(threadId: string): boolean {
  const marks = getBusinessMarks();
  return marks.has(threadId);
}

/**
 * Get business note for a thread
 */
export function getBusinessNote(threadId: string): string | undefined {
  const marks = getBusinessMarks();
  return marks.get(threadId)?.businessNote;
}

/**
 * Get all business thread IDs
 */
export function getBusinessThreadIds(): string[] {
  const marks = getBusinessMarks();
  return Array.from(marks.keys());
}
