import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoaded: boolean;
  position: number;
  duration: number;
  loadAudio: (uri: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  unload: () => Promise<void>;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsLoaded(false);
      return;
    }

    setIsLoaded(true);
    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis);
    setDuration(status.durationMillis ?? 0);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      soundRef.current?.setPositionAsync(0);
    }
  }, []);

  const loadAudio = useCallback(
    async (uri: string) => {
      try {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );

        soundRef.current = sound;
      } catch (error) {
        console.error('Failed to load audio:', error);
        throw error;
      }
    },
    [onPlaybackStatusUpdate]
  );

  const play = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;

    try {
      await soundRef.current.playAsync();
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }, [isLoaded]);

  const pause = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;

    try {
      await soundRef.current.pauseAsync();
    } catch (error) {
      console.error('Failed to pause audio:', error);
      throw error;
    }
  }, [isLoaded]);

  const seek = useCallback(
    async (positionMs: number) => {
      if (!soundRef.current || !isLoaded) return;

      try {
        await soundRef.current.setPositionAsync(positionMs);
      } catch (error) {
        console.error('Failed to seek audio:', error);
        throw error;
      }
    },
    [isLoaded]
  );

  const unload = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsLoaded(false);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    } catch (error) {
      console.error('Failed to unload audio:', error);
    }
  }, []);

  return {
    isPlaying,
    isLoaded,
    position,
    duration,
    loadAudio,
    play,
    pause,
    seek,
    unload,
  };
}
