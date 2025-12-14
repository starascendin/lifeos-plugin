import { View, ViewStyle } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { useVoiceMemoSync } from '@/hooks/useVoiceMemoSync';
import { RecordingsList, RecordButton } from '@/components/voicememo';
import { useCallback } from 'react';

export default function VoiceMemoListScreen() {
  const router = useRouter();
  const backgroundColor = useColor('background');

  const {
    memos,
    isLoading,
    deleteMemo,
    updateMemo,
    refreshMemos,
    syncMemo,
    transcribeMemo,
    retryTranscription,
  } = useVoiceMemoSync();

  // Refresh memos when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshMemos();
    }, [refreshMemos])
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMemo(id);
    },
    [deleteMemo]
  );

  const handleRename = useCallback(
    async (id: string, name: string) => {
      await updateMemo(id, { name });
    },
    [updateMemo]
  );

  const handleSync = useCallback(
    async (id: string) => {
      await syncMemo(id);
    },
    [syncMemo]
  );

  const handleTranscribe = useCallback(
    async (id: string) => {
      await transcribeMemo(id);
    },
    [transcribeMemo]
  );

  const handleRetryTranscription = useCallback(
    async (id: string) => {
      await retryTranscription(id);
    },
    [retryTranscription]
  );

  const handleRecordPress = useCallback(() => {
    router.push('/voicememo/record' as any);
  }, [router]);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const floatingButtonContainerStyle: ViewStyle = {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  };

  return (
    <View style={containerStyle}>
      <RecordingsList
        memos={memos}
        isLoading={isLoading}
        onDelete={handleDelete}
        onRename={handleRename}
        onRefresh={refreshMemos}
        onSync={handleSync}
        onTranscribe={handleTranscribe}
        onRetryTranscription={handleRetryTranscription}
      />

      {/* Floating record button */}
      <View style={floatingButtonContainerStyle}>
        <RecordButton isRecording={false} onPress={handleRecordPress} />
      </View>
    </View>
  );
}
