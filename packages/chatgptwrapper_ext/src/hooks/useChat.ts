import { useCallback } from 'react';
import { usePanelsStore } from '../store/panelsStore';
import { sendChatGPTMessage } from '../services/chatgpt';
import { sendClaudeMessage } from '../services/claude';
import { sendGeminiMessage } from '../services/gemini';
import { sendXaiMessage } from '../services/xai';
import type { StreamCallbacks } from '../services/types';

export function useChat(panelId: number) {
  const panel = usePanelsStore((state) => state.panels.find((p) => p.id === panelId));
  const updatePanel = usePanelsStore((state) => state.updatePanel);
  const addMessage = usePanelsStore((state) => state.addMessage);
  const updateLastMessage = usePanelsStore((state) => state.updateLastMessage);
  const removeLastMessage = usePanelsStore((state) => state.removeLastMessage);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !panel || panel.isLoading) return;

      updatePanel(panelId, { isLoading: true, error: null, status: null });
      addMessage(panelId, { role: 'user', content: text });
      addMessage(panelId, { role: 'assistant', content: '' });

      const callbacks: StreamCallbacks = {
        onToken: (content) => updateLastMessage(panelId, content),
        onComplete: () => updatePanel(panelId, { isLoading: false, status: null }),
        onError: (error) => {
          updatePanel(panelId, { isLoading: false, error: error.message, status: null });
          removeLastMessage(panelId);
        },
        onStatus: (status) => updatePanel(panelId, { status })
      };

      try {
        if (panel.llmType === 'chatgpt') {
          const newContext = await sendChatGPTMessage(
            text,
            panel.model,
            {
              conversationId: panel.conversationId,
              parentMessageId: panel.parentMessageId
            },
            callbacks
          );
          updatePanel(panelId, {
            conversationId: newContext.conversationId,
            parentMessageId: newContext.parentMessageId
          });
        } else if (panel.llmType === 'claude') {
          const newContext = await sendClaudeMessage(
            text,
            panel.model,
            {
              conversationId: panel.conversationId,
              claudeOrgUuid: panel.claudeOrgUuid
            },
            callbacks
          );
          updatePanel(panelId, {
            conversationId: newContext.conversationId,
            claudeOrgUuid: newContext.claudeOrgUuid
          });
        } else if (panel.llmType === 'gemini') {
          const newContext = await sendGeminiMessage(
            text,
            { geminiContextIds: panel.geminiContextIds },
            callbacks
          );
          updatePanel(panelId, {
            geminiContextIds: newContext.geminiContextIds
          });
        } else if (panel.llmType === 'xai') {
          const newContext = await sendXaiMessage(
            text,
            panel.model,
            { conversationHistory: panel.xaiConversationHistory },
            callbacks
          );
          updatePanel(panelId, {
            xaiConversationHistory: newContext.conversationHistory
          });
        }
      } catch (err) {
        callbacks.onError(err as Error);
      }
    },
    [panel, panelId, updatePanel, addMessage, updateLastMessage, removeLastMessage]
  );

  return { sendMessage, panel };
}
