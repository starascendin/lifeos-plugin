import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { Id } from '@holaai/convex/_generated/dataModel';
import { useVoiceMemoStorage } from './useVoiceMemoStorage';
import {
  VoiceMemo,
  saveMemoMetadata,
  deleteMemoFile,
} from '@/utils/voicememo/storage';
import { uploadAudioToConvex } from '@/utils/voicememo/sync';

export interface SyncedVoiceMemo extends VoiceMemo {
  audioUrl?: string | null;
}

interface UseVoiceMemoSyncReturn {
  memos: SyncedVoiceMemo[];
  isLoading: boolean;
  isSyncing: boolean;
  hasUnsyncedMemos: boolean;
  syncMemo: (memoId: string) => Promise<void>;
  syncAllPending: () => Promise<void>;
  addMemo: (uri: string, duration: number, autoSync?: boolean) => Promise<VoiceMemo>;
  updateMemo: (id: string, updates: Partial<VoiceMemo>) => Promise<void>;
  deleteMemo: (id: string) => Promise<void>;
  refreshMemos: () => Promise<void>;
  transcribeMemo: (memoId: string) => Promise<void>;
  retryTranscription: (memoId: string) => Promise<void>;
}

export function useVoiceMemoSync(): UseVoiceMemoSyncReturn {
  const {
    memos: localMemos,
    isLoading: isLocalLoading,
    addMemo: addLocalMemo,
    updateMemo: updateLocalMemo,
    deleteMemo: deleteLocalMemo,
    refreshMemos: refreshLocalMemos,
  } = useVoiceMemoStorage();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingMemoIds, setSyncingMemoIds] = useState<Set<string>>(new Set());

  // Convex queries and mutations
  const cloudMemos = useQuery(api.lifeos.voicememo.getMemos, {});
  const generateUploadUrl = useMutation(api.lifeos.voicememo.generateUploadUrl);
  const createMemo = useMutation(api.lifeos.voicememo.createMemo);
  const updateCloudMemo = useMutation(api.lifeos.voicememo.updateMemo);
  const deleteCloudMemo = useMutation(api.lifeos.voicememo.deleteMemo);
  const transcribeAction = useAction(api.lifeos.voicememo.transcribeMemo);

  // Create a map of cloud memos by localId
  const cloudMemosByLocalId = new Map(
    (cloudMemos ?? []).map((m) => [m.localId, m])
  );

  // Merge local and cloud data
  const mergedMemos: SyncedVoiceMemo[] = localMemos.map((localMemo) => {
    const cloudMemo = cloudMemosByLocalId.get(localMemo.id);
    if (cloudMemo) {
      return {
        ...localMemo,
        convexId: cloudMemo._id,
        syncStatus: 'synced' as const,
        transcriptionStatus: cloudMemo.transcriptionStatus,
        transcript: cloudMemo.transcript ?? undefined,
        language: cloudMemo.language ?? undefined,
        audioUrl: cloudMemo.audioUrl,
      };
    }
    return {
      ...localMemo,
      syncStatus: syncingMemoIds.has(localMemo.id) ? 'syncing' : localMemo.syncStatus,
    };
  });

  const hasUnsyncedMemos = mergedMemos.some(
    (m) => m.syncStatus === 'local' || m.syncStatus === 'error'
  );

  /**
   * Sync a single memo to the cloud
   */
  const syncMemo = useCallback(
    async (memoId: string) => {
      const memo = localMemos.find((m) => m.id === memoId);
      if (!memo) {
        throw new Error('Memo not found');
      }

      if (memo.syncStatus === 'synced' || memo.syncStatus === 'syncing') {
        return;
      }

      setSyncingMemoIds((prev) => new Set(prev).add(memoId));

      try {
        // Upload audio to Convex storage
        const storageId = await uploadAudioToConvex(memo.uri, generateUploadUrl);

        // Create memo record in Convex
        const convexId = await createMemo({
          localId: memo.id,
          name: memo.name,
          storageId,
          duration: memo.duration,
          clientCreatedAt: memo.createdAt,
          clientUpdatedAt: memo.updatedAt,
          autoTranscribe: true,
        });

        // Update local memo with sync status
        await updateLocalMemo(memoId, {
          convexId: convexId as string,
          syncStatus: 'synced',
        });

        // Trigger transcription
        await transcribeAction({ memoId: convexId });
      } catch (error) {
        console.error('Failed to sync memo:', error);
        await updateLocalMemo(memoId, {
          syncStatus: 'error',
          syncError: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        setSyncingMemoIds((prev) => {
          const next = new Set(prev);
          next.delete(memoId);
          return next;
        });
      }
    },
    [localMemos, generateUploadUrl, createMemo, updateLocalMemo, transcribeAction]
  );

  /**
   * Sync all unsynced memos
   */
  const syncAllPending = useCallback(async () => {
    setIsSyncing(true);
    const unsyncedMemos = localMemos.filter(
      (m) => m.syncStatus === 'local' || m.syncStatus === 'error'
    );

    try {
      for (const memo of unsyncedMemos) {
        try {
          await syncMemo(memo.id);
        } catch (error) {
          // Continue with next memo even if one fails
          console.error(`Failed to sync memo ${memo.id}:`, error);
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [localMemos, syncMemo]);

  /**
   * Add a new memo with optional auto-sync
   */
  const addMemo = useCallback(
    async (uri: string, duration: number, autoSync = false): Promise<VoiceMemo> => {
      const newMemo = await addLocalMemo(uri, duration);

      if (autoSync) {
        // Don't await - sync in background
        syncMemo(newMemo.id).catch((error) => {
          console.error('Auto-sync failed:', error);
        });
      }

      return newMemo;
    },
    [addLocalMemo, syncMemo]
  );

  /**
   * Update a memo (local + cloud if synced)
   */
  const updateMemo = useCallback(
    async (id: string, updates: Partial<VoiceMemo>) => {
      await updateLocalMemo(id, updates);

      // If synced, also update cloud
      const memo = mergedMemos.find((m) => m.id === id);
      if (memo?.convexId && updates.name !== undefined) {
        await updateCloudMemo({
          memoId: memo.convexId as Id<'life_voiceMemos'>,
          name: updates.name,
        });
      }
    },
    [updateLocalMemo, updateCloudMemo, mergedMemos]
  );

  /**
   * Delete a memo (local + cloud if synced)
   */
  const deleteMemo = useCallback(
    async (id: string) => {
      const memo = mergedMemos.find((m) => m.id === id);

      // Delete from cloud first if synced
      if (memo?.convexId) {
        await deleteCloudMemo({
          memoId: memo.convexId as Id<'life_voiceMemos'>,
        });
      }

      // Then delete locally
      await deleteLocalMemo(id);
    },
    [mergedMemos, deleteCloudMemo, deleteLocalMemo]
  );

  /**
   * Trigger transcription for a memo
   */
  const transcribeMemo = useCallback(
    async (memoId: string) => {
      const memo = mergedMemos.find((m) => m.id === memoId);
      if (!memo?.convexId) {
        // Need to sync first
        await syncMemo(memoId);
        return;
      }

      await transcribeAction({
        memoId: memo.convexId as Id<'life_voiceMemos'>,
      });
    },
    [mergedMemos, syncMemo, transcribeAction]
  );

  /**
   * Retry failed transcription
   */
  const retryTranscription = useCallback(
    async (memoId: string) => {
      const memo = mergedMemos.find((m) => m.id === memoId);
      if (!memo?.convexId) {
        throw new Error('Memo not synced');
      }

      await transcribeAction({
        memoId: memo.convexId as Id<'life_voiceMemos'>,
      });
    },
    [mergedMemos, transcribeAction]
  );

  return {
    memos: mergedMemos,
    isLoading: isLocalLoading || cloudMemos === undefined,
    isSyncing,
    hasUnsyncedMemos,
    syncMemo,
    syncAllPending,
    addMemo,
    updateMemo,
    deleteMemo,
    refreshMemos: refreshLocalMemos,
    transcribeMemo,
    retryTranscription,
  };
}
