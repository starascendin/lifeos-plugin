import { useColor } from '@/hooks/useColor';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  metering: number; // -160 to 0 dB
  isRecording: boolean;
  barCount?: number;
  height?: number;
  barWidth?: number;
  barGap?: number;
}

// Create animated bar component
function AnimatedBar({
  targetHeight,
  color,
  width,
  maxHeight,
}: {
  targetHeight: number;
  color: string;
  width: number;
  maxHeight: number;
}) {
  const heightValue = useSharedValue(4);

  useEffect(() => {
    heightValue.value = withSpring(Math.max(4, targetHeight), {
      damping: 15,
      stiffness: 200,
    });
  }, [targetHeight, heightValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          backgroundColor: color,
          borderRadius: width / 2,
          maxHeight,
        },
        animatedStyle,
      ]}
    />
  );
}

export function WaveformVisualizer({
  metering,
  isRecording,
  barCount = 30,
  height = 60,
  barWidth = 3,
  barGap = 2,
}: WaveformVisualizerProps) {
  const primaryColor = useColor('primary');
  const mutedColor = useColor('textMuted');

  // Store bar heights history
  const barHeightsRef = useRef<number[]>(new Array(barCount).fill(4));

  // Normalize metering from dB (-160 to 0) to 0-1 range
  const normalizedLevel = Math.max(0, Math.min(1, (metering + 160) / 160));

  // Update bar heights when recording
  useEffect(() => {
    if (isRecording) {
      // Shift bars left and add new value
      const newHeights = [...barHeightsRef.current.slice(1)];
      const newHeight = 4 + normalizedLevel * (height - 8);
      newHeights.push(newHeight);
      barHeightsRef.current = newHeights;
    }
  }, [metering, isRecording, normalizedLevel, height]);

  // Reset when not recording
  useEffect(() => {
    if (!isRecording) {
      barHeightsRef.current = new Array(barCount).fill(4);
    }
  }, [isRecording, barCount]);

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    gap: barGap,
  };

  const barColor = isRecording ? primaryColor : mutedColor;

  return (
    <View style={containerStyle}>
      {barHeightsRef.current.map((barHeight, index) => (
        <AnimatedBar
          key={index}
          targetHeight={barHeight}
          color={barColor}
          width={barWidth}
          maxHeight={height}
        />
      ))}
    </View>
  );
}

// Static waveform for playback display
interface StaticWaveformProps {
  progress?: number; // 0-1
  height?: number;
  barCount?: number;
  barWidth?: number;
  barGap?: number;
}

export function StaticWaveform({
  progress = 0,
  height = 40,
  barCount = 20,
  barWidth = 2,
  barGap = 1,
}: StaticWaveformProps) {
  const primaryColor = useColor('blue');
  const mutedColor = useColor('textMuted');

  // Generate random but consistent bar heights
  const barHeights = useRef(
    Array.from({ length: barCount }, (_, i) => {
      const seed = Math.sin(i * 12.9898) * 43758.5453;
      return 0.3 + (seed - Math.floor(seed)) * 0.7;
    })
  ).current;

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height,
    gap: barGap,
  };

  const progressIndex = Math.floor(progress * barCount);

  return (
    <View style={containerStyle}>
      {barHeights.map((heightRatio, index) => (
        <View
          key={index}
          style={{
            width: barWidth,
            height: Math.max(4, heightRatio * height),
            backgroundColor: index <= progressIndex ? primaryColor : mutedColor,
            borderRadius: barWidth / 2,
            opacity: index <= progressIndex ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}
