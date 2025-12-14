import { Pressable, ViewStyle, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { LucideProps } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  SharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

interface RadialMenuItemProps {
  icon: React.ComponentType<LucideProps>;
  label: string;
  angle: number;
  distance: number;
  progress: SharedValue<number>;
  delay: number;
  onPress: () => void;
  color: string;
  backgroundColor: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function RadialMenuItem({
  icon,
  label,
  angle,
  distance,
  progress,
  delay,
  onPress,
  color,
  backgroundColor,
}: RadialMenuItemProps) {
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handlePress = useCallback(() => {
    triggerHaptic();
    onPress();
  }, [onPress, triggerHaptic]);

  const animatedStyle = useAnimatedStyle(() => {
    // Calculate delayed progress (stagger effect)
    const delayedProgress = Math.max(
      0,
      Math.min(1, (progress.value * 300 - delay) / 200)
    );

    // Convert angle to radians
    const radians = (angle * Math.PI) / 180;

    // Calculate position
    const translateX = interpolate(
      delayedProgress,
      [0, 1],
      [0, distance * Math.cos(radians)]
    );
    const translateY = interpolate(
      delayedProgress,
      [0, 1],
      [0, distance * Math.sin(radians)]
    );

    // Scale and opacity
    const scale = interpolate(delayedProgress, [0, 0.5, 1], [0.3, 1.1, 1]);
    const opacity = interpolate(delayedProgress, [0, 0.3, 1], [0, 0.8, 1]);

    return {
      transform: [
        { translateX },
        { translateY },
        { scale },
      ],
      opacity,
    };
  });

  const containerStyle: ViewStyle = {
    position: 'absolute',
    alignItems: 'center',
    bottom: 8,
    right: 8,
  };

  const buttonStyle: ViewStyle = {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  };

  const labelStyle = {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '500' as const,
    color,
  };

  return (
    <AnimatedPressable
      style={[containerStyle, animatedStyle]}
      onPress={handlePress}
    >
      <Animated.View style={buttonStyle}>
        <Icon name={icon} size={22} color={color} />
      </Animated.View>
      <Text style={labelStyle}>{label}</Text>
    </AnimatedPressable>
  );
}
