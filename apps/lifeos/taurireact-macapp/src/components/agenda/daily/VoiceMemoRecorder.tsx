import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Clock,
  FileText,
  Cloud,
  Loader2,
  Check,
} from "lucide-react";
import {
  saveMemo,
  getMemosForDate,
  deleteMemo as deleteStoredMemo,
  updateMemo,
  type StoredVoiceMemo,
} from "@/lib/storage/voiceMemoStorage";
import {
  transcribeAudio,
  getExtensionFromMimeType,
} from "@/lib/services/transcriptionService";
import { useApiKeys } from "@/lib/hooks/useApiKeys";

// Detect if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Format duration as MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Runtime memo with object URL for playback
interface RuntimeVoiceMemo extends StoredVoiceMemo {
  audioUrl: string; // Object URL created from blob for playback
}

// Voice memo item with playback
interface VoiceMemoItemProps {
  memo: RuntimeVoiceMemo;
  onDelete: () => void;
  onTranscribe: () => void;
  onSync: () => void;
  isTranscribing: boolean;
  isSyncing: boolean;
}

function VoiceMemoItem({
  memo,
  onDelete,
  onTranscribe,
  onSync,
  isTranscribing,
  isSyncing,
}: VoiceMemoItemProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const hasTranscript = Boolean(memo.transcript);
  const isSynced = Boolean(memo.syncedToConvex);

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <audio ref={audioRef} src={memo.audioUrl} preload="metadata" />

      <div className="flex items-start gap-3">
        {/* Play/Pause Button */}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        {/* Memo info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{memo.name}</span>
            <span className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono uppercase">
              {memo.extension || "webm"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(memo.createdAt)}
            </span>
            {isSynced && (
              <span className="text-xs text-green-500 flex items-center gap-0.5">
                <Check className="h-3 w-3" />
                synced
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${memo.duration > 0 ? (currentTime / memo.duration) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(isPlaying ? currentTime : memo.duration)}
            </span>
          </div>

          {/* Transcript */}
          {hasTranscript && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {memo.transcript}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Transcribe button */}
          {!hasTranscript && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onTranscribe}
              disabled={isTranscribing}
              title="Transcribe with GROQ"
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Sync button */}
          {!isSynced && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSync}
              disabled={isSyncing}
              title="Sync to Convex"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface VoiceMemoRecorderProps {
  date: string; // YYYY-MM-DD format
}

export function VoiceMemoRecorder({ date }: VoiceMemoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [memos, setMemos] = useState<RuntimeVoiceMemo[]>([]);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // API keys for GROQ
  const { groqApiKey, hasGroqApiKey } = useApiKeys();

  // Convex mutations for syncing
  const generateUploadUrl = useMutation(api.lifeos.voicememo.generateUploadUrl);
  const createConvexMemo = useMutation(api.lifeos.voicememo.createMemo);

  // Load memos from IndexedDB for the specific date
  const loadMemos = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedMemos = await getMemosForDate(date);
      // Create object URLs for playback
      const runtimeMemos: RuntimeVoiceMemo[] = storedMemos.map((memo) => ({
        ...memo,
        audioUrl: URL.createObjectURL(memo.audioBlob),
      }));
      setMemos(runtimeMemos);
    } catch (err) {
      console.error("Failed to load memos:", err);
      setError("Failed to load saved voice notes.");
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    // Revoke old URLs before loading new memos
    memos.forEach((memo) => URL.revokeObjectURL(memo.audioUrl));
    loadMemos();
  }, [loadMemos]);

  // Get supported MIME type for recording - prefer Opus for best compression
  const getSupportedMimeType = (): { mimeType: string; extension: string } => {
    // Priority order: Opus > AAC for speech compression efficiency
    // webm+opus typically 30-50% smaller than m4a at same quality
    const types: Array<{ mime: string; ext: string }> = [
      { mime: "audio/webm;codecs=opus", ext: "webm" },
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/mp4", ext: "m4a" }, // Fallback for Safari
    ];
    for (const { mime, ext } of types) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return { mimeType: mime, extension: ext };
      }
    }
    return { mimeType: "", extension: "webm" };
  };

  // Ref to store the current recording format info
  const recordingFormatRef = useRef<{ mimeType: string; extension: string }>({
    mimeType: "",
    extension: "webm",
  });

  // Start recording using Web API
  const startWebRecording = async () => {
    try {
      // Check/request macOS microphone permission in Tauri before getUserMedia
      if (isTauri) {
        try {
          const { checkMicrophonePermission, requestMicrophonePermission } =
            await import("tauri-plugin-macos-permissions-api");

          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              setError(
                "Microphone access denied. Please allow in System Preferences > Privacy & Security > Microphone."
              );
              return;
            }
          }
        } catch (pluginError) {
          console.warn("Could not check macOS permissions:", pluginError);
          // Continue anyway - the getUserMedia call will handle the error
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const format = getSupportedMimeType();
      recordingFormatRef.current = format;
      // Use 48kbps for speech - Opus handles this very well
      // This produces ~360KB per minute vs ~960KB at default bitrate
      const options: MediaRecorderOptions = {
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
        audioBitsPerSecond: 48000, // 48 kbps - excellent for speech
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data more frequently for smoother recording
      setIsRecording(true);
      setError(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to access microphone. Please check permissions.");
      console.error("Recording error:", err);
    }
  };

  // Stop recording and return the audio blob
  const stopWebRecording = async (): Promise<{
    blob: Blob;
    duration: number;
    mimeType: string;
    extension: string;
  } | null> => {
    if (!mediaRecorderRef.current) return null;

    const duration = recordingDuration;
    const mimeType = mediaRecorderRef.current.mimeType || recordingFormatRef.current.mimeType;
    const extension = recordingFormatRef.current.extension;

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        resolve({
          blob: audioBlob,
          duration,
          mimeType: mimeType || "audio/webm",
          extension: extension || "webm",
        });
      };

      mediaRecorder.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  };

  // Helper to check if a timestamp falls on the currently viewed date
  const isOnViewedDate = useCallback(
    (timestamp: number): boolean => {
      const [year, month, day] = date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
      return timestamp >= dayStart && timestamp <= dayEnd;
    },
    [date]
  );

  // Handle record button click
  const handleRecordClick = async () => {
    if (isRecording) {
      setIsSaving(true);
      try {
        const result = await stopWebRecording();
        if (result && result.duration > 0) {
          const { blob, duration, mimeType, extension } = result;
          const now = Date.now();

          const storedMemo: StoredVoiceMemo = {
            id: `voice_${now}`,
            name: `Voice Note ${new Date(now).toLocaleTimeString()}`,
            audioBlob: blob,
            mimeType,
            extension,
            duration,
            createdAt: now,
          };

          // Save to IndexedDB
          await saveMemo(storedMemo);

          // Only add to runtime state if the memo is for the currently viewed date
          if (isOnViewedDate(now)) {
            const runtimeMemo: RuntimeVoiceMemo = {
              ...storedMemo,
              audioUrl: URL.createObjectURL(blob),
            };
            setMemos((prev) => [runtimeMemo, ...prev]);
          }
        }
      } catch (err) {
        console.error("Failed to save memo:", err);
        setError("Failed to save voice note.");
      } finally {
        setIsSaving(false);
      }
    } else {
      setRecordingDuration(0);
      await startWebRecording();
    }
  };

  // Handle delete
  const handleDelete = async (memoId: string) => {
    try {
      // Revoke the object URL
      const memo = memos.find((m) => m.id === memoId);
      if (memo) {
        URL.revokeObjectURL(memo.audioUrl);
      }

      // Delete from IndexedDB
      await deleteStoredMemo(memoId);

      // Remove from state
      setMemos((prev) => prev.filter((m) => m.id !== memoId));
    } catch (err) {
      console.error("Failed to delete memo:", err);
      setError("Failed to delete voice note.");
    }
  };

  // Handle transcription
  const handleTranscribe = async (memoId: string) => {
    if (!hasGroqApiKey || !groqApiKey) {
      setError("GROQ API key not configured. Please set it in Settings > API Keys.");
      return;
    }

    const memo = memos.find((m) => m.id === memoId);
    if (!memo) return;

    setTranscribingId(memoId);
    setError(null);

    try {
      const filename = `audio.${getExtensionFromMimeType(memo.mimeType)}`;
      const result = await transcribeAudio(memo.audioBlob, groqApiKey, filename);

      // Update IndexedDB
      await updateMemo(memoId, {
        transcript: result.text,
        transcriptLanguage: result.language,
        transcribedAt: Date.now(),
      });

      // Update state
      setMemos((prev) =>
        prev.map((m) =>
          m.id === memoId
            ? {
                ...m,
                transcript: result.text,
                transcriptLanguage: result.language,
                transcribedAt: Date.now(),
              }
            : m
        )
      );
    } catch (err) {
      console.error("Transcription failed:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribingId(null);
    }
  };

  // Handle sync to Convex
  const handleSync = async (memoId: string) => {
    const memo = memos.find((m) => m.id === memoId);
    if (!memo) return;

    setSyncingId(memoId);
    setError(null);

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload the audio file with proper content type
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": memo.mimeType || "audio/webm",
        },
        body: memo.audioBlob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      const storageId = uploadResult.storageId;

      if (!storageId) {
        throw new Error("No storageId returned from upload");
      }

      // Create memo record in Convex
      const convexMemoId = await createConvexMemo({
        localId: memo.id,
        name: memo.name,
        storageId,
        duration: memo.duration,
        clientCreatedAt: memo.createdAt,
        clientUpdatedAt: Date.now(),
      });

      // Update IndexedDB
      await updateMemo(memoId, {
        syncedToConvex: true,
        convexMemoId: String(convexMemoId),
      });

      // Update state
      setMemos((prev) =>
        prev.map((m) =>
          m.id === memoId
            ? {
                ...m,
                syncedToConvex: true,
                convexMemoId: String(convexMemoId),
              }
            : m
        )
      );
    } catch (err) {
      console.error("Sync failed:", err);
      setError(err instanceof Error ? err.message : "Sync to Convex failed");
    } finally {
      setSyncingId(null);
    }
  };

  // Handle transcribe all (memos without transcripts)
  const [isTranscribingAll, setIsTranscribingAll] = useState(false);
  const handleTranscribeAll = async () => {
    if (!hasGroqApiKey || !groqApiKey) {
      setError("GROQ API key not configured. Please set it in Settings > API Keys.");
      return;
    }

    const memosToTranscribe = memos.filter((m) => !m.transcript);
    if (memosToTranscribe.length === 0) return;

    setIsTranscribingAll(true);
    setError(null);

    for (const memo of memosToTranscribe) {
      try {
        setTranscribingId(memo.id);
        const filename = `audio.${memo.extension || "webm"}`;
        const result = await transcribeAudio(memo.audioBlob, groqApiKey, filename);

        await updateMemo(memo.id, {
          transcript: result.text,
          transcriptLanguage: result.language,
          transcribedAt: Date.now(),
        });

        setMemos((prev) =>
          prev.map((m) =>
            m.id === memo.id
              ? {
                  ...m,
                  transcript: result.text,
                  transcriptLanguage: result.language,
                  transcribedAt: Date.now(),
                }
              : m
          )
        );
      } catch (err) {
        console.error(`Failed to transcribe ${memo.name}:`, err);
        // Continue with next memo
      }
    }

    setTranscribingId(null);
    setIsTranscribingAll(false);
  };

  // Handle sync all (memos not synced to Convex)
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const handleSyncAll = async () => {
    const memosToSync = memos.filter((m) => !m.syncedToConvex);
    if (memosToSync.length === 0) return;

    setIsSyncingAll(true);
    setError(null);

    for (const memo of memosToSync) {
      try {
        setSyncingId(memo.id);

        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": memo.mimeType || "audio/webm" },
          body: memo.audioBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const uploadResult = await uploadResponse.json();
        const storageId = uploadResult.storageId;

        if (!storageId) {
          throw new Error("No storageId returned");
        }

        const convexMemoId = await createConvexMemo({
          localId: memo.id,
          name: memo.name,
          storageId,
          duration: memo.duration,
          clientCreatedAt: memo.createdAt,
          clientUpdatedAt: Date.now(),
        });

        await updateMemo(memo.id, {
          syncedToConvex: true,
          convexMemoId: String(convexMemoId),
        });

        setMemos((prev) =>
          prev.map((m) =>
            m.id === memo.id
              ? { ...m, syncedToConvex: true, convexMemoId: String(convexMemoId) }
              : m
          )
        );
      } catch (err) {
        console.error(`Failed to sync ${memo.name}:`, err);
        // Continue with next memo
      }
    }

    setSyncingId(null);
    setIsSyncingAll(false);
  };

  // Count memos needing actions
  const memosNeedingTranscription = memos.filter((m) => !m.transcript).length;
  const memosNeedingSync = memos.filter((m) => !m.syncedToConvex).length;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      }
      // Revoke all object URLs
      memos.forEach((memo) => URL.revokeObjectURL(memo.audioUrl));
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="h-5 w-5" />
          Voice Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Record button */}
        <div className="flex items-center gap-4">
          <Button
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            onClick={handleRecordClick}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>Saving...</>
            ) : isRecording ? (
              <>
                <Square className="h-4 w-4" />
                Stop ({formatDuration(recordingDuration)})
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Record
              </>
            )}
          </Button>

          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Recording...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Bulk action buttons */}
        {memos.length > 0 && (memosNeedingTranscription > 0 || memosNeedingSync > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {memosNeedingTranscription > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTranscribeAll}
                disabled={isTranscribingAll || !hasGroqApiKey}
                className="gap-1.5"
              >
                {isTranscribingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Transcribe All ({memosNeedingTranscription})
              </Button>
            )}
            {memosNeedingSync > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                className="gap-1.5"
              >
                {isSyncingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Cloud className="h-3.5 w-3.5" />
                )}
                Sync All ({memosNeedingSync})
              </Button>
            )}
          </div>
        )}

        {/* Memos list */}
        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : memos.length > 0 ? (
            memos.map((memo) => (
              <VoiceMemoItem
                key={memo.id}
                memo={memo}
                onDelete={() => handleDelete(memo.id)}
                onTranscribe={() => handleTranscribe(memo.id)}
                onSync={() => handleSync(memo.id)}
                isTranscribing={transcribingId === memo.id}
                isSyncing={syncingId === memo.id}
              />
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No voice notes yet</p>
              <p className="text-xs mt-1">Record a quick note to get started</p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Voice notes are stored locally on this device.
        </p>
      </CardContent>
    </Card>
  );
}
