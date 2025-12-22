import { create } from 'zustand';
import type { ConversationIndex, SavedCouncilConversation } from '../types/councilHistory';
import { generateTitle } from '../types/councilHistory';
import {
  loadConversationIndex,
  loadConversation,
  saveConversation,
  deleteConversation as deleteFromStorage,
  setCurrentConversationId,
  getCurrentConversationId,
  cleanupOldConversations
} from '../services/councilStorage';
import { useCouncilStore } from './councilStore';
import { useAppStore } from './appStore';

interface CouncilHistoryState {
  // State
  conversations: ConversationIndex[];
  currentConversationId: string | null;
  currentTitle: string | null;
  isHistoryLoading: boolean;
  isHistoryOpen: boolean;

  // Actions
  loadHistory: () => Promise<void>;
  createNewConversation: () => void;
  loadConversationById: (id: string) => Promise<void>;
  saveCurrentConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setHistoryOpen: (open: boolean) => void;
  updateTitle: (title: string) => void;
  initFromStorage: () => Promise<void>;
}

export const useCouncilHistoryStore = create<CouncilHistoryState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentTitle: null,
  isHistoryLoading: false,
  isHistoryOpen: true,

  loadHistory: async () => {
    set({ isHistoryLoading: true });
    try {
      const index = await loadConversationIndex();
      set({ conversations: index });
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      set({ isHistoryLoading: false });
    }
  },

  createNewConversation: () => {
    // Clear council store messages
    useCouncilStore.getState().clearMessages();

    // Generate new ID
    const newId = crypto.randomUUID();

    set({
      currentConversationId: newId,
      currentTitle: null
    });

    // Persist the new conversation ID
    setCurrentConversationId(newId);
  },

  loadConversationById: async (id: string) => {
    set({ isHistoryLoading: true });
    try {
      const conversation = await loadConversation(id);
      if (conversation) {
        // Load messages into council store
        const councilStore = useCouncilStore.getState();
        councilStore.clearMessages();

        // Restore messages
        for (const msg of conversation.messages) {
          if (msg.role === 'user' && msg.content) {
            councilStore.addUserMessage(msg.content);
          } else if (msg.role === 'assistant') {
            const assistantId = councilStore.addAssistantMessage();
            councilStore.updateMessage(assistantId, {
              stage1: msg.stage1,
              stage2: msg.stage2,
              stage3: msg.stage3,
              metadata: msg.metadata,
              loading: { stage1: false, stage2: false, stage3: false }
            });
          }
        }

        // Restore chairman
        councilStore.setChairman(conversation.chairman);

        set({
          currentConversationId: id,
          currentTitle: conversation.title
        });

        await setCurrentConversationId(id);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      set({ isHistoryLoading: false });
    }
  },

  saveCurrentConversation: async () => {
    const { currentConversationId, currentTitle } = get();
    const councilStore = useCouncilStore.getState();
    const appStore = useAppStore.getState();

    if (councilStore.messages.length === 0) return;

    // Generate or use existing ID
    const id = currentConversationId || crypto.randomUUID();

    // Find first user message for title
    const firstUserMessage = councilStore.messages.find((m) => m.role === 'user' && m.content);
    const title = currentTitle || (firstUserMessage ? generateTitle(firstUserMessage.content!) : 'Untitled');

    const now = Date.now();
    const existingConversation = get().conversations.find((c) => c.id === id);

    const conversation: SavedCouncilConversation = {
      id,
      title,
      createdAt: existingConversation?.createdAt || now,
      updatedAt: now,
      chairman: councilStore.chairman,
      tier: appStore.currentTier,
      messages: councilStore.messages,
      messageCount: councilStore.messages.length
    };

    try {
      await saveConversation(conversation);

      // Update local state
      set({
        currentConversationId: id,
        currentTitle: title
      });

      await setCurrentConversationId(id);

      // Refresh the conversation list
      await get().loadHistory();

      // Cleanup old conversations
      await cleanupOldConversations(50);
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw error;
    }
  },

  deleteConversation: async (id: string) => {
    const { currentConversationId } = get();

    try {
      await deleteFromStorage(id);

      // If deleting current conversation, create a new one
      if (id === currentConversationId) {
        get().createNewConversation();
      }

      // Refresh the list
      await get().loadHistory();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw error;
    }
  },

  setHistoryOpen: (open: boolean) => {
    set({ isHistoryOpen: open });
  },

  updateTitle: (title: string) => {
    set({ currentTitle: title });
  },

  initFromStorage: async () => {
    // Load the conversation list
    await get().loadHistory();

    // Check if there's a current conversation ID saved
    const savedId = await getCurrentConversationId();

    if (savedId) {
      const conversations = get().conversations;
      const exists = conversations.some((c) => c.id === savedId);

      if (exists) {
        // Load the saved conversation
        await get().loadConversationById(savedId);
      } else {
        // Create a new conversation if saved one doesn't exist
        get().createNewConversation();
      }
    } else {
      // No saved conversation, create new
      get().createNewConversation();
    }
  }
}));
