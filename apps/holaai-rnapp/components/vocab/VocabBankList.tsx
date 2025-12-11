import { useState, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { VocabEntryCard } from './VocabEntryCard';
import { Search, Trash2, BookMarked } from 'lucide-react-native';
import type { Doc } from '@holaai/convex/_generated/dataModel';

interface VocabBankListProps {
  compact?: boolean;
  onItemPress?: (item: Doc<'hola_vocabBank'>) => void;
}

/**
 * Reusable vocab bank list component
 * Can be embedded in Translate screen (compact) or used standalone
 */
export function VocabBankList({ compact = false, onItemPress }: VocabBankListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Colors
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const destructive = useColor('destructive');

  // Queries
  const vocabData = useQuery(api.holaai.vocab.listVocabBank, { limit: 100 });
  const vocabStats = useQuery(api.holaai.vocab.getVocabStats);
  const clearVocabBank = useMutation(api.holaai.vocab.clearVocabBank);

  // Filter entries based on search
  const filteredEntries = vocabData?.items.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.sourceText.toLowerCase().includes(query) ||
      entry.translatedText.toLowerCase().includes(query)
    );
  }) ?? [];

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // The query will automatically refetch
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  const handleClearAll = () => {
    Alert.alert(
      'Clear Vocab Bank',
      'Are you sure you want to delete all saved vocabulary? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearVocabBank({});
            } catch (error) {
              console.error('Failed to clear vocab bank:', error);
              Alert.alert('Error', 'Failed to clear vocabulary bank.');
            }
          },
        },
      ]
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name={BookMarked} size={48} color={textMuted} />
      <Text variant="title" style={{ color: text, marginTop: 16 }}>
        No saved vocabulary
      </Text>
      <Text variant="body" style={{ color: textMuted, textAlign: 'center', marginTop: 8 }}>
        Words you translate will be automatically saved here for review
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (compact) {
      return (
        <View style={styles.compactHeader}>
          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor: card }]}>
            <Icon name={Search} size={18} color={textMuted} />
            <TextInput
              style={[styles.searchInput, { color: text }]}
              placeholder="Search vocabulary..."
              placeholderTextColor={textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {/* Stats */}
          {vocabStats && vocabStats.totalEntries > 0 && (
            <Text variant="caption" style={{ color: textMuted, marginTop: 8 }}>
              {vocabStats.totalEntries} saved • {vocabStats.spanishToEnglish} ES→EN • {vocabStats.englishToSpanish} EN→ES
            </Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.header}>
        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: card }]}>
          <Icon name={Search} size={18} color={textMuted} />
          <TextInput
            style={[styles.searchInput, { color: text }]}
            placeholder="Search vocabulary..."
            placeholderTextColor={textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Stats and Actions */}
        <View style={styles.statsRow}>
          {vocabStats && (
            <View style={styles.stats}>
              <Text variant="title" style={{ color: text }}>
                {vocabStats.totalEntries}
              </Text>
              <Text variant="caption" style={{ color: textMuted, marginLeft: 4 }}>
                words saved
              </Text>
            </View>
          )}

          {vocabStats && vocabStats.totalEntries > 0 && (
            <TouchableOpacity
              style={[styles.clearButton, { borderColor: destructive }]}
              onPress={handleClearAll}
            >
              <Icon name={Trash2} size={14} color={destructive} />
              <Text variant="caption" style={{ color: destructive, marginLeft: 4 }}>
                Clear All
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (vocabData === undefined) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: background }]}>
        <Spinner variant="circle" />
        <Text variant="caption" style={{ color: textMuted, marginTop: 8 }}>
          Loading vocabulary...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <VocabEntryCard
            entry={item}
            compact={compact}
            onDelete={() => {
              // Entry will be removed from list automatically via reactive query
            }}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          styles.listContent,
          filteredEntries.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  compactHeader: {
    padding: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
});
