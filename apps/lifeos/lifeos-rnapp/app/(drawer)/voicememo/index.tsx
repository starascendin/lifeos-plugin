import { View, ViewStyle } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { useVoiceMemoSync } from '@/hooks/useVoiceMemoSync';
import {
  RecordingsList,
  RecordButton,
  MigrationPrompt,
} from '@/components/voicememo';
import { useCallback, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_DISMISSED_KEY = 'voicememo_migration_dismissed';

export default function VoiceMemoListScreen() {
  const router = useRouter();
  const backgroundColor = useColor('background');

  const {
    memos,
    isLoading,
    isSyncing,
    hasUnsyncedMemos,
    deleteMemo,
    updateMemo,
    refreshMemos,
    syncMemo,
    syncAllPending,
    transcribeMemo,
    retryTranscription,
  } = useVoiceMemoSync();

  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [migrationDismissed, setMigrationDismissed] = useState(false);

  // Check if migration prompt should be shown
  useEffect(() => {
    const checkMigrationStatus = async () => {
      const dismissed = await AsyncStorage.getItem(MIGRATION_DISMISSED_KEY);
      setMigrationDismissed(dismissed === 'true');
    };
    checkMigrationStatus();
  }, []);

  // Show migration prompt if there are unsynced memos and not dismissed
  useEffect(() => {
    if (!isLoading && hasUnsyncedMemos && !migrationDismissed && !isSyncing) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        setShowMigrationPrompt(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, hasUnsyncedMemos, migrationDismissed, isSyncing]);

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

  // Migration prompt handlers
  const handleSyncAll = useCallback(async () => {
    setShowMigrationPrompt(false);
    await syncAllPending();
  }, [syncAllPending]);

  const handleSyncLater = useCallback(() => {
    setShowMigrationPrompt(false);
  }, []);

  const handleKeepLocal = useCallback(async () => {
    setShowMigrationPrompt(false);
    setMigrationDismissed(true);
    await AsyncStorage.setItem(MIGRATION_DISMISSED_KEY, 'true');
  }, []);

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

  // Count unsynced memos for the prompt
  const unsyncedCount = memos.filter(
    (m) => m.syncStatus === 'local' || m.syncStatus === 'error'
  ).length;

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

      {/* Migration prompt */}
      <MigrationPrompt
        visible={showMigrationPrompt}
        unsyncedCount={unsyncedCount}
        onSyncAll={handleSyncAll}
        onSyncLater={handleSyncLater}
        onKeepLocal={handleKeepLocal}
      />
    </View>
  );
}
