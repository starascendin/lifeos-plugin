import { useEffect, useRef } from 'react';
import { useCouncilStore } from '../store/councilStore';
import { useCouncilHistoryStore } from '../store/councilHistoryStore';

/**
 * Hook that auto-saves council conversations when Stage 3 completes.
 * Should be called once at the CouncilContainer level.
 */
export function useCouncilAutoSave() {
  const messages = useCouncilStore((state) => state.messages);
  const saveCurrentConversation = useCouncilHistoryStore((state) => state.saveCurrentConversation);

  // Track which messages we've already saved
  const savedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Find assistant messages with completed stage3
    for (const message of messages) {
      if (
        message.role === 'assistant' &&
        message.stage3 &&
        !message.loading?.stage3 &&
        !savedMessagesRef.current.has(message.id)
      ) {
        // Mark as saved to avoid duplicate saves
        savedMessagesRef.current.add(message.id);

        // Save the conversation
        saveCurrentConversation().catch((error) => {
          console.error('Auto-save failed:', error);
          // Remove from saved set so it can retry
          savedMessagesRef.current.delete(message.id);
        });
      }
    }
  }, [messages, saveCurrentConversation]);

  // Clear saved messages when conversation changes
  const currentConversationId = useCouncilHistoryStore((state) => state.currentConversationId);

  useEffect(() => {
    savedMessagesRef.current.clear();
  }, [currentConversationId]);
}
