import { useColor } from '@/hooks/useColor';
import * as Haptics from 'expo-haptics';
import { Pressable, ViewStyle, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
}

export function RecordButton({
  isRecording,
  onPress,
  size = 70,
  disabled = false,
}: RecordButtonProps) {
  const redColor = useColor('red');
  const backgroundColor = useColor('background');

  const scale = useSharedValue(1);
  const innerScale = useSharedValue(1);
  const innerBorderRadius = useSharedValue(size / 2 - 8);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      // Animate to square shape
      innerBorderRadius.value = withSpring(8, { damping: 15 });
      innerScale.value = withSpring(0.5, { damping: 15 });

      // Pulsing animation
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      // Animate back to circle
      innerBorderRadius.value = withSpring(size / 2 - 8, { damping: 15 });
      innerScale.value = withSpring(1, { damping: 15 });

      // Stop pulsing
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording, innerBorderRadius, innerScale, pulseOpacity, size]);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
    borderRadius: innerBorderRadius.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: 1.3 }],
  }));

  const outerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 4,
    borderColor: redColor,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: backgroundColor,
  };

  const innerBaseStyle: ViewStyle = {
    width: size - 16,
    height: size - 16,
    backgroundColor: redColor,
  };

  const pulseBaseStyle: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: redColor,
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={containerStyle}>
        {isRecording && <Animated.View style={[pulseBaseStyle, pulseStyle]} />}
        <Animated.View style={outerStyle}>
          <Animated.View style={[innerBaseStyle, innerStyle]} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
