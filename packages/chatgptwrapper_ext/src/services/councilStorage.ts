import type { SavedCouncilConversation, ConversationIndex } from '../types/councilHistory';
import { STORAGE_KEYS } from '../types/councilHistory';
import { getStorage, detectStorageMode } from './storage';

/**
 * Check if we're in server mode (no chrome.storage available)
 */
export function isServerMode(): boolean {
  return detectStorageMode() === 'server';
}

/**
 * Load the conversation index
 */
export async function loadConversationIndex(): Promise<ConversationIndex[]> {
  try {
    const result = await getStorage().get<ConversationIndex[]>(STORAGE_KEYS.CONVERSATION_INDEX);
    return result || [];
  } catch (error) {
    console.error('Failed to load conversation index:', error);
    return [];
  }
}

/**
 * Save the conversation index
 */
export async function saveConversationIndex(index: ConversationIndex[]): Promise<void> {
  try {
    await getStorage().set(STORAGE_KEYS.CONVERSATION_INDEX, index);
  } catch (error) {
    console.error('Failed to save conversation index:', error);
    throw error;
  }
}

/**
 * Load a specific conversation by ID
 */
export async function loadConversation(id: string): Promise<SavedCouncilConversation | null> {
  try {
    const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${id}`;
    const result = await getStorage().get<SavedCouncilConversation>(key);
    return result || null;
  } catch (error) {
    console.error('Failed to load conversation:', error);
    return null;
  }
}

/**
 * Save a conversation
 */
export async function saveConversation(conversation: SavedCouncilConversation): Promise<void> {
  // In server mode, saves are handled by the extension - skip
  if (isServerMode()) {
    console.log('[Storage] Server mode - skipping save (extension handles it)');
    return;
  }

  try {
    const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${conversation.id}`;
    await getStorage().set(key, conversation);

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
  try {
    const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${id}`;
    await getStorage().remove(key);

    // In server mode, also update local index cache
    if (!isServerMode()) {
      // Update the index only in extension mode
      const index = await loadConversationIndex();
      const filtered = index.filter((c) => c.id !== id);
      await saveConversationIndex(filtered);
    }
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    throw error;
  }
}

/**
 * Get the current conversation ID
 */
export async function getCurrentConversationId(): Promise<string | null> {
  try {
    const result = await getStorage().get<string>(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
    return result || null;
  } catch (error) {
    console.error('Failed to get current conversation ID:', error);
    return null;
  }
}

/**
 * Set the current conversation ID
 */
export async function setCurrentConversationId(id: string | null): Promise<void> {
  try {
    if (id === null) {
      await getStorage().remove(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
    } else {
      await getStorage().set(STORAGE_KEYS.CURRENT_CONVERSATION_ID, id);
    }
  } catch (error) {
    console.error('Failed to set current conversation ID:', error);
  }
}

/**
 * Get storage usage info
 */
export async function getStorageUsage(): Promise<{ used: number; total: number }> {
  const storage = getStorage();
  const total = 10 * 1024 * 1024; // 10MB default limit

  if (storage.getBytesInUse) {
    try {
      const used = await storage.getBytesInUse();
      return { used, total };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
    }
  }

  return { used: 0, total };
}

/**
 * Cleanup old conversations to stay within storage limits
 * Keeps the most recent `keepCount` conversations
 */
export async function cleanupOldConversations(keepCount: number = 50): Promise<void> {
  // Skip cleanup in server mode
  if (isServerMode()) return;

  try {
    const index = await loadConversationIndex();

    if (index.length <= keepCount) return;

    // Sort by updatedAt descending and get IDs to delete
    const sorted = [...index].sort((a, b) => b.updatedAt - a.updatedAt);
    const toDelete = sorted.slice(keepCount);

    // Delete old conversations
    const storage = getStorage();
    for (const conv of toDelete) {
      const key = `${STORAGE_KEYS.CONVERSATION_PREFIX}${conv.id}`;
      await storage.remove(key);
    }

    // Update index
    const remaining = sorted.slice(0, keepCount);
    await saveConversationIndex(remaining);

    console.log(`Cleaned up ${toDelete.length} old conversations`);
  } catch (error) {
    console.error('Failed to cleanup old conversations:', error);
  }
}
