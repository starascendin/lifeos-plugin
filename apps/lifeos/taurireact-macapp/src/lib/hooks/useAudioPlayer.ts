import { useState, useRef, useEffect, useCallback } from "react";
import { usePlatform } from "./usePlatform";

export interface UseAudioPlayerOptions {
  /** Local file path for Tauri (exported memos) */
  localPath?: string | null;
  /** Audio blob for browser recordings */
  audioBlob?: Blob | null;
  /** Remote URL (e.g., from Convex storage) */
  remoteUrl?: string | null;
  /** MIME type for blob creation */
  mimeType?: string;
  /** Auto-play when audio source is first loaded */
  autoPlayOnLoad?: boolean;
}

export interface UseAudioPlayerReturn {
  /** Ref to attach to audio element */
  audioRef: React.RefObject<HTMLAudioElement>;
  /** Current audio source URL (blob URL or remote URL) */
  audioSrc: string | null;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether audio is currently loading */
  isLoading: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Start playback (loads if needed) */
  play: () => Promise<void>;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  toggle: () => Promise<void>;
  /** Seek to a specific time */
  seek: (time: number) => void;
  /** Whether audio can be played (has source) */
  canPlay: boolean;
}

/**
 * Unified hook for audio playback that handles:
 * - Tauri file loading (via readFile)
 * - Browser blob URL management
 * - Remote URL playback
 * - Play/pause/seek controls
 * - Cleanup on unmount
 */
export function useAudioPlayer(options: UseAudioPlayerOptions = {}): UseAudioPlayerReturn {
  const {
    localPath,
    audioBlob,
    remoteUrl,
    mimeType = "audio/mp4",
    autoPlayOnLoad = true,
  } = options;

  const { isTauri } = usePlatform();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Track if we created a blob URL that needs cleanup
  const createdBlobUrlRef = useRef<string | null>(null);

  // Create blob URL from audioBlob (browser recordings)
  useEffect(() => {
    if (audioBlob && !localPath) {
      const url = URL.createObjectURL(audioBlob);
      createdBlobUrlRef.current = url;
      setAudioSrc(url);

      return () => {
        URL.revokeObjectURL(url);
        createdBlobUrlRef.current = null;
      };
    }
  }, [audioBlob, localPath]);

  // Use remote URL directly if provided
  useEffect(() => {
    if (remoteUrl && !localPath && !audioBlob) {
      setAudioSrc(remoteUrl);
    }
  }, [remoteUrl, localPath, audioBlob]);

  // Load audio from Tauri file path
  const loadTauriAudio = useCallback(async () => {
    if (!localPath || !isTauri || audioSrc || isLoading) return;

    setIsLoading(true);
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const data = await readFile(localPath);
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      createdBlobUrlRef.current = url;
      setAudioSrc(url);
    } catch (error) {
      console.error("Failed to load audio from Tauri:", error);
    } finally {
      setIsLoading(false);
    }
  }, [localPath, isTauri, audioSrc, isLoading, mimeType]);

  // Cleanup blob URL on unmount or when source changes
  useEffect(() => {
    return () => {
      if (createdBlobUrlRef.current) {
        URL.revokeObjectURL(createdBlobUrlRef.current);
        createdBlobUrlRef.current = null;
      }
    };
  }, []);

  // Auto-play when audio source is first loaded
  useEffect(() => {
    if (audioSrc && audioRef.current && autoPlayOnLoad && !isPlaying) {
      // Only auto-play if it was triggered by loadTauriAudio (user clicked play)
      if (localPath && isTauri) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [audioSrc, autoPlayOnLoad, isPlaying, localPath, isTauri]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [audioSrc]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const play = useCallback(async () => {
    // For Tauri files, load first if not loaded
    if (localPath && isTauri && !audioSrc) {
      await loadTauriAudio();
      return; // Will auto-play after loading
    }

    if (audioRef.current) {
      await audioRef.current.play();
    }
  }, [localPath, isTauri, audioSrc, loadTauriAudio]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const toggle = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const canPlay = Boolean(audioSrc || (localPath && isTauri) || remoteUrl);

  return {
    audioRef,
    audioSrc,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    play,
    pause,
    toggle,
    seek,
    canPlay,
  };
}
