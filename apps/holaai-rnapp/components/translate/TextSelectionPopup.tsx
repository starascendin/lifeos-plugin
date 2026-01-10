import { StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { Languages, BookPlus, X } from 'lucide-react-native';

interface TextSelectionPopupProps {
  visible: boolean;
  selectedText: string;
  onTranslate: () => void;
  onAddToVocab: () => void;
  onClose: () => void;
}

/**
 * Popup that appears when text is selected in chat messages
 * Provides options to translate or add to vocab bank
 */
export function TextSelectionPopup({
  visible,
  selectedText,
  onTranslate,
  onAddToVocab,
  onClose,
}: TextSelectionPopupProps) {
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.popup, { backgroundColor: card }]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="caption" style={{ color: textMuted }} numberOfLines={2}>
              "{selectedText.length > 50 ? selectedText.slice(0, 50) + '...' : selectedText}"
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name={X} size={18} color={textMuted} />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: primary }]}
              onPress={() => {
                onTranslate();
              }}
            >
              <Icon name={Languages} size={18} color="#fff" />
              <Text variant="body" style={styles.actionText}>
                Translate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: background, borderWidth: 1, borderColor: primary }]}
              onPress={() => {
                onAddToVocab();
              }}
            >
              <Icon name={BookPlus} size={18} color={primary} />
              <Text variant="body" style={[styles.actionText, { color: primary }]}>
                Add to Vocab
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popup: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
});
