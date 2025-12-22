import type { SavedCouncilConversation, ConversationIndex } from '../types/councilHistory';
import { STORAGE_KEYS } from '../types/councilHistory';

/**
 * Check if chrome.storage is available
 */
function isStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

/**
 * Load the conversation index
 */
export async function loadConversationIndex(): Promise<ConversationIndex[]> {
  if (!isStorageAvailable()) {
    console.warn('chrome.storage.local not available');
    return [];
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CONVERSATION_INDEX);
    return (result[STORAGE_KEYS.CONVERSATION_INDEX] as ConversationIndex[] | undefined) || [];
  } catch (error) {
    console.error('Failed to load conversation index:', error);
    return [];
  }
}

/**
 * Save the conversation index
 */
export async function saveConversationIndex(index: ConversationIndex[]): Promise<void> {
  if (!isStorageAvailable()) return;

  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATION_INDEX]: index });
  } catch (error) {
    console.error('Failed to save conversation index:', error);
    throw error;
  }
}

/**
 * Load a specific conversation by ID
 */
export async function loadConversation(id: string): Promise<SavedCouncilConversation | null> {
  if (!isStorageAvailable()) return null;

  try {
    const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${id}`;
    const result = await chrome.storage.local.get(key);
    return (result[key] as SavedCouncilConversation | undefined) || null;
  } catch (error) {
    console.error('Failed to load conversation:', error);
    return null;
  }
}

/**
 * Save a conversation
 */
export async function saveConversation(conversation: SavedCouncilConversation): Promise<void> {
  if (!isStorageAvailable()) return;

  try {
    const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${conversation.id}`;
    await chrome.storage.local.set({ [key]: conversation });

    // Update the index
    const index = await loadConversationIndex();
    const existingIdx = index.findIndex((c) => c.id === conversation.id);

    const indexEntry: ConversationIndex = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messageCount
    };

    if (existingIdx >= 0) {
      index[existingIdx] = indexEntry;
    } else {
      index.unshift(indexEntry);
    }

    // Sort by updatedAt descending
    index.sort((a, b) => b.updatedAt - a.updatedAt);

    await saveConversationIndex(index);
  } catch (error) {
    console.error('Failed to save conversation:', error);
    throw error;
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  if (!isStorageAvailable()) return;

  try {
    const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${id}`;
    await chrome.storage.local.remove(key);

    // Update the index
    const index = await loadConversationIndex();
    const filtered = index.filter((c) => c.id !== id);
    await saveConversationIndex(filtered);
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    throw error;
  }
}

/**
 * Get the current conversation ID
 */
export async function getCurrentConversationId(): Promise<string | null> {
  if (!isStorageAvailable()) return null;

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
    return (result[STORAGE_KEYS.CURRENT_CONVERSATION_ID] as string | undefined) || null;
  } catch (error) {
    console.error('Failed to get current conversation ID:', error);
    return null;
  }
}

/**
 * Set the current conversation ID
 */
export async function setCurrentConversationId(id: string | null): Promise<void> {
  if (!isStorageAvailable()) return;

  try {
    if (id === null) {
      await chrome.storage.local.remove(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
    } else {
      await chrome.storage.local.set({ [STORAGE_KEYS.CURRENT_CONVERSATION_ID]: id });
    }
  } catch (error) {
    console.error('Failed to set current conversation ID:', error);
  }
}

/**
 * Get storage usage info
 */
export async function getStorageUsage(): Promise<{ used: number; total: number }> {
  if (!isStorageAvailable()) {
    return { used: 0, total: 10 * 1024 * 1024 };
  }

  try {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    return {
      used: bytesInUse,
      total: 10 * 1024 * 1024 // 10MB default limit
    };
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    return { used: 0, total: 10 * 1024 * 1024 };
  }
}

/**
 * Cleanup old conversations to stay within storage limits
 * Keeps the most recent `keepCount` conversations
 */
export async function cleanupOldConversations(keepCount: number = 50): Promise<void> {
  if (!isStorageAvailable()) return;

  try {
    const index = await loadConversationIndex();

    if (index.length <= keepCount) return;

    // Sort by updatedAt descending and get IDs to delete
    const sorted = [...index].sort((a, b) => b.updatedAt - a.updatedAt);
    const toDelete = sorted.slice(keepCount);

    // Delete old conversations
    for (const conv of toDelete) {
      const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${conv.id}`;
      await chrome.storage.local.remove(key);
    }

    // Update index
    const remaining = sorted.slice(0, keepCount);
    await saveConversationIndex(remaining);

    console.log(`Cleaned up ${toDelete.length} old conversations`);
  } catch (error) {
    console.error('Failed to cleanup old conversations:', error);
  }
}
