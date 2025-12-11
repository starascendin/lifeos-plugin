import { useCallback } from 'react';
import { TextStyle, StyleProp, Alert, Text } from 'react-native';
import { SelectableTextView } from '@rob117/react-native-selectable-text';
import { useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useTextSelectionContext } from '@/contexts/TextSelectionContext';

export interface HighlightableTextProps {
  /** The text content to display and make selectable */
  children: string;
  /** Source language of the text (defaults to 'es' for Spanish) */
  sourceLanguage?: 'es' | 'en';
  /** Text style */
  style?: StyleProp<TextStyle>;
}

interface SelectionEvent {
  chosenOption: string;
  highlightedText: string;
}

const MENU_OPTIONS = ['Translate', 'Add to Vocab'];

/**
 * HighlightableText enables users to select specific words or phrases
 * and provides context menu options to translate or add to vocabulary bank.
 *
 * Uses native text selection with drag handles on both iOS and Android.
 *
 * @example
 * ```tsx
 * <HighlightableText sourceLanguage="es" style={{ fontSize: 16 }}>
 *   ¡Hola! ¿Cómo estás?
 * </HighlightableText>
 * ```
 */
export function HighlightableText({
  children,
  sourceLanguage = 'es',
  style,
}: HighlightableTextProps) {
  const { setSelection, setShowTranslationModal } = useTextSelectionContext();
  const addToVocabBank = useMutation(api.holaai.vocab.addToVocabBank);

  const handleSelection = useCallback(async (event: SelectionEvent) => {
    const { chosenOption, highlightedText } = event;

    if (!highlightedText || highlightedText.trim().length === 0) {
      return;
    }

    const trimmedText = highlightedText.trim();

    if (chosenOption === 'Translate') {
      // Set the selection in context and show translation modal
      setSelection({
        selectedText: trimmedText,
        sourceLanguage,
      });
      setShowTranslationModal(true);
    } else if (chosenOption === 'Add to Vocab') {
      // Add directly to vocab bank
      try {
        await addToVocabBank({
          sourceText: trimmedText,
          translatedText: '', // Will be filled when user translates
          sourceLanguage,
          targetLanguage: sourceLanguage === 'es' ? 'en' : 'es',
          context: 'chat_highlight',
        });
        Alert.alert('Added!', `"${trimmedText}" added to your vocabulary bank`);
      } catch (error) {
        console.error('Failed to add to vocab:', error);
        Alert.alert('Error', 'Failed to add to vocabulary bank');
      }
    }
  }, [sourceLanguage, setSelection, setShowTranslationModal, addToVocabBank]);

  return (
    <SelectableTextView
      menuOptions={MENU_OPTIONS}
      onSelection={handleSelection}
    >
      <Text style={style}>{children}</Text>
    </SelectableTextView>
  );
}
