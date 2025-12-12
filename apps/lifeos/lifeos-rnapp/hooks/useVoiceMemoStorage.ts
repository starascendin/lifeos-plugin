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

export function useVoiceMemoStorage(): UseVoiceMemoStorageReturn {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMemos = useCallback(async () => {
    try {
      const loadedMemos = await loadMemoMetadata();
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
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeStorage();
        await refreshMemos();
      } catch (error) {
        console.error('Failed to initialize storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [refreshMemos]);

  const addMemo = useCallback(
    async (sourceUri: string, duration: number): Promise<VoiceMemo> => {
      const filename = generateMemoFilename();
      const uri = await moveToMemoDirectory(sourceUri, filename);

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
      await saveMemoMetadata(updatedMemos);
      setMemos(updatedMemos);

      return newMemo;
    },
    [memos]
  );

  const updateMemo = useCallback(
    async (id: string, updates: Partial<VoiceMemo>) => {
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

      await saveMemoMetadata(updatedMemos);
      setMemos(updatedMemos);
    },
    [memos]
  );

  const deleteMemo = useCallback(
    async (id: string) => {
      const memoToDelete = memos.find((m) => m.id === id);
      if (!memoToDelete) return;

      await deleteMemoFile(memoToDelete.uri);

      const updatedMemos = memos.filter((m) => m.id !== id);
      await saveMemoMetadata(updatedMemos);
      setMemos(updatedMemos);
    },
    [memos]
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
