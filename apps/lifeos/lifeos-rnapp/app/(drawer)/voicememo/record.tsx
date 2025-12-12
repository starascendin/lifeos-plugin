import { View, ViewStyle, SafeAreaView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useVoiceMemoStorage } from '@/hooks/useVoiceMemoStorage';
import { RecordButton, WaveformVisualizer } from '@/components/voicememo';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { X, Check, Pause, Play } from 'lucide-react-native';
import { formatDuration } from '@/utils/voicememo/format';
import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export default function RecordScreen() {
  const router = useRouter();
  const backgroundColor = useColor('background');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const redColor = useColor('red');
  const greenColor = useColor('green');

  const [isSaving, setIsSaving] = useState(false);

  const {
    isRecording,
    isPaused,
    duration,
    metering,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const { addMemo } = useVoiceMemoStorage();

  const handleRecordToggle = useCallback(async () => {
    if (!isRecording) {
      await startRecording();
    } else if (isPaused) {
      await resumeRecording();
    } else {
      await pauseRecording();
    }
  }, [isRecording, isPaused, startRecording, pauseRecording, resumeRecording]);

  const handleCancel = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await cancelRecording();
    router.back();
  }, [cancelRecording, router]);

  const handleSave = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsSaving(true);

    try {
      const uri = await stopRecording();
      if (uri) {
        await addMemo(uri, duration);
      }
      router.back();
    } catch (error) {
      console.error('Failed to save recording:', error);
      setIsSaving(false);
    }
  }, [stopRecording, addMemo, duration, router]);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  };

  const contentStyle: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
  };

  const timerStyle: ViewStyle = {
    alignItems: 'center',
  };

  const controlsStyle: ViewStyle = {
    alignItems: 'center',
    gap: 24,
  };

  const pauseResumeStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  };

  return (
    <SafeAreaView style={containerStyle}>
      {/* Header */}
      <View style={headerStyle}>
        <HeaderButton
          icon={X}
          label="Cancel"
          color={redColor}
          onPress={handleCancel}
          disabled={isSaving}
        />

        {isRecording && duration > 0 && (
          <HeaderButton
            icon={Check}
            label="Done"
            color={greenColor}
            onPress={handleSave}
            disabled={isSaving}
          />
        )}
      </View>

      {/* Content */}
      <View style={contentStyle}>
        {/* Timer display */}
        <View style={timerStyle}>
          <Text
            style={{
              fontSize: 64,
              fontWeight: '200',
              fontVariant: ['tabular-nums'],
              color: textColor,
            }}
          >
            {formatDuration(duration)}
          </Text>
          {isRecording && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: redColor,
                }}
              />
              <Text variant="body" style={{ color: textMuted }}>
                {isPaused ? 'Paused' : 'Recording'}
              </Text>
            </View>
          )}
          {!isRecording && (
            <Text variant="body" style={{ color: textMuted }}>
              Tap to start recording
            </Text>
          )}
        </View>

        {/* Waveform */}
        <View style={{ width: '100%', paddingHorizontal: 32 }}>
          <WaveformVisualizer
            metering={metering}
            isRecording={isRecording && !isPaused}
            height={80}
            barCount={40}
            barWidth={4}
            barGap={3}
          />
        </View>

        {/* Record controls */}
        <View style={controlsStyle}>
          {isRecording && (
            <View style={pauseResumeStyle}>
              <PauseResumeButton
                isPaused={isPaused}
                onPress={handleRecordToggle}
              />
            </View>
          )}

          <RecordButton
            isRecording={isRecording && !isPaused}
            onPress={handleRecordToggle}
            size={80}
            disabled={isSaving}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// Header button component
function HeaderButton({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            padding: 8,
          },
          animatedStyle,
        ]}
      >
        <Icon name={icon} size={20} color={color} />
        <Text style={{ color, fontSize: 16, fontWeight: '500' }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// Pause/Resume button
function PauseResumeButton({
  isPaused,
  onPress,
}: {
  isPaused: boolean;
  onPress: () => void;
}) {
  const textMuted = useColor('textMuted');
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: textMuted + '20',
          },
          animatedStyle,
        ]}
      >
        <Icon name={isPaused ? Play : Pause} size={18} color={textMuted} />
        <Text style={{ color: textMuted, fontSize: 14, fontWeight: '500' }}>
          {isPaused ? 'Resume' : 'Pause'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
