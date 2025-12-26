/**
 * Server-side persistence for council requests.
 * Saves requests and their results to disk so they survive disconnections.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Data directory - relative to server/dist or server/src
const DATA_DIR = join(__dirname, '..', '..', 'data');

export interface PersistedRequest {
  id: string;
  query: string;
  tier: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: number;
  updatedAt: number;
  stage1?: unknown[];
  stage2?: unknown[];
  stage3?: unknown[];
  metadata?: unknown;
  error?: string;
  duration?: number;
}

// Ensure data directory exists
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getRequestPath(id: string): string {
  return join(DATA_DIR, `request-${id}.json`);
}

/**
 * Save a new request
 */
export function saveRequest(request: PersistedRequest): void {
  ensureDataDir();
  writeFileSync(getRequestPath(request.id), JSON.stringify(request, null, 2));
}

/**
 * Update an existing request
 */
export function updateRequest(id: string, updates: Partial<PersistedRequest>): PersistedRequest | null {
  const request = getRequest(id);
  if (!request) return null;

  const updated: PersistedRequest = {
    ...request,
    ...updates,
    updatedAt: Date.now()
  };

  saveRequest(updated);
  return updated;
}

/**
 * Get a request by ID
 */
export function getRequest(id: string): PersistedRequest | null {
  const path = getRequestPath(id);
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get all requests, sorted by creation time (newest first)
 */
export function getAllRequests(): PersistedRequest[] {
  ensureDataDir();

  const files = readdirSync(DATA_DIR).filter(f => f.startsWith('request-') && f.endsWith('.json'));
  const requests: PersistedRequest[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(DATA_DIR, file), 'utf-8');
      requests.push(JSON.parse(content));
    } catch {
      // Skip invalid files
    }
  }

  // Sort by creation time, newest first
  return requests.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get recent requests (last N)
 */
export function getRecentRequests(limit: number = 20): PersistedRequest[] {
  return getAllRequests().slice(0, limit);
}

/**
 * Get the most recent pending/processing request (if any)
 */
export function getActiveRequest(): PersistedRequest | null {
  const requests = getAllRequests();
  return requests.find(r => r.status === 'pending' || r.status === 'processing') || null;
}

/**
 * Delete a request
 */
export function deleteRequest(id: string): boolean {
  const path = getRequestPath(id);
  if (!existsSync(path)) return false;

  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cleanup old requests (keep last N)
 */
export function cleanupOldRequests(keepCount: number = 50): number {
  const requests = getAllRequests();
  let deleted = 0;

  if (requests.length > keepCount) {
    const toDelete = requests.slice(keepCount);
    for (const req of toDelete) {
      if (deleteRequest(req.id)) {
        deleted++;
      }
    }
  }

  return deleted;
}
