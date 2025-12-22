/**
 * File-based storage for council conversations.
 * Stores each conversation as a JSON file in data/conversations/
 */

import { mkdir, readdir, readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { StoredConversation, ConversationSummary } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data directory path (relative to project root)
const DATA_DIR = join(__dirname, '..', 'data', 'conversations');

/**
 * Ensure the data directory exists.
 */
export async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
    console.log('[Storage] Created data directory:', DATA_DIR);
  }
}

/**
 * Save a conversation to disk.
 */
export async function saveConversation(conversation: StoredConversation): Promise<void> {
  await ensureDataDir();
  const filePath = join(DATA_DIR, `${conversation.id}.json`);
  await writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
  console.log('[Storage] Saved conversation:', conversation.id);
}

/**
 * List all saved conversations (summaries only for performance).
 */
export async function listConversations(): Promise<ConversationSummary[]> {
  await ensureDataDir();

  const files = await readdir(DATA_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const summaries: ConversationSummary[] = [];

  for (const file of jsonFiles) {
    try {
      const filePath = join(DATA_DIR, file);
      const content = await readFile(filePath, 'utf-8');
      const conversation: StoredConversation = JSON.parse(content);

      summaries.push({
        id: conversation.id,
        query: conversation.query,
        tier: conversation.tier,
        createdAt: conversation.createdAt,
        duration: conversation.duration
      });
    } catch (error) {
      console.error('[Storage] Failed to read conversation file:', file, error);
    }
  }

  // Sort by createdAt descending (newest first)
  summaries.sort((a, b) => b.createdAt - a.createdAt);

  return summaries;
}

/**
 * Get a single conversation by ID.
 */
export async function getConversation(id: string): Promise<StoredConversation | null> {
  const filePath = join(DATA_DIR, `${id}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[Storage] Failed to read conversation:', id, error);
    return null;
  }
}

/**
 * Delete a conversation by ID.
 */
export async function deleteConversation(id: string): Promise<boolean> {
  const filePath = join(DATA_DIR, `${id}.json`);

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    await unlink(filePath);
    console.log('[Storage] Deleted conversation:', id);
    return true;
  } catch (error) {
    console.error('[Storage] Failed to delete conversation:', id, error);
    return false;
  }
}
