import { useColor } from '@/hooks/useColor';
import { View, ViewStyle, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Mic } from 'lucide-react-native';
import { VoiceMemo } from '@/utils/voicememo/storage';
import { MemoItem } from './MemoItem';
import { useState, useCallback } from 'react';

interface RecordingsListProps {
  memos: VoiceMemo[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRefresh?: () => Promise<void>;
  onSync?: (id: string) => void;
  onTranscribe?: (id: string) => void;
  onRetryTranscription?: (id: string) => void;
}

export function RecordingsList({
  memos,
  isLoading,
  onDelete,
  onRename,
  onRefresh,
  onSync,
  onTranscribe,
  onRetryTranscription,
}: RecordingsListProps) {
  const textMuted = useColor('textMuted');
  const blue = useColor('blue');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  }, [onRefresh]);

  const renderItem = useCallback(
    ({ item }: { item: VoiceMemo }) => (
      <MemoItem
        memo={item}
        onDelete={onDelete}
        onRename={onRename}
        onSync={onSync}
        onTranscribe={onTranscribe}
        onRetryTranscription={onRetryTranscription}
      />
    ),
    [onDelete, onRename, onSync, onTranscribe, onRetryTranscription]
  );

  const keyExtractor = useCallback((item: VoiceMemo) => item.id, []);

  if (isLoading) {
    return (
      <View style={loadingContainerStyle}>
        <Text variant="body" style={{ color: textMuted }}>
          Loading recordings...
        </Text>
      </View>
    );
  }

  if (memos.length === 0) {
    return (
      <View style={emptyContainerStyle}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: blue + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Icon name={Mic} size={36} color={blue} />
        </View>
        <Text
          variant="subtitle"
          style={{ marginBottom: 8, textAlign: 'center' }}
        >
          No Recordings Yet
        </Text>
        <Text
          variant="body"
          style={{
            color: textMuted,
            textAlign: 'center',
            paddingHorizontal: 32,
          }}
        >
          Tap the record button to create your first voice memo
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={memos}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={listContainerStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        ) : undefined
      }
    />
  );
}

const loadingContainerStyle: ViewStyle = {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
};

const emptyContainerStyle: ViewStyle = {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingBottom: 100,
};

const listContainerStyle: ViewStyle = {
  padding: 16,
  paddingBottom: 120, // Space for floating record button
};
