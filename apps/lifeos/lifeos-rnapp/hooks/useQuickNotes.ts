import { useState, useEffect, useCallback } from 'react';
import {
  QuickNote,
  loadQuickNotes,
  saveQuickNotes,
  createQuickNote,
} from '@/utils/quicknotes/storage';

interface UseQuickNotesReturn {
  notes: QuickNote[];
  isLoading: boolean;
  addNote: (text: string) => Promise<QuickNote>;
  updateNote: (id: string, text: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

export function useQuickNotes(): UseQuickNotesReturn {
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshNotes = useCallback(async () => {
    try {
      const loadedNotes = await loadQuickNotes();
      setNotes(loadedNotes);
    } catch (error) {
      console.error('Failed to refresh notes:', error);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        await refreshNotes();
      } catch (error) {
        console.error('Failed to initialize quick notes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [refreshNotes]);

  const addNote = useCallback(
    async (text: string): Promise<QuickNote> => {
      const newNote = createQuickNote(text);
      const updatedNotes = [newNote, ...notes];
      await saveQuickNotes(updatedNotes);
      setNotes(updatedNotes);
      return newNote;
    },
    [notes]
  );

  const updateNote = useCallback(
    async (id: string, text: string) => {
      const updatedNotes = notes.map((note) => {
        if (note.id === id) {
          return {
            ...note,
            text,
            updatedAt: Date.now(),
          };
        }
        return note;
      });

      await saveQuickNotes(updatedNotes);
      setNotes(updatedNotes);
    },
    [notes]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const updatedNotes = notes.filter((note) => note.id !== id);
      await saveQuickNotes(updatedNotes);
      setNotes(updatedNotes);
    },
    [notes]
  );

  return {
    notes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
    refreshNotes,
  };
}
