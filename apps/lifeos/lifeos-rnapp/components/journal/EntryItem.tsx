import { useCallback, useState } from 'react';
import { View, ViewStyle, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { JournalEntry } from '@/utils/journal/storage';
import { formatTime } from '@/utils/journal/format';
import { Play, FileText, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface EntryItemProps {
  entry: JournalEntry;
  onPress?: (entry: JournalEntry) => void;
  onDelete?: (id: string) => void;
  showTime?: boolean;
}

const SWIPE_THRESHOLD = 80;

export function EntryItem({
  entry,
  onPress,
  onDelete,
  showTime = true,
}: EntryItemProps) {
  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const redColor = useColor('red');
  const blueColor = useColor('blue');

  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);

  const handlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(entry);
  }, [entry, onPress]);

  const handleDelete = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onDelete?.(entry.id);
  }, [entry.id, onDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -SWIPE_THRESHOLD - 20);
        deleteOpacity.value = Math.min(
          1,
          Math.abs(event.translationX) / SWIPE_THRESHOLD
        );
      }
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SWIPE_THRESHOLD - 20);
        runOnJS(handleDelete)();
      } else {
        translateX.value = withSpring(0, { damping: 20 });
        deleteOpacity.value = withTiming(0);
      }
    });

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
  }));

  const containerStyle: ViewStyle = {
    backgroundColor: cardColor,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  };

  const deleteContainerStyle: ViewStyle = {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_THRESHOLD,
    backgroundColor: redColor,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  };

  const renderContent = () => {
    switch (entry.type) {
      case 'photo':
        return (
          <View>
            {entry.mediaUri && (
              <Image
                source={{ uri: entry.mediaUri }}
                style={{
                  width: '100%',
                  height: 200,
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                }}
                contentFit="cover"
              />
            )}
            {entry.content && (
              <View style={{ padding: 12 }}>
                <Text variant="body" style={{ color: textColor }}>
                  {entry.content}
                </Text>
              </View>
            )}
          </View>
        );

      case 'video':
        return (
          <View>
            <View style={{ position: 'relative' }}>
              {entry.thumbnailUri ? (
                <Image
                  source={{ uri: entry.thumbnailUri }}
                  style={{
                    width: '100%',
                    height: 200,
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                  }}
                  contentFit="cover"
                />
              ) : entry.mediaUri ? (
                <View
                  style={{
                    width: '100%',
                    height: 200,
                    backgroundColor: textMuted + '20',
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Icon name={Play} size={48} color={textMuted} />
                </View>
              ) : null}
              {/* Play overlay */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Icon
                    name={Play}
                    size={28}
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </View>
            </View>
            {entry.content && (
              <View style={{ padding: 12 }}>
                <Text variant="body" style={{ color: textColor }}>
                  {entry.content}
                </Text>
              </View>
            )}
          </View>
        );

      case 'note':
        return (
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: blueColor + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name={FileText} size={20} color={blueColor} />
              </View>
              <View style={{ flex: 1 }}>
                {entry.title && (
                  <Text
                    variant="body"
                    style={{
                      fontWeight: '600',
                      marginBottom: 4,
                      color: textColor,
                    }}
                  >
                    {entry.title}
                  </Text>
                )}
                {entry.content && (
                  <Text
                    variant="body"
                    style={{ color: textMuted }}
                    numberOfLines={3}
                  >
                    {entry.content}
                  </Text>
                )}
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={{ position: 'relative' }}>
      {/* Delete button background */}
      <Animated.View style={[deleteContainerStyle, deleteButtonStyle]}>
        <Icon name={Trash2} size={24} color="#FFFFFF" />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[containerStyle, containerAnimatedStyle]}>
          <Pressable onPress={handlePress}>
            {showTime && (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: entry.type === 'note' ? 0 : 8,
                }}
              >
                <Text variant="caption" style={{ color: textMuted }}>
                  {formatTime(entry.createdAt)}
                </Text>
              </View>
            )}
            {renderContent()}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
