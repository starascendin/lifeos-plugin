import { useCallback } from 'react';
import { View, ViewStyle, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { JournalEntry } from '@/utils/journal/storage';
import { formatDateShort, formatEntryCount, isToday } from '@/utils/journal/format';
import { Camera, FileText, Video, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface DayCardProps {
  date: string;
  entries: JournalEntry[];
  onPress: (date: string) => void;
}

export function DayCard({ date, entries, onPress }: DayCardProps) {
  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const blue = useColor('blue');

  const handlePress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(date);
  }, [date, onPress]);

  // Get media entries for thumbnails (up to 3)
  const mediaEntries = entries
    .filter((e) => e.type === 'photo' || e.type === 'video')
    .slice(0, 3);

  const noteEntries = entries.filter((e) => e.type === 'note');
  const firstNote = noteEntries[0];

  const photoCount = entries.filter((e) => e.type === 'photo').length;
  const videoCount = entries.filter((e) => e.type === 'video').length;
  const noteCount = noteEntries.length;

  const containerStyle: ViewStyle = {
    backgroundColor: cardColor,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  };

  const isTodayDate = isToday(date);

  return (
    <Pressable onPress={handlePress}>
      <View style={containerStyle}>
        {/* Header */}
        <View style={headerStyle}>
          <View>
            <Text
              variant="body"
              style={{
                fontWeight: '600',
                color: isTodayDate ? blue : textColor,
                fontSize: 16,
              }}
            >
              {isTodayDate ? 'Today' : formatDateShort(date)}
            </Text>
            <Text variant="caption" style={{ color: textMuted, marginTop: 2 }}>
              {formatEntryCount(entries.length)}
            </Text>
          </View>
          <Icon name={ChevronRight} size={20} color={textMuted} />
        </View>

        {/* Media thumbnails */}
        {mediaEntries.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              gap: 8,
              marginBottom: 12,
            }}
          >
            {mediaEntries.map((entry, index) => (
              <View
                key={entry.id}
                style={{
                  width: mediaEntries.length === 1 ? '100%' : 80,
                  height: mediaEntries.length === 1 ? 160 : 80,
                  borderRadius: 8,
                  overflow: 'hidden',
                  position: 'relative',
                  flex: mediaEntries.length === 1 ? 1 : undefined,
                }}
              >
                <Image
                  source={{
                    uri:
                      entry.type === 'video' && entry.thumbnailUri
                        ? entry.thumbnailUri
                        : entry.mediaUri,
                  }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {entry.type === 'video' && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 4,
                      padding: 2,
                    }}
                  >
                    <Icon name={Video} size={12} color="#FFFFFF" />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* First note preview */}
        {firstNote && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 12,
            }}
          >
            {firstNote.title && (
              <Text
                variant="body"
                style={{ fontWeight: '500', marginBottom: 2 }}
                numberOfLines={1}
              >
                {firstNote.title}
              </Text>
            )}
            {firstNote.content && (
              <Text variant="caption" style={{ color: textMuted }} numberOfLines={2}>
                {firstNote.content}
              </Text>
            )}
          </View>
        )}

        {/* Stats footer */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingBottom: 16,
            gap: 16,
          }}
        >
          {photoCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={Camera} size={14} color={textMuted} />
              <Text variant="caption" style={{ color: textMuted }}>
                {photoCount}
              </Text>
            </View>
          )}
          {videoCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={Video} size={14} color={textMuted} />
              <Text variant="caption" style={{ color: textMuted }}>
                {videoCount}
              </Text>
            </View>
          )}
          {noteCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={FileText} size={14} color={textMuted} />
              <Text variant="caption" style={{ color: textMuted }}>
                {noteCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
