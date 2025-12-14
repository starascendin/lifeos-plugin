import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  ViewStyle,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { FileText, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BORDER_RADIUS, FONT_SIZE } from '@/theme/globals';

interface QuickNoteModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}

export function QuickNoteModal({
  visible,
  onClose,
  onSave,
}: QuickNoteModalProps) {
  const [noteText, setNoteText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const greenColor = useColor('green');
  const backgroundColor = useColor('background');
  const primary = useColor('primary');

  // Auto-focus input when modal opens
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setNoteText('');
    }
  }, [visible]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!noteText.trim()) return;
    triggerHaptic();
    onSave(noteText.trim());
    setNoteText('');
    onClose();
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [noteText, onSave, onClose, triggerHaptic]);

  const handleClose = useCallback(() => {
    triggerHaptic();
    setNoteText('');
    onClose();
  }, [onClose, triggerHaptic]);

  const overlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  };

  const modalStyle: ViewStyle = {
    backgroundColor: cardColor,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  };

  const iconContainerStyle: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const inputContainerStyle: ViewStyle = {
    backgroundColor: backgroundColor,
    borderRadius: BORDER_RADIUS,
    padding: 16,
    minHeight: 120,
    marginBottom: 16,
  };

  const buttonRowStyle: ViewStyle = {
    flexDirection: 'row',
    gap: 12,
  };

  const buttonStyle: ViewStyle = {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  };

  const cancelButtonStyle: ViewStyle = {
    ...buttonStyle,
    backgroundColor: backgroundColor,
  };

  const saveButtonStyle: ViewStyle = {
    ...buttonStyle,
    backgroundColor: greenColor,
    opacity: noteText.trim() ? 1 : 0.5,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={overlayStyle} onPress={handleClose}>
          <Pressable style={modalStyle} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={headerStyle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={iconContainerStyle}>
                  <Icon name={FileText} size={20} color={primary} />
                </View>
                <Text variant="title">Quick Note</Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Icon name={X} size={24} color={textMuted} />
              </Pressable>
            </View>

            {/* Input */}
            <View style={inputContainerStyle}>
              <TextInput
                ref={inputRef}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Type your note..."
                placeholderTextColor={textMuted}
                multiline
                style={{
                  fontSize: FONT_SIZE,
                  color: textColor,
                  textAlignVertical: 'top',
                  minHeight: 88,
                }}
                selectionColor={primary}
              />
            </View>

            {/* Buttons */}
            <View style={buttonRowStyle}>
              <Pressable style={cancelButtonStyle} onPress={handleClose}>
                <Icon name={X} size={18} color={textMuted} />
                <Text variant="body" style={{ color: textMuted, fontWeight: '500' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={saveButtonStyle}
                onPress={handleSave}
                disabled={!noteText.trim()}
              >
                <Icon name={Check} size={18} color="#FFFFFF" />
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
