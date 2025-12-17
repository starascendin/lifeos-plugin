import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  metering: number;
  startRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [metering, setMetering] = useState(-160);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const clearMeteringInterval = useCallback(() => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearMeteringInterval();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [clearMeteringInterval]);

  const startRecording = useCallback(async () => {
    try {
      // Clean up any existing recording first
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {
          // Ignore errors during cleanup
        }
        recordingRef.current = null;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording) {
            setDuration(status.durationMillis);
            if (status.metering !== undefined) {
              setMetering(status.metering);
            }
          }
        },
        100 // Update every 100ms
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    if (!recordingRef.current || !isRecording) return;

    try {
      await recordingRef.current.pauseAsync();
      setIsPaused(true);
      clearMeteringInterval();
    } catch (error) {
      console.error('Failed to pause recording:', error);
      throw error;
    }
  }, [isRecording, clearMeteringInterval]);

  const resumeRecording = useCallback(async () => {
    if (!recordingRef.current || !isPaused) return;

    try {
      await recordingRef.current.startAsync();
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to resume recording:', error);
      throw error;
    }
  }, [isPaused]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      clearMeteringInterval();

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
      });

      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setMetering(-160);

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      return null;
    }
  }, [clearMeteringInterval]);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      clearMeteringInterval();
      await recordingRef.current.stopAndUnloadAsync();

      const uri = recordingRef.current.getURI();
      if (uri) {
        // File will be auto-cleaned by system for temp files
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
      });

      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      setMetering(-160);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [clearMeteringInterval]);

  return {
    isRecording,
    isPaused,
    duration,
    metering,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}
