/**
 * Hook for managing server-side request history.
 * Used in server mode to fetch and display request list with status.
 */

import { useState, useEffect, useCallback } from 'react';
import { useCouncilStore } from '../store/councilStore';
import type { Stage1Result, Stage2Result, Stage3Result } from '../store/councilStore';

export interface ServerRequest {
  id: string;
  query: string;
  tier: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: number;
  updatedAt: number;
  stage1?: Stage1Result[];
  stage2?: Stage2Result[];
  stage3?: Stage3Result[];
  metadata?: unknown;
  error?: string;
  duration?: number;
}

interface UseServerRequestsReturn {
  requests: ServerRequest[];
  isLoading: boolean;
  selectedRequestId: string | null;
  hasActiveRequest: boolean;
  selectRequest: (id: string) => void;
  deleteRequest: (id: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  clearSelection: () => void;
}

/**
 * Check if we're running in server mode
 */
function isServerMode(): boolean {
  return typeof chrome === 'undefined' || !chrome.storage?.local;
}

export function useServerRequests(): UseServerRequestsReturn {
  const [requests, setRequests] = useState<ServerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const clearMessages = useCouncilStore((state) => state.clearMessages);
  const setMessages = useCouncilStore((state) => state.setMessages);

  // Check if there's any active (pending/processing) request
  const hasActiveRequest = requests.some(
    r => r.status === 'pending' || r.status === 'processing'
  );

  /**
   * Fetch the list of requests from the server
   */
  const refreshRequests = useCallback(async () => {
    if (!isServerMode()) return;

    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/requests`);
      const data = await response.json();

      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  }, []);

  /**
   * Select a request and load its results into the store
   */
  const selectRequest = useCallback(async (id: string) => {
    if (!isServerMode()) return;

    setSelectedRequestId(id);
    setIsLoading(true);

    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/requests/${id}`);
      const data = await response.json();

      if (data.success && data.request) {
        const req = data.request as ServerRequest;

        // Build messages for the council store
        clearMessages();

        // Create user message
        const userMsgId = `user-${id}`;
        const assistantMsgId = `assistant-${id}`;

        setMessages([
          {
            id: userMsgId,
            role: 'user',
            content: req.query
          },
          {
            id: assistantMsgId,
            role: 'assistant',
            stage1: req.stage1,
            stage2: req.stage2,
            stage3: req.stage3,
            metadata: req.metadata as any,
            loading: {
              stage1: req.status === 'pending' || req.status === 'processing',
              stage2: false,
              stage3: false
            },
            error: req.error
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load request:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clearMessages, setMessages]);

  /**
   * Delete a request
   */
  const deleteRequest = useCallback(async (id: string) => {
    if (!isServerMode()) return;

    try {
      const baseUrl = window.location.origin;
      await fetch(`${baseUrl}/requests/${id}`, { method: 'DELETE' });

      // Remove from local state
      setRequests(prev => prev.filter(r => r.id !== id));

      // If this was the selected request, clear selection
      if (selectedRequestId === id) {
        setSelectedRequestId(null);
        clearMessages();
      }
    } catch (error) {
      console.error('Failed to delete request:', error);
    }
  }, [selectedRequestId, clearMessages]);

  /**
   * Clear the current selection
   */
  const clearSelection = useCallback(() => {
    setSelectedRequestId(null);
    clearMessages();
  }, [clearMessages]);

  // Initial fetch on mount
  useEffect(() => {
    if (isServerMode()) {
      refreshRequests();
    }
  }, [refreshRequests]);

  // Poll for updates when there are active requests
  useEffect(() => {
    if (!isServerMode() || !hasActiveRequest) return;

    const intervalId = setInterval(() => {
      refreshRequests();

      // Also refresh the selected request if it's active
      if (selectedRequestId) {
        const selected = requests.find(r => r.id === selectedRequestId);
        if (selected && (selected.status === 'pending' || selected.status === 'processing')) {
          selectRequest(selectedRequestId);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
  }, [hasActiveRequest, selectedRequestId, requests, refreshRequests, selectRequest]);

  return {
    requests,
    isLoading,
    selectedRequestId,
    hasActiveRequest,
    selectRequest,
    deleteRequest,
    refreshRequests,
    clearSelection
  };
}
