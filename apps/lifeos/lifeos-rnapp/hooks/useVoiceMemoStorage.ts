import { useState, useEffect, useCallback } from 'react';
import {
  VoiceMemo,
  initializeStorage,
  loadMemoMetadata,
  saveMemoMetadata,
  deleteMemoFile,
  moveToMemoDirectory,
  generateMemoFilename,
  generateUUID,
  migrateLegacyMemos,
} from '@/utils/voicememo/storage';
import { generateDefaultName } from '@/utils/voicememo/format';

interface UseVoiceMemoStorageReturn {
  memos: VoiceMemo[];
  isLoading: boolean;
  addMemo: (uri: string, duration: number) => Promise<VoiceMemo>;
  updateMemo: (id: string, updates: Partial<VoiceMemo>) => Promise<void>;
  deleteMemo: (id: string) => Promise<void>;
  refreshMemos: () => Promise<void>;
}

export function useVoiceMemoStorage(userId: string | null): UseVoiceMemoStorageReturn {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMemos = useCallback(async () => {
    if (!userId) {
      setMemos([]);
      return;
    }
    try {
      const loadedMemos = await loadMemoMetadata(userId);
      // Migrate old memos that don't have syncStatus
      const migratedMemos = loadedMemos.map((memo) => ({
        ...memo,
        syncStatus: memo.syncStatus ?? 'local',
      })) as VoiceMemo[];
      // Sort by createdAt descending (newest first)
      migratedMemos.sort((a, b) => b.createdAt - a.createdAt);
      setMemos(migratedMemos);
    } catch (error) {
      console.error('Failed to load memos:', error);
    }
  }, [userId]);

  useEffect(() => {
    const initialize = async () => {
      if (!userId) {
        setMemos([]);
        setIsLoading(false);
        return;
      }
      try {
        // Migrate any legacy memos from shared storage to user-specific storage
        await migrateLegacyMemos(userId);
        await initializeStorage(userId);
        await refreshMemos();
      } catch (error) {
        console.error('Failed to initialize storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    initialize();
  }, [userId, refreshMemos]);

  const addMemo = useCallback(
    async (sourceUri: string, duration: number): Promise<VoiceMemo> => {
      if (!userId) {
        throw new Error('User ID is required to add a memo');
      }
      const filename = generateMemoFilename();
      const uri = await moveToMemoDirectory(userId, sourceUri, filename);

      const now = Date.now();
      const newMemo: VoiceMemo = {
        id: generateUUID(),
        name: generateDefaultName(memos.length),
        uri,
        duration,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'local',
      };

      const updatedMemos = [newMemo, ...memos];
      await saveMemoMetadata(userId, updatedMemos);
      setMemos(updatedMemos);

      return newMemo;
    },
    [userId, memos]
  );

  const updateMemo = useCallback(
    async (id: string, updates: Partial<VoiceMemo>) => {
      if (!userId) {
        throw new Error('User ID is required to update a memo');
      }
      const updatedMemos = memos.map((memo) => {
        if (memo.id === id) {
          return {
            ...memo,
            ...updates,
            updatedAt: Date.now(),
          };
        }
        return memo;
      });

      await saveMemoMetadata(userId, updatedMemos);
      setMemos(updatedMemos);
    },
    [userId, memos]
  );

  const deleteMemo = useCallback(
    async (id: string) => {
      if (!userId) {
        throw new Error('User ID is required to delete a memo');
      }
      const memoToDelete = memos.find((m) => m.id === id);
      if (!memoToDelete) return;

      await deleteMemoFile(memoToDelete.uri);

      const updatedMemos = memos.filter((m) => m.id !== id);
      await saveMemoMetadata(userId, updatedMemos);
      setMemos(updatedMemos);
    },
    [userId, memos]
  );

  return {
    memos,
    isLoading,
    addMemo,
    updateMemo,
    deleteMemo,
    refreshMemos,
  };
}
