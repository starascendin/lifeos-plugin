import { useCallback, useState } from 'react';
import { View, ViewStyle, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { useJournalStorage } from '@/hooks/useJournalStorage';
import { useAuth } from '@clerk/clerk-expo';
import { CalendarStrip, DayCard } from '@/components/journal';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Plus, BookOpen } from 'lucide-react-native';
import { getTodayDate } from '@/utils/journal/storage';
import { getMonthYearString, formatDateDisplay } from '@/utils/journal/format';
import { parseDateString } from '@/utils/journal/storage';

export default function JournalScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const backgroundColor = useColor('background');
  const cardColor = useColor('card');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const primaryForeground = useColor('primaryForeground');

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [refreshing, setRefreshing] = useState(false);

  const {
    entries,
    entriesByDate,
    datesWithEntries,
    isLoading,
    refreshEntries,
    getEntriesForDate,
  } = useJournalStorage(userId || null);

  useFocusEffect(
    useCallback(() => {
      refreshEntries();
    }, [refreshEntries])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshEntries();
    setRefreshing(false);
  }, [refreshEntries]);

  const handleDayPress = useCallback(
    (date: string) => {
      router.push(`/journal/${date}` as any);
    },
    [router]
  );

  const handleNewEntry = useCallback(() => {
    router.push('/journal/new' as any);
  }, [router]);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const floatingButtonStyle: ViewStyle = {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  };

  // Get entries for the currently viewed month header
  const selectedDateObj = parseDateString(selectedDate);
  const monthHeader = getMonthYearString(selectedDateObj);

  // Sort dates with entries (newest first) for the timeline
  const sortedDates = [...datesWithEntries].sort((a, b) => b.localeCompare(a));

  return (
    <View style={containerStyle}>
      {/* Month header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Text
          variant="body"
          style={{ color: textMuted, fontWeight: '500' }}
        >
          {monthHeader}
        </Text>
      </View>

      {/* Calendar strip */}
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        datesWithEntries={datesWithEntries}
      />

      {/* Timeline / Day cards */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {sortedDates.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 80,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: cardColor,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Icon name={BookOpen} size={36} color={textMuted} />
            </View>
            <Text
              variant="heading"
              style={{ marginBottom: 8, textAlign: 'center' }}
            >
              Start Your Journal
            </Text>
            <Text
              variant="body"
              style={{ color: textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              Capture photos, videos, and notes to reflect on your day
            </Text>
          </View>
        ) : (
          sortedDates.map((date) => (
            <DayCard
              key={date}
              date={date}
              entries={entriesByDate[date] || []}
              onPress={handleDayPress}
            />
          ))
        )}
      </ScrollView>

      {/* Floating add button */}
      <Pressable style={floatingButtonStyle} onPress={handleNewEntry}>
        <Icon name={Plus} size={28} color={primaryForeground} />
      </Pressable>
    </View>
  );
}
