import { useState, useCallback, useRef, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useAction } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useTTSSettings } from '@/contexts/TTSSettingsContext';
import { useAILog } from '@/contexts/AILogContext';

export type TTSProviderUsed = 'ondevice' | 'gemini' | null;

export interface UseSpanishTTSReturn {
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  isPlaying: boolean;
  error: string | null;
  /** Which provider actually handled the last audio playback */
  providerUsed: TTSProviderUsed;
  /** True if Gemini was selected but fell back to on-device */
  didFallback: boolean;
  /** Clear the fallback notice */
  clearFallback: () => void;
}

/**
 * Creates a WAV header for PCM audio data
 * Gemini returns raw PCM (24kHz, mono, 16-bit), needs WAV header for expo-av
 */
function createWavHeader(
  dataSize: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  view.setUint8(0, 0x52); // R
  view.setUint8(1, 0x49); // I
  view.setUint8(2, 0x46); // F
  view.setUint8(3, 0x46); // F
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  view.setUint8(8, 0x57);  // W
  view.setUint8(9, 0x41);  // A
  view.setUint8(10, 0x56); // V
  view.setUint8(11, 0x45); // E

  // "fmt " sub-chunk
  view.setUint8(12, 0x66); // f
  view.setUint8(13, 0x6d); // m
  view.setUint8(14, 0x74); // t
  view.setUint8(15, 0x20); // space
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  view.setUint8(36, 0x64); // d
  view.setUint8(37, 0x61); // a
  view.setUint8(38, 0x74); // t
  view.setUint8(39, 0x61); // a
  view.setUint32(40, dataSize, true);

  return new Uint8Array(buffer);
}

/**
 * Converts base64 PCM to base64 WAV
 */
function pcmToWav(pcmBase64: string, sampleRate: number, channels: number): string {
  // Decode base64 to binary
  const binaryString = atob(pcmBase64);
  const pcmData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmData[i] = binaryString.charCodeAt(i);
  }

  // Create WAV header
  const wavHeader = createWavHeader(pcmData.length, sampleRate, channels, 16);

  // Concatenate header + PCM data
  const wavData = new Uint8Array(wavHeader.length + pcmData.length);
  wavData.set(wavHeader, 0);
  wavData.set(pcmData, wavHeader.length);

  // Encode back to base64
  let binary = '';
  for (let i = 0; i < wavData.length; i++) {
    binary += String.fromCharCode(wavData[i]);
  }
  return btoa(binary);
}

export function useSpanishTTS(): UseSpanishTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<TTSProviderUsed>(null);
  const [didFallback, setDidFallback] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const { settings, isGeminiTTS } = useTTSSettings();
  const { addLog } = useAILog();

  const clearFallback = useCallback(() => {
    setDidFallback(false);
  }, []);

  const generateTTS = useAction(api.common.tts.generateTTS);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Initialize audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }, []);

  /**
   * Speak using on-device TTS (expo-speech)
   */
  const speakOnDevice = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        language: 'es-ES',
        rate: settings.speed,
        onDone: () => {
          setIsPlaying(false);
          resolve();
        },
        onError: (err) => {
          setIsPlaying(false);
          reject(err);
        },
      });
    });
  }, [settings.speed]);

  /**
   * Speak using Gemini cloud TTS
   * Returns true if Gemini was used successfully, false if fell back to on-device
   */
  const speakWithGemini = useCallback(async (text: string): Promise<boolean> => {
    try {
      // Call Convex action to get audio
      const result = await generateTTS({ text });

      // Convert PCM to WAV
      const wavBase64 = pcmToWav(result.audioBase64, result.sampleRate, result.channels);

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${wavBase64}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setProviderUsed('gemini');

      // Wait for playback to complete
      return new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            sound.unloadAsync();
            soundRef.current = null;
            resolve(true); // Gemini succeeded
          }
        });
      });
    } catch (err) {
      console.error('Gemini TTS error, falling back to on-device:', err);
      // Set fallback notice so UI can show it
      setDidFallback(true);
      setProviderUsed('ondevice');
      // Fallback to on-device TTS
      await speakOnDevice(text);
      return false; // Fell back to on-device
    }
  }, [generateTTS, speakOnDevice]);

  /**
   * Main speak function - chooses provider based on settings
   */
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    // Stop any current playback
    await stop();

    setIsPlaying(true);
    setError(null);
    setDidFallback(false);
    setProviderUsed(null);

    const inputPreview = text.slice(0, 50) + (text.length > 50 ? '...' : '');

    try {
      if (isGeminiTTS) {
        const usedGemini = await speakWithGemini(text);
        // Log TTS usage - provider depends on whether fallback occurred
        addLog({
          type: 'tts',
          provider: usedGemini ? 'gemini' : 'ondevice',
          success: true,
          inputPreview,
        });
      } else {
        setProviderUsed('ondevice');
        await speakOnDevice(text);
        // Log on-device TTS
        addLog({
          type: 'tts',
          provider: 'ondevice',
          success: true,
          inputPreview,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown TTS error';
      setError(errorMessage);
      setIsPlaying(false);
      console.error('TTS error:', err);
      // Log TTS error
      addLog({
        type: 'tts',
        provider: isGeminiTTS ? 'gemini' : 'ondevice',
        success: false,
        error: errorMessage,
        inputPreview,
      });
    }
  }, [isGeminiTTS, speakOnDevice, speakWithGemini, addLog]);

  /**
   * Stop current playback
   */
  const stop = useCallback(async (): Promise<void> => {
    // Stop expo-speech
    Speech.stop();

    // Stop expo-av sound
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  return {
    speak,
    stop,
    isPlaying,
    error,
    providerUsed,
    didFallback,
    clearFallback,
  };
}
