/**
 * CatGirl Agent Context
 * Shared state for passing userId to tools during agent execution
 */

// Store userId for tool context (set before each request)
let currentUserId: string | null = null;

/**
 * Set the current user ID for tool execution
 * Must be called before running agent actions
 */
export function setCurrentUserId(userId: string | null) {
  currentUserId = userId;
}

/**
 * Get the current user ID for tool execution
 */
export function getCurrentUserId(): string | null {
  return currentUserId;
}
