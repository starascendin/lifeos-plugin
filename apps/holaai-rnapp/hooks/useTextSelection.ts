import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useTextSelectionContext } from '@/contexts/TextSelectionContext';

export interface UseTextSelectionOptions {
  /** Source language for the text being selected */
  sourceLanguage?: 'es' | 'en' | 'auto';
}

export interface UseTextSelectionReturn {
  /** Current selected text from context */
  selectedText: string;
  /** Source language from context */
  sourceLanguage: 'es' | 'en' | 'auto';
  /** Whether translation modal should be shown */
  showTranslationModal: boolean;
  /** Set translation modal visibility */
  setShowTranslationModal: (show: boolean) => void;
  /** Clear the current selection */
  clearSelection: () => void;
  /** Add the selected text to vocab bank */
  handleAddToVocab: () => Promise<void>;
  /** Open translation modal for the selected text */
  handleTranslate: () => void;
  /** Close translation modal and clear selection */
  handleCloseTranslationModal: () => void;
}

/**
 * Hook for managing text selection state and actions.
 * Integrates with TextSelectionContext to coordinate selection
 * across HighlightableText components and TranslationModal.
 *
 * @example
 * ```tsx
 * const {
 *   selectedText,
 *   showTranslationModal,
 *   handleCloseTranslationModal,
 * } = useTextSelection();
 *
 * return (
 *   <>
 *     <HighlightableText sourceLanguage="es">
 *       ¡Hola! ¿Cómo estás?
 *     </HighlightableText>
 *     <TranslationModal
 *       visible={showTranslationModal}
 *       text={selectedText}
 *       onClose={handleCloseTranslationModal}
 *     />
 *   </>
 * );
 * ```
 */
export function useTextSelection(options: UseTextSelectionOptions = {}): UseTextSelectionReturn {
  const defaultSourceLanguage = options.sourceLanguage ?? 'es';

  const {
    selection,
    setSelection,
    clearSelection,
    showTranslationModal,
    setShowTranslationModal,
  } = useTextSelectionContext();

  const addToVocabBank = useMutation(api.holaai.vocab.addToVocabBank);

  const selectedText = selection?.selectedText ?? '';
  const sourceLanguage = selection?.sourceLanguage ?? defaultSourceLanguage;

  const handleTranslate = useCallback(() => {
    if (selectedText) {
      setShowTranslationModal(true);
    }
  }, [selectedText, setShowTranslationModal]);

  const handleAddToVocab = useCallback(async () => {
    if (!selectedText) return;

    try {
      await addToVocabBank({
        sourceText: selectedText,
        translatedText: '', // Will be filled when user translates
        sourceLanguage,
        targetLanguage: sourceLanguage === 'es' ? 'en' : 'es',
        context: 'chat_highlight',
      });
      Alert.alert('Added!', `"${selectedText}" added to your vocabulary bank`);
      clearSelection();
    } catch (error) {
      console.error('Failed to add to vocab:', error);
      Alert.alert('Error', 'Failed to add to vocabulary bank');
    }
  }, [selectedText, sourceLanguage, addToVocabBank, clearSelection]);

  const handleCloseTranslationModal = useCallback(() => {
    setShowTranslationModal(false);
    clearSelection();
  }, [setShowTranslationModal, clearSelection]);

  return {
    selectedText,
    sourceLanguage,
    showTranslationModal,
    setShowTranslationModal,
    clearSelection,
    handleAddToVocab,
    handleTranslate,
    handleCloseTranslationModal,
  };
}
