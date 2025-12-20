import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  ViewStyle,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useColor } from '@/hooks/useColor';
import { useJournalStorage } from '@/hooks/useJournalStorage';
import { useAuth } from '@clerk/clerk-expo';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Video,
  FileText,
  X,
  Check,
  RotateCcw,
  ImageIcon,
  FlipHorizontal,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getTodayDate } from '@/utils/journal/storage';

type EntryMode = 'photo' | 'video' | 'note';
type CaptureState = 'preview' | 'captured' | 'recording';

export default function NewEntryScreen() {
  const { date: paramDate } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const cameraRef = useRef<CameraView>(null);

  const backgroundColor = useColor('background');
  const cardColor = useColor('card');
  const textColor = useColor('text');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const primaryForeground = useColor('primaryForeground');
  const blue = useColor('blue');
  const red = useColor('red');

  const [mode, setMode] = useState<EntryMode>('photo');
  const [captureState, setCaptureState] = useState<CaptureState>('preview');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  const { addTextEntry, addPhotoEntry, addVideoEntry } = useJournalStorage(
    userId || null
  );

  const date = paramDate || getTodayDate();

  useEffect(() => {
    if (mode === 'photo' || mode === 'video') {
      requestPermission();
    }
  }, [mode, requestPermission]);

  const handleModeChange = useCallback((newMode: EntryMode) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMode(newMode);
    setCaptureState('preview');
    setCapturedUri(null);
    setCaption('');
  }, []);

  const handleToggleFacing = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setCaptureState('captured');
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      setIsRecording(true);
      setCaptureState('recording');

      const video = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      if (video?.uri) {
        setCapturedUri(video.uri);
        setCaptureState('captured');
      }
    } catch (error) {
      console.error('Failed to record video:', error);
    } finally {
      setIsRecording(false);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    cameraRef.current?.stopRecording();
    setIsRecording(false);
  }, []);

  const handlePickFromLibrary = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'video' ? ['videos'] : ['images'],
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets?.[0]) {
      setCapturedUri(result.assets[0].uri);
      setCaptureState('captured');
    }
  }, [mode]);

  const handleRetake = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCapturedUri(null);
    setCaptureState('preview');
    setCaption('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId) return;

    setIsSaving(true);

    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (mode === 'note') {
        if (!noteContent.trim()) {
          setIsSaving(false);
          return;
        }
        await addTextEntry(noteContent.trim(), noteTitle.trim() || undefined, date);
      } else if (mode === 'photo' && capturedUri) {
        await addPhotoEntry(capturedUri, caption.trim() || undefined, date);
      } else if (mode === 'video' && capturedUri) {
        await addVideoEntry(capturedUri, undefined, caption.trim() || undefined, date);
      }

      router.back();
    } catch (error) {
      console.error('Failed to save entry:', error);
      setIsSaving(false);
    }
  }, [
    userId,
    mode,
    noteContent,
    noteTitle,
    capturedUri,
    caption,
    date,
    addTextEntry,
    addPhotoEntry,
    addVideoEntry,
    router,
  ]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const tabContainerStyle: ViewStyle = {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  };

  const tabStyle = (isActive: boolean): ViewStyle => ({
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: isActive ? primary : cardColor,
  });

  // Render camera view
  const renderCameraView = () => {
    if (!permission?.granted) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <Text variant="body" style={{ textAlign: 'center', marginBottom: 16 }}>
            Camera permission is required to take photos and videos.
          </Text>
          <Button onPress={requestPermission}>Grant Permission</Button>
        </View>
      );
    }

    if (captureState === 'captured' && capturedUri) {
      return (
        <View style={{ flex: 1 }}>
          <Image
            source={{ uri: capturedUri }}
            style={{ flex: 1 }}
            contentFit="cover"
          />

          {/* Retake button */}
          <Pressable
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleRetake}
          >
            <Icon name={RotateCcw} size={24} color="#FFFFFF" />
          </Pressable>

          {/* Caption input */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: 16,
            }}
          >
            <TextInput
              placeholder="Add a caption..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={caption}
              onChangeText={setCaption}
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                paddingVertical: 8,
              }}
              multiline
            />
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
          mode={mode === 'video' ? 'video' : 'picture'}
        />

        {/* Camera controls overlay */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 40,
            paddingTop: 20,
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
            }}
          >
            {/* Library picker */}
            <Pressable
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.3)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={handlePickFromLibrary}
            >
              <Icon name={ImageIcon} size={24} color="#FFFFFF" />
            </Pressable>

            {/* Capture button */}
            {mode === 'photo' ? (
              <Pressable
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#FFFFFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4,
                  borderColor: 'rgba(255,255,255,0.5)',
                }}
                onPress={handleTakePhoto}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </Pressable>
            ) : (
              <Pressable
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: isRecording ? red : '#FFFFFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 4,
                  borderColor: 'rgba(255,255,255,0.5)',
                }}
                onPress={isRecording ? handleStopRecording : handleStartRecording}
              >
                {isRecording ? (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: red,
                    }}
                  />
                )}
              </Pressable>
            )}

            {/* Flip camera */}
            <Pressable
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.3)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={handleToggleFacing}
            >
              <Icon name={FlipHorizontal} size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  // Render note editor
  const renderNoteEditor = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          placeholder="Title (optional)"
          placeholderTextColor={textMuted}
          value={noteTitle}
          onChangeText={setNoteTitle}
          style={{
            fontSize: 24,
            fontWeight: '600',
            color: textColor,
            marginBottom: 16,
            paddingVertical: 8,
          }}
        />
        <TextInput
          placeholder="Start writing..."
          placeholderTextColor={textMuted}
          value={noteContent}
          onChangeText={setNoteContent}
          style={{
            fontSize: 17,
            color: textColor,
            lineHeight: 24,
            minHeight: 200,
          }}
          multiline
          textAlignVertical="top"
          autoFocus
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const canSave =
    (mode === 'note' && noteContent.trim()) ||
    ((mode === 'photo' || mode === 'video') && capturedUri);

  return (
    <View style={containerStyle}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={handleCancel} hitSlop={8}>
          <Text variant="body" style={{ color: textMuted }}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!canSave || isSaving}
          hitSlop={8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={blue} />
          ) : (
            <Text
              variant="body"
              style={{
                color: canSave ? blue : textMuted,
                fontWeight: '600',
              }}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>

      {/* Mode tabs */}
      <View style={tabContainerStyle}>
        <Pressable
          style={tabStyle(mode === 'photo')}
          onPress={() => handleModeChange('photo')}
        >
          <Icon
            name={Camera}
            size={18}
            color={mode === 'photo' ? primaryForeground : textMuted}
          />
          <Text
            variant="body"
            style={{
              color: mode === 'photo' ? primaryForeground : textMuted,
              fontWeight: '500',
            }}
          >
            Photo
          </Text>
        </Pressable>
        <Pressable
          style={tabStyle(mode === 'video')}
          onPress={() => handleModeChange('video')}
        >
          <Icon
            name={Video}
            size={18}
            color={mode === 'video' ? primaryForeground : textMuted}
          />
          <Text
            variant="body"
            style={{
              color: mode === 'video' ? primaryForeground : textMuted,
              fontWeight: '500',
            }}
          >
            Video
          </Text>
        </Pressable>
        <Pressable
          style={tabStyle(mode === 'note')}
          onPress={() => handleModeChange('note')}
        >
          <Icon
            name={FileText}
            size={18}
            color={mode === 'note' ? primaryForeground : textMuted}
          />
          <Text
            variant="body"
            style={{
              color: mode === 'note' ? primaryForeground : textMuted,
              fontWeight: '500',
            }}
          >
            Note
          </Text>
        </Pressable>
      </View>

      {/* Content area */}
      {mode === 'note' ? renderNoteEditor() : renderCameraView()}
    </View>
  );
}
