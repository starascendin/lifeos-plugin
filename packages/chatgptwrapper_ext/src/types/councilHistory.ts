import type { CouncilMessage } from '../store/councilStore';
import type { Tier } from '../config/llm';

/**
 * A saved council conversation
 */
export interface SavedCouncilConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tier: Tier;
  messages: CouncilMessage[];
  messageCount: number;
}

/**
 * Lightweight index for fast listing (avoids loading full conversations)
 */
export interface ConversationIndex {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Storage keys for chrome.storage.local
 */
export const STORAGE_KEYS = {
  CONVERSATION_INDEX: 'council_conversation_index',
  CONVERSATION_PREFIX: 'council_conversation_',
  CURRENT_CONVERSATION_ID: 'council_current_conversation_id'
} as const;

/**
 * Generate a title from the first user message
 */
export function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\n/g, ' ');
  return cleaned.length <= 50 ? cleaned : cleaned.substring(0, 47) + '...';
}
