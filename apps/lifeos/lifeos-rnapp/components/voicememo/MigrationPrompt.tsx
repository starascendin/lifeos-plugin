import { View, ViewStyle, Pressable, Modal, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { Cloud, CloudOff, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

interface MigrationPromptProps {
  visible: boolean;
  unsyncedCount: number;
  onSyncAll: () => void;
  onSyncLater: () => void;
  onKeepLocal: () => void;
}

export function MigrationPrompt({
  visible,
  unsyncedCount,
  onSyncAll,
  onSyncLater,
  onKeepLocal,
}: MigrationPromptProps) {
  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const blueColor = useColor('blue');
  const backgroundColor = useColor('background');

  const handlePress = useCallback(
    (action: () => void) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      action();
    },
    []
  );

  const overlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  };

  const modalStyle: ViewStyle = {
    backgroundColor: cardColor,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  };

  const headerStyle: ViewStyle = {
    alignItems: 'center',
    marginBottom: 16,
  };

  const iconContainerStyle: ViewStyle = {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: blueColor + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  };

  const buttonStyle: ViewStyle = {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  };

  const primaryButtonStyle: ViewStyle = {
    ...buttonStyle,
    backgroundColor: blueColor,
  };

  const secondaryButtonStyle: ViewStyle = {
    ...buttonStyle,
    backgroundColor: backgroundColor,
  };

  const tertiaryButtonStyle: ViewStyle = {
    ...buttonStyle,
    backgroundColor: 'transparent',
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSyncLater}
    >
      <View style={overlayStyle}>
        <View style={modalStyle}>
          <View style={headerStyle}>
            <View style={iconContainerStyle}>
              <Icon name={Cloud} size={28} color={blueColor} />
            </View>
            <Text
              variant="title"
              style={{
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Sync Your Recordings
            </Text>
            <Text
              variant="body"
              style={{
                textAlign: 'center',
                color: textMuted,
              }}
            >
              You have {unsyncedCount} recording{unsyncedCount === 1 ? '' : 's'} stored
              locally. Would you like to sync them to the cloud?
            </Text>
          </View>

          <View>
            <Text
              variant="caption"
              style={{
                color: textMuted,
                marginBottom: 4,
                marginLeft: 4,
              }}
            >
              Benefits of syncing:
            </Text>
            <View style={{ gap: 4, marginBottom: 16 }}>
              <Text variant="caption" style={{ color: textMuted }}>
                {'\u2022'} AI-powered transcription
              </Text>
              <Text variant="caption" style={{ color: textMuted }}>
                {'\u2022'} Access from any device
              </Text>
              <Text variant="caption" style={{ color: textMuted }}>
                {'\u2022'} Secure cloud backup
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => handlePress(onSyncAll)}
            style={primaryButtonStyle}
          >
            <Text
              variant="body"
              style={{ color: '#FFFFFF', fontWeight: '600' }}
            >
              Sync All Recordings
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handlePress(onSyncLater)}
            style={secondaryButtonStyle}
          >
            <Text
              variant="body"
              style={{ color: textColor, fontWeight: '500' }}
            >
              Remind Me Later
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handlePress(onKeepLocal)}
            style={tertiaryButtonStyle}
          >
            <Text
              variant="caption"
              style={{ color: textMuted }}
            >
              Keep Local Only
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
