/**
 * Beeper Sync Service
 *
 * Syncs business-marked Beeper threads and their messages to Convex.
 * Uses batch upserts with deduplication for efficient syncing.
 */

import { ConvexReactClient } from "convex/react";
import { api } from "@holaai/convex";
import {
  getBeeperThreads,
  getBeeperMessagesForSync,
  getBusinessMarks,
  type BeeperThread,
  type BeeperSyncMessage,
} from "./beeper";

// Batch size for message upserts
const MESSAGE_BATCH_SIZE = 50;

export interface SyncProgress {
  status: "idle" | "syncing_threads" | "syncing_messages" | "complete" | "error";
  currentStep: string;
  threadsToSync: number;
  threadsSynced: number;
  messagesTotal: number;
  messagesSynced: number;
  error?: string;
}

export const initialSyncProgress: SyncProgress = {
  status: "idle",
  currentStep: "",
  threadsToSync: 0,
  threadsSynced: 0,
  messagesTotal: 0,
  messagesSynced: 0,
};

/**
 * Parse timestamp from Beeper's date string format
 * Format: "YYYY-MM-DD HH:MM:SS"
 */
function parseTimestamp(lastMessageAt: string): number {
  try {
    // Handle ISO format or custom format
    const date = new Date(lastMessageAt.replace(" ", "T"));
    return date.getTime();
  } catch {
    return Date.now();
  }
}

/**
 * Sync all business-marked threads to Convex
 */
export async function syncBusinessThreadsToConvex(
  client: ConvexReactClient,
  onProgress?: (progress: SyncProgress) => void
): Promise<{ insertedCount: number; updatedCount: number }> {
  const progress: SyncProgress = { ...initialSyncProgress };
  const updateProgress = () => onProgress?.(progress);

  try {
    // Get locally marked business thread IDs
    const businessMarks = getBusinessMarks();
    const businessThreadIds = Array.from(businessMarks.keys());

    if (businessThreadIds.length === 0) {
      progress.status = "complete";
      progress.currentStep = "No business threads to sync";
      updateProgress();
      return { insertedCount: 0, updatedCount: 0 };
    }

    progress.status = "syncing_threads";
    progress.threadsToSync = businessThreadIds.length;
    progress.currentStep = `Fetching thread metadata...`;
    updateProgress();

    // Fetch all threads from DuckDB
    const allThreads = await getBeeperThreads();
    const threadMap = new Map(allThreads.map((t) => [t.thread_id, t]));

    // Filter to only business threads
    const threadsToSync: BeeperThread[] = [];
    for (const threadId of businessThreadIds) {
      const thread = threadMap.get(threadId);
      if (thread) {
        threadsToSync.push(thread);
      }
    }

    if (threadsToSync.length === 0) {
      progress.status = "complete";
      progress.currentStep = "No matching threads found in local database";
      updateProgress();
      return { insertedCount: 0, updatedCount: 0 };
    }

    progress.currentStep = `Syncing ${threadsToSync.length} threads to Convex...`;
    updateProgress();

    // Prepare threads for upsert
    const threadData = threadsToSync.map((thread) => {
      const mark = businessMarks.get(thread.thread_id);
      // Determine thread type: default to "dm" if not specified
      // Groups typically have participant_count > 2
      const threadType: "dm" | "group" =
        thread.thread_type === "group" || thread.participant_count > 2
          ? "group"
          : "dm";
      return {
        threadId: thread.thread_id,
        threadName: thread.name,
        threadType,
        participantCount: thread.participant_count,
        messageCount: thread.message_count,
        lastMessageAt: parseTimestamp(thread.last_message_at),
        isBusinessChat: true,
        businessNote: mark?.businessNote,
      };
    });

    // Batch upsert threads
    const result = await client.mutation(api.lifeos.beeper.upsertThreadBatch, {
      threads: threadData,
    });

    progress.threadsSynced = threadsToSync.length;
    progress.status = "complete";
    progress.currentStep = `Synced ${result.insertedCount} new, ${result.updatedCount} updated threads`;
    updateProgress();

    return result;
  } catch (error) {
    progress.status = "error";
    progress.error = error instanceof Error ? error.message : "Unknown error";
    progress.currentStep = "Sync failed";
    updateProgress();
    throw error;
  }
}

/**
 * Sync messages for a specific business thread to Convex
 */
export async function syncThreadMessagesToConvex(
  client: ConvexReactClient,
  threadId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<{ insertedCount: number; updatedCount: number }> {
  const progress: SyncProgress = {
    ...initialSyncProgress,
    status: "syncing_messages",
    currentStep: "Fetching messages...",
  };
  const updateProgress = () => onProgress?.(progress);
  updateProgress();

  try {
    // Get all messages for this thread from DuckDB
    const messages = await getBeeperMessagesForSync(threadId);
    progress.messagesTotal = messages.length;
    progress.currentStep = `Found ${messages.length} messages to sync...`;
    updateProgress();

    if (messages.length === 0) {
      progress.status = "complete";
      progress.currentStep = "No messages to sync";
      updateProgress();
      return { insertedCount: 0, updatedCount: 0 };
    }

    // Get already synced message IDs to avoid re-syncing
    const syncedMessageIds = await client.query(
      api.lifeos.beeper.getSyncedMessageIds,
      { threadId }
    );
    const syncedSet = new Set(syncedMessageIds);

    // Filter to only new messages
    const newMessages = messages.filter((m) => !syncedSet.has(m.message_id));
    progress.currentStep = `${newMessages.length} new messages to sync...`;
    updateProgress();

    if (newMessages.length === 0) {
      progress.status = "complete";
      progress.messagesSynced = messages.length;
      progress.currentStep = "All messages already synced";
      updateProgress();
      return { insertedCount: 0, updatedCount: 0 };
    }

    // Batch upsert messages
    let totalInserted = 0;
    let totalUpdated = 0;

    for (let i = 0; i < newMessages.length; i += MESSAGE_BATCH_SIZE) {
      const batch = newMessages.slice(i, i + MESSAGE_BATCH_SIZE);
      const batchData = batch.map((msg) => ({
        threadId: msg.thread_id,
        messageId: msg.message_id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp,
      }));

      const result = await client.mutation(
        api.lifeos.beeper.upsertMessagesBatch,
        { messages: batchData }
      );

      totalInserted += result.insertedCount;
      totalUpdated += result.updatedCount;
      progress.messagesSynced = i + batch.length;
      progress.currentStep = `Synced ${progress.messagesSynced}/${newMessages.length} messages...`;
      updateProgress();
    }

    progress.status = "complete";
    progress.messagesSynced = messages.length;
    progress.currentStep = `Synced ${totalInserted} new, ${totalUpdated} updated messages`;
    updateProgress();

    return { insertedCount: totalInserted, updatedCount: totalUpdated };
  } catch (error) {
    progress.status = "error";
    progress.error = error instanceof Error ? error.message : "Unknown error";
    progress.currentStep = "Message sync failed";
    updateProgress();
    throw error;
  }
}

/**
 * Sync all business threads and their messages to Convex
 */
export async function syncAllBusinessDataToConvex(
  client: ConvexReactClient,
  onProgress?: (progress: SyncProgress) => void
): Promise<{
  threadsInserted: number;
  threadsUpdated: number;
  messagesInserted: number;
  messagesUpdated: number;
}> {
  const progress: SyncProgress = { ...initialSyncProgress };
  const updateProgress = () => onProgress?.(progress);

  try {
    // Step 1: Sync threads
    progress.status = "syncing_threads";
    progress.currentStep = "Syncing threads...";
    updateProgress();

    const threadResult = await syncBusinessThreadsToConvex(client, (p) => {
      progress.threadsToSync = p.threadsToSync;
      progress.threadsSynced = p.threadsSynced;
      progress.currentStep = p.currentStep;
      updateProgress();
    });

    // Step 2: Sync messages for each business thread
    const businessMarks = getBusinessMarks();
    const businessThreadIds = Array.from(businessMarks.keys());

    let totalMessagesInserted = 0;
    let totalMessagesUpdated = 0;

    for (let i = 0; i < businessThreadIds.length; i++) {
      const threadId = businessThreadIds[i];
      progress.status = "syncing_messages";
      progress.currentStep = `Syncing messages for thread ${i + 1}/${businessThreadIds.length}...`;
      updateProgress();

      const msgResult = await syncThreadMessagesToConvex(
        client,
        threadId,
        (p) => {
          progress.messagesTotal += p.messagesTotal;
          progress.messagesSynced += p.messagesSynced - progress.messagesSynced;
          progress.currentStep = `Thread ${i + 1}/${businessThreadIds.length}: ${p.currentStep}`;
          updateProgress();
        }
      );

      totalMessagesInserted += msgResult.insertedCount;
      totalMessagesUpdated += msgResult.updatedCount;
    }

    progress.status = "complete";
    progress.currentStep = `Sync complete: ${threadResult.insertedCount} new threads, ${totalMessagesInserted} new messages`;
    updateProgress();

    return {
      threadsInserted: threadResult.insertedCount,
      threadsUpdated: threadResult.updatedCount,
      messagesInserted: totalMessagesInserted,
      messagesUpdated: totalMessagesUpdated,
    };
  } catch (error) {
    progress.status = "error";
    progress.error = error instanceof Error ? error.message : "Unknown error";
    progress.currentStep = "Sync failed";
    updateProgress();
    throw error;
  }
}
