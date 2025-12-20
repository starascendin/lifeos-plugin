import { useCallback, useLayoutEffect } from 'react';
import { View, ViewStyle, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { useJournalStorage } from '@/hooks/useJournalStorage';
import { useAuth } from '@clerk/clerk-expo';
import { EntryItem } from '@/components/journal';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Plus, BookOpen } from 'lucide-react-native';
import { formatDateDisplay } from '@/utils/journal/format';
import { JournalEntry } from '@/utils/journal/storage';
import * as Haptics from 'expo-haptics';

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { userId } = useAuth();
  const backgroundColor = useColor('background');
  const cardColor = useColor('card');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const primaryForeground = useColor('primaryForeground');

  const {
    getEntriesForDate,
    deleteEntry,
    refreshEntries,
  } = useJournalStorage(userId || null);

  const entries = date ? getEntriesForDate(date) : [];

  // Set the header title
  useLayoutEffect(() => {
    if (date) {
      navigation.setOptions({
        title: formatDateDisplay(date),
      });
    }
  }, [date, navigation]);

  useFocusEffect(
    useCallback(() => {
      refreshEntries();
    }, [refreshEntries])
  );

  const handleEntryPress = useCallback((entry: JournalEntry) => {
    // TODO: Navigate to entry detail view
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      await deleteEntry(id);
    },
    [deleteEntry]
  );

  const handleNewEntry = useCallback(() => {
    router.push({
      pathname: '/journal/new' as any,
      params: { date },
    });
  }, [router, date]);

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

  return (
    <View style={containerStyle}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {entries.length === 0 ? (
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
              No Entries Yet
            </Text>
            <Text
              variant="body"
              style={{ color: textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              Add your first entry for this day
            </Text>
          </View>
        ) : (
          entries.map((entry) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              onPress={handleEntryPress}
              onDelete={handleDeleteEntry}
              showTime={true}
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
