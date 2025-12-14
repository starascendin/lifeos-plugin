import { useCallback, useEffect, useState } from 'react';
import { Modal, View, ViewStyle, Pressable, Platform, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { Mic, X, Check, Square } from 'lucide-react-native';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { WaveformVisualizer } from '@/components/voicememo/WaveformVisualizer';
import { formatDuration } from '@/utils/voicememo/format';
import * as Haptics from 'expo-haptics';

interface VoiceMemoModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (uri: string, duration: number) => void;
}

export function VoiceMemoModal({
  visible,
  onClose,
  onSave,
}: VoiceMemoModalProps) {
  const [hasStarted, setHasStarted] = useState(false);

  const {
    isRecording,
    isPaused,
    duration,
    metering,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const redColor = useColor('red');
  const greenColor = useColor('green');
  const backgroundColor = useColor('background');

  // Auto-start recording when modal opens
  useEffect(() => {
    if (visible && !hasStarted) {
      const timer = setTimeout(async () => {
        try {
          await startRecording();
          setHasStarted(true);
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        } catch (error) {
          console.error('Failed to start recording:', error);
          Alert.alert(
            'Microphone Access',
            'Unable to access microphone. Please check your permissions.',
            [{ text: 'OK', onPress: onClose }]
          );
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, hasStarted, startRecording, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setHasStarted(false);
    }
  }, [visible]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleSave = useCallback(async () => {
    triggerHaptic();
    const uri = await stopRecording();
    if (uri && duration > 0) {
      onSave(uri, duration);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    onClose();
  }, [stopRecording, duration, onSave, onClose, triggerHaptic]);

  const handleCancel = useCallback(async () => {
    triggerHaptic();
    await cancelRecording();
    onClose();
  }, [cancelRecording, onClose, triggerHaptic]);

  const overlayStyle: ViewStyle = {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  };

  const modalStyle: ViewStyle = {
    backgroundColor: cardColor,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  };

  const iconContainerStyle: ViewStyle = {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: redColor + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  };

  const waveformContainerStyle: ViewStyle = {
    width: '100%',
    height: 80,
    backgroundColor: backgroundColor,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  };

  const timerStyle = {
    fontSize: 40,
    fontWeight: '300' as const,
    fontVariant: ['tabular-nums' as const],
    color: textColor,
    marginBottom: 8,
  };

  const statusTextStyle = {
    color: isRecording ? redColor : textMuted,
    marginBottom: 24,
  };

  const buttonRowStyle: ViewStyle = {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
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
    opacity: duration > 0 ? 1 : 0.5,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable style={overlayStyle} onPress={handleCancel}>
        <Pressable style={modalStyle} onPress={(e) => e.stopPropagation()}>
          {/* Recording Icon */}
          <View style={iconContainerStyle}>
            {isRecording ? (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: redColor,
                }}
              />
            ) : (
              <Icon name={Mic} size={32} color={redColor} />
            )}
          </View>

          {/* Timer */}
          <Text style={timerStyle}>{formatDuration(duration)}</Text>

          {/* Status */}
          <Text variant="caption" style={statusTextStyle}>
            {isRecording ? 'Recording...' : isPaused ? 'Paused' : 'Ready'}
          </Text>

          {/* Waveform */}
          <View style={waveformContainerStyle}>
            <WaveformVisualizer
              metering={metering}
              isRecording={isRecording}
              barCount={25}
              height={60}
            />
          </View>

          {/* Buttons */}
          <View style={buttonRowStyle}>
            <Pressable style={cancelButtonStyle} onPress={handleCancel}>
              <Icon name={X} size={18} color={textMuted} />
              <Text variant="body" style={{ color: textMuted, fontWeight: '500' }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={saveButtonStyle}
              onPress={handleSave}
              disabled={duration === 0}
            >
              <Icon name={Check} size={18} color="#FFFFFF" />
              <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                Save
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
