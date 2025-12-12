import { View, ViewStyle } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { useVoiceMemoStorage } from '@/hooks/useVoiceMemoStorage';
import { RecordingsList, RecordButton } from '@/components/voicememo';
import { useCallback } from 'react';

export default function VoiceMemoListScreen() {
  const router = useRouter();
  const backgroundColor = useColor('background');

  const { memos, isLoading, deleteMemo, updateMemo, refreshMemos } =
    useVoiceMemoStorage();

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
      />

      {/* Floating record button */}
      <View style={floatingButtonContainerStyle}>
        <RecordButton isRecording={false} onPress={handleRecordPress} />
      </View>
    </View>
  );
}
