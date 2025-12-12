import { useColor } from '@/hooks/useColor';
import { View, ViewStyle, Pressable, Platform, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Play, Pause, Trash2, Pencil, Check, X } from 'lucide-react-native';
import { VoiceMemo } from '@/utils/voicememo/storage';
import {
  formatDurationShort,
  formatRelativeDate,
} from '@/utils/voicememo/format';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useState, useCallback } from 'react';
import { StaticWaveform } from './WaveformVisualizer';
import { PlaybackControls } from './PlaybackControls';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface MemoItemProps {
  memo: VoiceMemo;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

const SWIPE_THRESHOLD = 80;

export function MemoItem({ memo, onDelete, onRename }: MemoItemProps) {
  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const redColor = useColor('red');
  const blueColor = useColor('blue');

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(memo.name);

  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);

  const {
    isPlaying,
    isLoaded,
    position,
    duration,
    loadAudio,
    play,
    pause,
    seek,
    unload,
  } = useAudioPlayer();

  const handleExpand = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (!isExpanded) {
      await loadAudio(memo.uri);
    } else {
      await unload();
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded, loadAudio, unload, memo.uri]);

  const handleDelete = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onDelete(memo.id);
  }, [onDelete, memo.id]);

  const handleStartEdit = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditedName(memo.name);
    setIsEditing(true);
  }, [memo.name]);

  const handleSaveEdit = useCallback(() => {
    if (editedName.trim()) {
      onRename(memo.id, editedName.trim());
    }
    setIsEditing(false);
  }, [editedName, onRename, memo.id]);

  const handleCancelEdit = useCallback(() => {
    setEditedName(memo.name);
    setIsEditing(false);
  }, [memo.name]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow swiping left
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
        // Trigger delete
        translateX.value = withTiming(-SWIPE_THRESHOLD - 20);
        runOnJS(handleDelete)();
      } else {
        // Reset position
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

  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
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

  const playProgress = duration > 0 ? position / duration : 0;

  return (
    <View style={{ position: 'relative' }}>
      {/* Delete button background */}
      <Animated.View style={[deleteContainerStyle, deleteButtonStyle]}>
        <Icon name={Trash2} size={24} color="#FFFFFF" />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[containerStyle, containerAnimatedStyle]}>
          <Pressable onPress={handleExpand} onLongPress={handleStartEdit}>
            <View style={rowStyle}>
              {/* Play indicator / waveform */}
              <View
                style={{
                  width: 50,
                  height: 40,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {isExpanded ? (
                  <StaticWaveform
                    progress={playProgress}
                    height={40}
                    barCount={15}
                    barWidth={2}
                    barGap={1}
                  />
                ) : (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: blueColor + '20',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Icon
                      name={Play}
                      size={20}
                      color={blueColor}
                      style={{ marginLeft: 3 }}
                    />
                  </View>
                )}
              </View>

              {/* Memo info */}
              <View style={{ flex: 1 }}>
                {isEditing ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <TextInput
                      value={editedName}
                      onChangeText={setEditedName}
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: '500',
                        color: textColor,
                        padding: 4,
                        borderBottomWidth: 1,
                        borderBottomColor: blueColor,
                      }}
                      autoFocus
                      selectTextOnFocus
                      onSubmitEditing={handleSaveEdit}
                    />
                    <Pressable onPress={handleSaveEdit}>
                      <Icon name={Check} size={20} color={blueColor} />
                    </Pressable>
                    <Pressable onPress={handleCancelEdit}>
                      <Icon name={X} size={20} color={textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text
                      variant="body"
                      style={{
                        fontWeight: '500',
                        marginBottom: 4,
                      }}
                    >
                      {memo.name}
                    </Text>
                    <View
                      style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                    >
                      <Text variant="caption" style={{ color: textMuted }}>
                        {formatRelativeDate(memo.createdAt)}
                      </Text>
                      <Text variant="caption" style={{ color: textMuted }}>
                        {formatDurationShort(memo.duration)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Edit button (only when not editing) */}
              {!isEditing && (
                <Pressable onPress={handleStartEdit} hitSlop={8}>
                  <Icon name={Pencil} size={18} color={textMuted} />
                </Pressable>
              )}
            </View>
          </Pressable>

          {/* Expanded playback controls */}
          {isExpanded && isLoaded && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <PlaybackControls
                isPlaying={isPlaying}
                position={position}
                duration={duration || memo.duration}
                onPlay={play}
                onPause={pause}
                onSeek={seek}
              />
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
