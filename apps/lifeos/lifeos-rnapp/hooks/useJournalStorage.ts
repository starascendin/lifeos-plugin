import { useState, useEffect, useCallback } from 'react';
import {
  JournalEntry,
  JournalEntryType,
  initializeJournalStorage,
  loadJournalMetadata,
  saveJournalMetadata,
  deleteEntryFiles,
  copyMediaToJournal,
  generateUUID,
  getTodayDate,
  groupEntriesByDate,
  getEntriesForDate,
  getDatesWithEntries,
} from '@/utils/journal/storage';

interface UseJournalStorageReturn {
  entries: JournalEntry[];
  entriesByDate: Record<string, JournalEntry[]>;
  datesWithEntries: string[];
  isLoading: boolean;
  addTextEntry: (content: string, title?: string, date?: string) => Promise<JournalEntry>;
  addPhotoEntry: (
    sourceUri: string,
    caption?: string,
    date?: string
  ) => Promise<JournalEntry>;
  addVideoEntry: (
    sourceUri: string,
    thumbnailUri: string | undefined,
    caption?: string,
    date?: string
  ) => Promise<JournalEntry>;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getEntriesForDate: (date: string) => JournalEntry[];
  refreshEntries: () => Promise<void>;
}

export function useJournalStorage(userId: string | null): UseJournalStorageReturn {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      return;
    }
    try {
      const loadedEntries = await loadJournalMetadata(userId);
      // Sort by createdAt descending (newest first)
      loadedEntries.sort((a, b) => b.createdAt - a.createdAt);
      setEntries(loadedEntries);
    } catch (error) {
      console.error('Failed to load journal entries:', error);
    }
  }, [userId]);

  useEffect(() => {
    const initialize = async () => {
      if (!userId) {
        setEntries([]);
        setIsLoading(false);
        return;
      }
      try {
        await initializeJournalStorage(userId);
        await refreshEntries();
      } catch (error) {
        console.error('Failed to initialize journal storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    initialize();
  }, [userId, refreshEntries]);

  const addTextEntry = useCallback(
    async (content: string, title?: string, date?: string): Promise<JournalEntry> => {
      if (!userId) {
        throw new Error('User ID is required to add an entry');
      }

      const now = Date.now();
      const newEntry: JournalEntry = {
        id: generateUUID(),
        date: date || getTodayDate(),
        createdAt: now,
        updatedAt: now,
        type: 'note',
        title,
        content,
        syncStatus: 'local',
      };

      const updatedEntries = [newEntry, ...entries];
      await saveJournalMetadata(userId, updatedEntries);
      setEntries(updatedEntries);

      return newEntry;
    },
    [userId, entries]
  );

  const addPhotoEntry = useCallback(
    async (
      sourceUri: string,
      caption?: string,
      date?: string
    ): Promise<JournalEntry> => {
      if (!userId) {
        throw new Error('User ID is required to add an entry');
      }

      // Copy the photo to journal storage
      const mediaUri = await copyMediaToJournal(userId, sourceUri, 'photo');

      const now = Date.now();
      const newEntry: JournalEntry = {
        id: generateUUID(),
        date: date || getTodayDate(),
        createdAt: now,
        updatedAt: now,
        type: 'photo',
        mediaUri,
        content: caption,
        syncStatus: 'local',
      };

      const updatedEntries = [newEntry, ...entries];
      await saveJournalMetadata(userId, updatedEntries);
      setEntries(updatedEntries);

      return newEntry;
    },
    [userId, entries]
  );

  const addVideoEntry = useCallback(
    async (
      sourceUri: string,
      thumbnailUri: string | undefined,
      caption?: string,
      date?: string
    ): Promise<JournalEntry> => {
      if (!userId) {
        throw new Error('User ID is required to add an entry');
      }

      // Copy the video to journal storage
      const mediaUri = await copyMediaToJournal(userId, sourceUri, 'video');

      // Copy thumbnail if provided
      let savedThumbnailUri: string | undefined;
      if (thumbnailUri) {
        savedThumbnailUri = await copyMediaToJournal(userId, thumbnailUri, 'photo');
      }

      const now = Date.now();
      const newEntry: JournalEntry = {
        id: generateUUID(),
        date: date || getTodayDate(),
        createdAt: now,
        updatedAt: now,
        type: 'video',
        mediaUri,
        thumbnailUri: savedThumbnailUri,
        content: caption,
        syncStatus: 'local',
      };

      const updatedEntries = [newEntry, ...entries];
      await saveJournalMetadata(userId, updatedEntries);
      setEntries(updatedEntries);

      return newEntry;
    },
    [userId, entries]
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<JournalEntry>) => {
      if (!userId) {
        throw new Error('User ID is required to update an entry');
      }
      const updatedEntries = entries.map((entry) => {
        if (entry.id === id) {
          return {
            ...entry,
            ...updates,
            updatedAt: Date.now(),
          };
        }
        return entry;
      });

      await saveJournalMetadata(userId, updatedEntries);
      setEntries(updatedEntries);
    },
    [userId, entries]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!userId) {
        throw new Error('User ID is required to delete an entry');
      }
      const entryToDelete = entries.find((e) => e.id === id);
      if (!entryToDelete) return;

      // Delete associated files
      await deleteEntryFiles(entryToDelete);

      const updatedEntries = entries.filter((e) => e.id !== id);
      await saveJournalMetadata(userId, updatedEntries);
      setEntries(updatedEntries);
    },
    [userId, entries]
  );

  const getEntriesForDateFn = useCallback(
    (date: string): JournalEntry[] => {
      return getEntriesForDate(entries, date);
    },
    [entries]
  );

  return {
    entries,
    entriesByDate: groupEntriesByDate(entries),
    datesWithEntries: getDatesWithEntries(entries),
    isLoading,
    addTextEntry,
    addPhotoEntry,
    addVideoEntry,
    updateEntry,
    deleteEntry,
    getEntriesForDate: getEntriesForDateFn,
    refreshEntries,
  };
}
