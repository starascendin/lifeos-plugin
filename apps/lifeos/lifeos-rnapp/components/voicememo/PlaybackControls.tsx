import { useColor } from '@/hooks/useColor';
import { View, ViewStyle, Pressable, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
} from 'lucide-react-native';
import { formatDuration } from '@/utils/voicememo/format';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';

interface PlaybackControlsProps {
  isPlaying: boolean;
  position: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (position: number) => void;
  onSkipBackward?: () => void;
  onSkipForward?: () => void;
}

export function PlaybackControls({
  isPlaying,
  position,
  duration,
  onPlay,
  onPause,
  onSeek,
  onSkipBackward,
  onSkipForward,
}: PlaybackControlsProps) {
  const primaryColor = useColor('primary');
  const textMuted = useColor('textMuted');
  const blue = useColor('blue');

  const containerStyle: ViewStyle = {
    paddingVertical: 16,
    gap: 16,
  };

  const progressContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  };

  const controlsContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  };

  const handlePlayPause = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleSkipBackward = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onSkipBackward) {
      onSkipBackward();
    } else {
      onSeek(Math.max(0, position - 15000));
    }
  };

  const handleSkipForward = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onSkipForward) {
      onSkipForward();
    } else {
      onSeek(Math.min(duration, position + 15000));
    }
  };

  return (
    <View style={containerStyle}>
      {/* Progress bar */}
      <View style={progressContainerStyle}>
        <Text variant="caption" style={{ color: textMuted, minWidth: 45 }}>
          {formatDuration(position)}
        </Text>
        <View style={{ flex: 1 }}>
          <Slider
            value={position}
            minimumValue={0}
            maximumValue={duration || 1}
            onSlidingComplete={(value) => onSeek(value)}
            minimumTrackTintColor={blue}
            maximumTrackTintColor={textMuted}
            thumbTintColor={blue}
          />
        </View>
        <Text variant="caption" style={{ color: textMuted, minWidth: 45, textAlign: 'right' }}>
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Playback controls */}
      <View style={controlsContainerStyle}>
        <IconButton
          icon={RotateCcw}
          onPress={handleSkipBackward}
          color={primaryColor}
          size={24}
          label="15"
        />

        <PlayPauseButton
          isPlaying={isPlaying}
          onPress={handlePlayPause}
          color={primaryColor}
        />

        <IconButton
          icon={RotateCw}
          onPress={handleSkipForward}
          color={primaryColor}
          size={24}
          label="15"
        />
      </View>
    </View>
  );
}

// Icon button with optional label
function IconButton({
  icon,
  onPress,
  color,
  size,
  label,
}: {
  icon: React.ComponentType<any>;
  onPress: () => void;
  color: string;
  size: number;
  label?: string;
}) {
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

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          {
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
          },
          animatedStyle,
        ]}
      >
        <Icon name={icon} size={size} color={color} />
        {label && (
          <Text
            variant="caption"
            style={{
              fontSize: 10,
              color,
              position: 'absolute',
              bottom: 2,
            }}
          >
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Play/Pause button
function PlayPauseButton({
  isPlaying,
  onPress,
  color,
}: {
  isPlaying: boolean;
  onPress: () => void;
  color: string;
}) {
  const scale = useSharedValue(1);
  const blue = useColor('blue');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: blue,
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedStyle,
        ]}
      >
        <Icon
          name={isPlaying ? Pause : Play}
          size={28}
          color="#FFFFFF"
          style={isPlaying ? {} : { marginLeft: 4 }}
        />
      </Animated.View>
    </Pressable>
  );
}
