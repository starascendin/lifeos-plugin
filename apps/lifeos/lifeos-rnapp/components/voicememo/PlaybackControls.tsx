import { useColor } from '@/hooks/useColor';
import { View, ViewStyle, Pressable, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Play, Pause } from 'lucide-react-native';
import { formatDuration } from '@/utils/voicememo/format';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface PlaybackControlsProps {
  isPlaying: boolean;
  position: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
}

export function PlaybackControls({
  isPlaying,
  position,
  duration,
  onPlay,
  onPause,
}: PlaybackControlsProps) {
  const textMuted = useColor('textMuted');
  const blue = useColor('blue');

  const containerStyle: ViewStyle = {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    <View style={containerStyle}>
      <Pressable
        onPress={handlePlayPause}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            {
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: blue,
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedStyle,
          ]}
        >
          <Icon
            name={isPlaying ? Pause : Play}
            size={20}
            color="#FFFFFF"
            style={isPlaying ? {} : { marginLeft: 2 }}
          />
        </Animated.View>
      </Pressable>

      <Text variant="caption" style={{ color: textMuted }}>
        {formatDuration(position)} / {formatDuration(duration)}
      </Text>
    </View>
  );
}
