import { useCallback, useRef, useEffect } from 'react';
import {
  View,
  ViewStyle,
  Pressable,
  FlatList,
  Platform,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import * as Haptics from 'expo-haptics';
import {
  formatDateToString,
  getScrollableDates,
} from '@/utils/journal/storage';
import { getDayOfWeekAbbrev } from '@/utils/journal/format';

interface CalendarStripProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  datesWithEntries?: string[];
}

const ITEM_WIDTH = 48;
const ITEM_GAP = 4;

export function CalendarStrip({
  selectedDate,
  onSelectDate,
  datesWithEntries = [],
}: CalendarStripProps) {
  const flatListRef = useRef<FlatList>(null);
  const background = useColor('background');
  const cardColor = useColor('card');
  const primary = useColor('primary');
  const primaryForeground = useColor('primaryForeground');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const blue = useColor('blue');

  // Generate dates centered around today
  const today = new Date();
  const dates = getScrollableDates(today, 8); // 8 weeks before and after

  const datesWithEntriesSet = new Set(datesWithEntries);

  const todayString = formatDateToString(today);

  const handleSelectDate = useCallback(
    (dateString: string) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSelectDate(dateString);
    },
    [onSelectDate]
  );

  const scrollToDate = useCallback((dateString: string, animated = true) => {
    const index = dates.findIndex(
      (d) => formatDateToString(d) === dateString
    );
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated,
        viewPosition: 0.5,
      });
    }
  }, [dates]);

  const handleTodayPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectDate(todayString);
    scrollToDate(todayString);
  }, [onSelectDate, todayString, scrollToDate]);

  // Scroll to selected date on mount
  useEffect(() => {
    setTimeout(() => {
      scrollToDate(selectedDate, false);
    }, 100);
  }, []);

  const renderItem = useCallback(
    ({ item: date }: { item: Date }) => {
      const dateString = formatDateToString(date);
      const isSelected = dateString === selectedDate;
      const hasEntries = datesWithEntriesSet.has(dateString);
      const isToday = formatDateToString(new Date()) === dateString;

      const dayStyle: ViewStyle = {
        width: ITEM_WIDTH,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: isSelected ? primary : 'transparent',
        marginHorizontal: ITEM_GAP / 2,
      };

      return (
        <Pressable onPress={() => handleSelectDate(dateString)}>
          <View style={dayStyle}>
            <Text
              variant="caption"
              style={{
                color: isSelected ? primaryForeground : textMuted,
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              {getDayOfWeekAbbrev(date)}
            </Text>
            <Text
              variant="body"
              style={{
                color: isSelected
                  ? primaryForeground
                  : isToday
                    ? blue
                    : textColor,
                fontWeight: isSelected || isToday ? '600' : '400',
                fontSize: 18,
              }}
            >
              {date.getDate()}
            </Text>
            {hasEntries && !isSelected && (
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: blue,
                  marginTop: 4,
                }}
              />
            )}
            {isSelected && hasEntries && (
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: primaryForeground,
                  marginTop: 4,
                }}
              />
            )}
          </View>
        </Pressable>
      );
    },
    [
      selectedDate,
      datesWithEntriesSet,
      handleSelectDate,
      primary,
      primaryForeground,
      textColor,
      textMuted,
      blue,
    ]
  );

  const containerStyle: ViewStyle = {
    backgroundColor: background,
    paddingVertical: 8,
  };

  const isSelectedToday = selectedDate === todayString;

  return (
    <View style={containerStyle}>
      {/* Today button row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={handleTodayPress}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: isSelectedToday ? primary : cardColor,
          }}
        >
          <Text
            variant="caption"
            style={{
              color: isSelectedToday ? primaryForeground : blue,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            Today
          </Text>
        </Pressable>
      </View>
      <FlatList
        ref={flatListRef}
        data={dates}
        renderItem={renderItem}
        keyExtractor={(date) => formatDateToString(date)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 8,
        }}
        getItemLayout={(_, index) => ({
          length: ITEM_WIDTH + ITEM_GAP,
          offset: (ITEM_WIDTH + ITEM_GAP) * index,
          index,
        })}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
              viewPosition: 0.5,
            });
          }, 100);
        }}
      />
    </View>
  );
}
