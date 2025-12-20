import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';

export type MediaType = 'photo' | 'video';
export type CameraFacing = 'front' | 'back';

interface CapturedMedia {
  uri: string;
  type: MediaType;
  width?: number;
  height?: number;
  duration?: number; // For videos, in milliseconds
}

interface UseMediaCaptureReturn {
  // Permissions
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;

  // Camera state
  cameraRef: React.RefObject<CameraView | null>;
  facing: CameraFacing;
  isRecording: boolean;

  // Camera controls
  toggleFacing: () => void;
  takePhoto: () => Promise<CapturedMedia | null>;
  startVideoRecording: () => Promise<void>;
  stopVideoRecording: () => Promise<CapturedMedia | null>;

  // Image picker (for selecting from library)
  pickImage: () => Promise<CapturedMedia | null>;
  pickVideo: () => Promise<CapturedMedia | null>;
}

export function useMediaCapture(): UseMediaCaptureReturn {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const cameraStatus = await Camera.requestCameraPermissionsAsync();
    const micStatus = await Camera.requestMicrophonePermissionsAsync();
    const mediaLibraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();

    const granted =
      cameraStatus.status === 'granted' &&
      micStatus.status === 'granted' &&
      mediaLibraryStatus.status === 'granted';

    setHasPermission(granted);
    return granted;
  }, []);

  const toggleFacing = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const takePhoto = useCallback(async (): Promise<CapturedMedia | null> => {
    if (!cameraRef.current) return null;

    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (!photo) return null;

      return {
        uri: photo.uri,
        type: 'photo',
        width: photo.width,
        height: photo.height,
      };
    } catch (error) {
      console.error('Failed to take photo:', error);
      return null;
    }
  }, []);

  const startVideoRecording = useCallback(async (): Promise<void> => {
    if (!cameraRef.current || isRecording) return;

    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      setIsRecording(true);
      await cameraRef.current.recordAsync({
        maxDuration: 60, // 60 seconds max
      });
    } catch (error) {
      console.error('Failed to start video recording:', error);
      setIsRecording(false);
    }
  }, [isRecording]);

  const stopVideoRecording = useCallback(async (): Promise<CapturedMedia | null> => {
    if (!cameraRef.current || !isRecording) return null;

    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      cameraRef.current.stopRecording();
      setIsRecording(false);

      // Note: The video URI is returned from recordAsync when it resolves
      // This is handled differently in the actual camera component
      return null;
    } catch (error) {
      console.error('Failed to stop video recording:', error);
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  const pickImage = useCallback(async (): Promise<CapturedMedia | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'photo',
        width: asset.width,
        height: asset.height,
      };
    } catch (error) {
      console.error('Failed to pick image:', error);
      return null;
    }
  }, []);

  const pickVideo = useCallback(async (): Promise<CapturedMedia | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: 'video',
        width: asset.width,
        height: asset.height,
        duration: asset.duration ? asset.duration * 1000 : undefined,
      };
    } catch (error) {
      console.error('Failed to pick video:', error);
      return null;
    }
  }, []);

  return {
    hasPermission,
    requestPermission,
    cameraRef,
    facing,
    isRecording,
    toggleFacing,
    takePhoto,
    startVideoRecording,
    stopVideoRecording,
    pickImage,
    pickVideo,
  };
}
