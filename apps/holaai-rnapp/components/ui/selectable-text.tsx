import { useState, useCallback } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  NativeSyntheticEvent,
  TextLayoutEventData,
  Platform,
} from 'react-native';

export interface SelectableTextProps extends RNTextProps {
  /**
   * Callback when text is selected
   * Note: Text selection behavior varies by platform
   * - iOS: Shows native copy menu, onSelectionChange may not fire reliably
   * - Android: Shows native selection handles with copy option
   */
  onTextSelected?: (selectedText: string) => void;
  /**
   * Custom long press handler
   * Use this for custom selection behavior on platforms where native selection is limited
   */
  onLongPressText?: (fullText: string) => void;
}

/**
 * SelectableText component that enables text selection with optional callbacks
 *
 * Usage:
 * ```tsx
 * <SelectableText
 *   onTextSelected={(text) => console.log('Selected:', text)}
 *   onLongPressText={(text) => showTranslateMenu(text)}
 * >
 *   ¡Hola! ¿Cómo estás?
 * </SelectableText>
 * ```
 *
 * Note: Due to React Native limitations, reliable text selection callbacks
 * are challenging. For the best UX, consider using onLongPressText to
 * show a custom action sheet for the entire text content.
 */
export function SelectableText({
  children,
  onTextSelected,
  onLongPressText,
  style,
  ...props
}: SelectableTextProps) {
  const [textContent, setTextContent] = useState<string>('');

  // Capture the text content from children
  const extractTextContent = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractTextContent).join('');
    return '';
  };

  const fullText = extractTextContent(children);

  const handleLongPress = useCallback(() => {
    if (onLongPressText) {
      onLongPressText(fullText);
    }
  }, [fullText, onLongPressText]);

  return (
    <RNText
      {...props}
      style={style}
      selectable={true}
      onLongPress={handleLongPress}
      // Note: onSelectionChange is not reliably supported in React Native
      // For cross-platform text selection handling, use onLongPress with
      // a custom action sheet that provides translation options
    >
      {children}
    </RNText>
  );
}
