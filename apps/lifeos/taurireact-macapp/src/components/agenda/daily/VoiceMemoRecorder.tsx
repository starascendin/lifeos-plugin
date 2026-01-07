import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
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
  HardDrive,
  CloudOff,
  Smartphone,
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
import {
  getVoiceMemos,
  getMemoDisplayName,
  type VoiceMemo as ExportedVoiceMemo,
} from "@/lib/services/voicememos";

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

// Sync status types
type SyncStatus = "local" | "cloud" | "synced" | "exported";

// Runtime memo with object URL for playback
interface RuntimeVoiceMemo extends StoredVoiceMemo {
  audioUrl: string; // Object URL created from blob for playback, or empty for exported
  syncStatus: SyncStatus; // local-only, cloud-only, synced to both, or exported from macOS
  convexId?: string; // Convex document ID for cloud memos
  isExported?: boolean; // True if from macOS Voice Memos export
  exportedMemoId?: number; // ID in Tauri SQLite for exported memos
  exportedLocalPath?: string | null; // Local file path for exported memos (needs to be loaded via readFile)
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
  const [loadedAudioUrl, setLoadedAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get the audio URL - either pre-loaded or needs async loading for exported memos
  const audioUrl = memo.isExported ? loadedAudioUrl : memo.audioUrl;

  // Load audio for exported memos using Tauri fs plugin
  const loadExportedAudio = async () => {
    if (!memo.exportedLocalPath || loadedAudioUrl || isLoadingAudio || !isTauri) return;

    setIsLoadingAudio(true);
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const data = await readFile(memo.exportedLocalPath);
      const blob = new Blob([data], { type: "audio/mp4" });
      const url = URL.createObjectURL(blob);
      setLoadedAudioUrl(url);
    } catch (error) {
      console.error("Failed to load exported audio:", error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Cleanup loaded audio URL on unmount
  useEffect(() => {
    return () => {
      if (loadedAudioUrl) {
        URL.revokeObjectURL(loadedAudioUrl);
      }
    };
  }, [loadedAudioUrl]);

  const handlePlayPause = async () => {
    // For exported memos, load audio first if not loaded
    if (memo.isExported && !loadedAudioUrl) {
      await loadExportedAudio();
      return; // Will auto-play after loading via effect
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Auto-play when audio is first loaded for exported memos
  useEffect(() => {
    if (loadedAudioUrl && audioRef.current && memo.isExported) {
      audioRef.current.play();
    }
  }, [loadedAudioUrl, memo.isExported]);

  // Re-attach event listeners when audioUrl changes (important for exported memos loaded on demand)
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
  }, [audioUrl]); // Re-run when audioUrl changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const hasTranscript = Boolean(memo.transcript);

  // Render sync status badge
  const renderSyncBadge = () => {
    switch (memo.syncStatus) {
      case "local":
        return (
          <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            Local
          </span>
        );
      case "cloud":
        return (
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded flex items-center gap-1">
            <Cloud className="h-3 w-3" />
            Cloud
          </span>
        );
      case "synced":
        return (
          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded flex items-center gap-1">
            <Check className="h-3 w-3" />
            Synced
          </span>
        );
      case "exported":
        return (
          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            Voice Memo
          </span>
        );
    }
  };

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      {/* Audio element - always render, src may be empty for exported memos until loaded */}
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      <div className="flex items-start gap-3">
        {/* Play/Pause Button */}
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handlePlayPause}
          disabled={isLoadingAudio || (memo.isExported && !memo.exportedLocalPath)}
        >
          {isLoadingAudio ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
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
            {renderSyncBadge()}
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
          {/* Transcribe button - only for local/synced memos (not exported, not cloud-only) */}
          {!hasTranscript && !memo.isExported && memo.syncStatus !== "cloud" && (
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

          {/* Sync button - only show for local-only memos */}
          {memo.syncStatus === "local" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSync}
              disabled={isSyncing}
              title="Sync to Cloud"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Delete button - only for local/synced recorded memos (not exported, not cloud-only) */}
          {!memo.isExported && memo.syncStatus !== "cloud" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [isLoadingExported, setIsLoadingExported] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [memos, setMemos] = useState<RuntimeVoiceMemo[]>([]);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [localMemos, setLocalMemos] = useState<StoredVoiceMemo[]>([]);
  const [exportedMemos, setExportedMemos] = useState<ExportedVoiceMemo[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Track blob URLs to revoke only on unmount or when memos are removed
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  // API keys for GROQ
  const { groqApiKey, hasGroqApiKey } = useApiKeys();

  // Convex mutations for syncing
  const generateUploadUrl = useMutation(api.lifeos.voicememo.generateUploadUrl);
  const createConvexMemo = useMutation(api.lifeos.voicememo.createMemo);

  // Convex action for server-side transcription (uses GROQ_API_KEY from server)
  const transcribeMemoAction = useAction(api.lifeos.voicememo.transcribeMemo);

  // Fetch cloud memos from Convex
  const cloudMemos = useQuery(api.lifeos.voicememo.getMemosForDate, { date });

  // Load local memos from IndexedDB for the specific date
  const loadLocalMemos = useCallback(async () => {
    setIsLoadingLocal(true);
    try {
      const storedMemos = await getMemosForDate(date);
      setLocalMemos(storedMemos);
    } catch (err) {
      console.error("Failed to load local memos:", err);
      setError("Failed to load saved voice notes.");
    } finally {
      setIsLoadingLocal(false);
    }
  }, [date]);

  // Load exported macOS Voice Memos for the specific date (Tauri only)
  const loadExportedMemos = useCallback(async () => {
    if (!isTauri) {
      setIsLoadingExported(false);
      return;
    }

    setIsLoadingExported(true);
    try {
      const allExported = await getVoiceMemos();

      // Filter by date
      const [year, month, day] = date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();

      const filteredExported = allExported.filter(
        (memo) => memo.date >= dayStart && memo.date <= dayEnd
      );

      setExportedMemos(filteredExported);
    } catch (err) {
      console.error("Failed to load exported memos:", err);
      // Don't show error - exported memos are optional
    } finally {
      setIsLoadingExported(false);
    }
  }, [date]);

  // Load local and exported memos when date changes
  useEffect(() => {
    loadLocalMemos();
    loadExportedMemos();
  }, [loadLocalMemos, loadExportedMemos]);

  // Helper to get or create blob URL (reuses existing URLs to prevent revocation issues)
  const getOrCreateBlobUrl = useCallback((memoId: string, blob: Blob): string => {
    const existing = blobUrlsRef.current.get(memoId);
    if (existing) {
      return existing;
    }
    const newUrl = URL.createObjectURL(blob);
    blobUrlsRef.current.set(memoId, newUrl);
    return newUrl;
  }, []);

  // Merge local, cloud, and exported memos
  useEffect(() => {
    const mergedMemos: RuntimeVoiceMemo[] = [];
    const processedLocalIds = new Set<string>();
    const processedExportedUuids = new Set<string>();
    const currentMemoIds = new Set<string>();

    // Process local recorded memos first
    for (const localMemo of localMemos) {
      currentMemoIds.add(localMemo.id);

      // Check if this local memo exists in cloud
      const cloudMatch = cloudMemos?.find(
        (cm) => cm.localId === localMemo.id || cm._id === localMemo.convexMemoId
      );

      if (cloudMatch) {
        // Memo exists in both - mark as synced
        processedLocalIds.add(cloudMatch.localId);
        mergedMemos.push({
          ...localMemo,
          audioUrl: getOrCreateBlobUrl(localMemo.id, localMemo.audioBlob),
          syncStatus: "synced",
          convexId: cloudMatch._id,
          syncedToConvex: true,
          convexMemoId: cloudMatch._id,
          // Use cloud transcript if available (it may have server-side transcription)
          transcript: cloudMatch.transcript ?? localMemo.transcript,
          transcriptLanguage: cloudMatch.language ?? localMemo.transcriptLanguage,
        });
      } else {
        // Local only
        mergedMemos.push({
          ...localMemo,
          audioUrl: getOrCreateBlobUrl(localMemo.id, localMemo.audioBlob),
          syncStatus: "local",
        });
      }
    }

    // Add cloud-only memos (not in local storage)
    if (cloudMemos) {
      for (const cloudMemo of cloudMemos) {
        if (!processedLocalIds.has(cloudMemo.localId)) {
          // Check if we have this locally by convexMemoId
          const hasLocal = localMemos.some(
            (lm) => lm.id === cloudMemo.localId || lm.convexMemoId === cloudMemo._id
          );

          // Check if this is an exported memo that was synced to cloud
          const isExportedInCloud = exportedMemos.some(
            (em) => em.uuid === cloudMemo.localId
          );

          if (!hasLocal && !isExportedInCloud && cloudMemo.audioUrl) {
            // Cloud only - use streaming URL
            mergedMemos.push({
              id: cloudMemo.localId,
              name: cloudMemo.name,
              audioBlob: new Blob(), // Empty blob for cloud-only
              mimeType: "audio/webm",
              extension: "webm",
              duration: cloudMemo.duration / 1000, // Convert from ms to seconds
              createdAt: cloudMemo.clientCreatedAt,
              transcript: cloudMemo.transcript,
              transcriptLanguage: cloudMemo.language,
              audioUrl: cloudMemo.audioUrl,
              syncStatus: "cloud",
              convexId: cloudMemo._id,
              syncedToConvex: true,
              convexMemoId: cloudMemo._id,
            });
          }

          // Track exported memos that are in cloud
          if (isExportedInCloud) {
            processedExportedUuids.add(cloudMemo.localId);
          }
        }
      }
    }

    // Add exported macOS Voice Memos
    for (const exportedMemo of exportedMemos) {
      // Check if already processed (synced to cloud)
      const cloudMatch = cloudMemos?.find((cm) => cm.localId === exportedMemo.uuid);

      // Only include exported memos that have a local audio file
      if (exportedMemo.local_path) {
        mergedMemos.push({
          id: exportedMemo.uuid,
          name: getMemoDisplayName(exportedMemo),
          audioBlob: new Blob(), // No blob for exported memos
          mimeType: "audio/m4a",
          extension: "m4a",
          duration: exportedMemo.duration,
          createdAt: exportedMemo.date,
          transcript: exportedMemo.transcription ?? undefined,
          transcriptLanguage: exportedMemo.transcription_language ?? undefined,
          audioUrl: "", // Will be loaded on demand via readFile
          syncStatus: cloudMatch ? "synced" : "exported",
          isExported: true,
          exportedMemoId: exportedMemo.id,
          exportedLocalPath: exportedMemo.local_path,
          syncedToConvex: !!cloudMatch,
          convexMemoId: cloudMatch?._id,
        });
      }
    }

    // Sort by createdAt descending
    mergedMemos.sort((a, b) => b.createdAt - a.createdAt);

    // Clean up blob URLs for memos that are no longer in the list
    const urlsToRevoke: string[] = [];
    blobUrlsRef.current.forEach((url, id) => {
      if (!currentMemoIds.has(id)) {
        urlsToRevoke.push(id);
      }
    });
    for (const id of urlsToRevoke) {
      const url = blobUrlsRef.current.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(id);
      }
    }

    setMemos(mergedMemos);
  }, [localMemos, cloudMemos, exportedMemos, getOrCreateBlobUrl]);

  const isLoading = isLoadingLocal || isLoadingExported || cloudMemos === undefined;

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

  // Auto-sync a memo to cloud and trigger server-side transcription
  const autoSyncMemo = async (memo: StoredVoiceMemo) => {
    try {
      setSyncingId(memo.id);

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload the audio file
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
        throw new Error("No storageId returned from upload");
      }

      // Create memo record in Convex
      const convexMemoId = await createConvexMemo({
        localId: memo.id,
        name: memo.name,
        storageId,
        duration: memo.duration * 1000, // Convert to ms for Convex
        clientCreatedAt: memo.createdAt,
        clientUpdatedAt: Date.now(),
      });

      // Update IndexedDB with sync status
      await updateMemo(memo.id, {
        syncedToConvex: true,
        convexMemoId: String(convexMemoId),
      });

      // Update local memos state to trigger re-merge
      setLocalMemos((prev) =>
        prev.map((m) =>
          m.id === memo.id
            ? { ...m, syncedToConvex: true, convexMemoId: String(convexMemoId) }
            : m
        )
      );

      // Trigger server-side transcription with Groq (fire and forget)
      // The transcription result will be available via the cloudMemos query
      transcribeMemoAction({ memoId: convexMemoId })
        .then((result) => {
          if (result.success) {
            console.log("Auto-transcription completed:", result.transcript?.slice(0, 100));
          } else {
            console.warn("Auto-transcription failed:", result.error);
          }
        })
        .catch((err) => {
          console.warn("Auto-transcription error:", err);
        });
    } catch (err) {
      console.error("Auto-sync failed:", err);
      // Don't show error - auto-sync is best-effort
      // User can manually sync later if needed
    } finally {
      setSyncingId(null);
    }
  };

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

          // Update local memos state (will be merged with cloud memos)
          if (isOnViewedDate(now)) {
            setLocalMemos((prev) => [storedMemo, ...prev]);
          }

          // Auto-sync to cloud in the background
          autoSyncMemo(storedMemo);
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
      const memo = memos.find((m) => m.id === memoId);
      if (!memo) return;

      // Revoke the blob URL from our ref (only for local memos)
      if (memo.syncStatus !== "cloud") {
        const blobUrl = blobUrlsRef.current.get(memoId);
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrlsRef.current.delete(memoId);
        }
      }

      // Delete from IndexedDB (only if local)
      if (memo.syncStatus !== "cloud") {
        await deleteStoredMemo(memoId);
      }

      // Remove from local memos state
      setLocalMemos((prev) => prev.filter((m) => m.id !== memoId));
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
    if (!memo || memo.syncStatus === "cloud") return; // Can't transcribe cloud-only memos locally

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

      // Update local memos state
      setLocalMemos((prev) =>
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

  // Handle sync to Convex (manual sync button)
  const handleSync = async (memoId: string) => {
    const memo = memos.find((m) => m.id === memoId);
    if (!memo || memo.syncStatus !== "local") return;

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
        duration: memo.duration * 1000, // Convert to ms for Convex
        clientCreatedAt: memo.createdAt,
        clientUpdatedAt: Date.now(),
      });

      // Update IndexedDB
      await updateMemo(memoId, {
        syncedToConvex: true,
        convexMemoId: String(convexMemoId),
      });

      // Update local memos state
      setLocalMemos((prev) =>
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

      // Trigger server-side transcription with Groq (fire and forget)
      transcribeMemoAction({ memoId: convexMemoId })
        .then((result) => {
          if (result.success) {
            console.log("Transcription completed:", result.transcript?.slice(0, 100));
          } else {
            console.warn("Transcription failed:", result.error);
          }
        })
        .catch((err) => {
          console.warn("Transcription error:", err);
        });
    } catch (err) {
      console.error("Sync failed:", err);
      setError(err instanceof Error ? err.message : "Sync to Convex failed");
    } finally {
      setSyncingId(null);
    }
  };

  // Handle transcribe all (local memos without transcripts)
  const [isTranscribingAll, setIsTranscribingAll] = useState(false);
  const handleTranscribeAll = async () => {
    if (!hasGroqApiKey || !groqApiKey) {
      setError("GROQ API key not configured. Please set it in Settings > API Keys.");
      return;
    }

    // Only transcribe local memos (not cloud-only)
    const memosToTranscribe = memos.filter(
      (m) => !m.transcript && m.syncStatus !== "cloud"
    );
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

        setLocalMemos((prev) =>
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

  // Handle sync all (local-only memos)
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const handleSyncAll = async () => {
    const memosToSync = memos.filter((m) => m.syncStatus === "local");
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
          duration: memo.duration * 1000, // Convert to ms for Convex
          clientCreatedAt: memo.createdAt,
          clientUpdatedAt: Date.now(),
        });

        await updateMemo(memo.id, {
          syncedToConvex: true,
          convexMemoId: String(convexMemoId),
        });

        setLocalMemos((prev) =>
          prev.map((m) =>
            m.id === memo.id
              ? { ...m, syncedToConvex: true, convexMemoId: String(convexMemoId) }
              : m
          )
        );

        // Trigger server-side transcription (fire and forget)
        transcribeMemoAction({ memoId: convexMemoId }).catch((err) => {
          console.warn(`Auto-transcription failed for ${memo.name}:`, err);
        });
      } catch (err) {
        console.error(`Failed to sync ${memo.name}:`, err);
        // Continue with next memo
      }
    }

    setSyncingId(null);
    setIsSyncingAll(false);
  };

  // Count memos needing actions (only local memos)
  const memosNeedingTranscription = memos.filter(
    (m) => !m.transcript && m.syncStatus !== "cloud"
  ).length;
  const memosNeedingSync = memos.filter((m) => m.syncStatus === "local").length;

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
      // Revoke all blob URLs
      blobUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      blobUrlsRef.current.clear();
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
          Voice notes are automatically synced to the cloud.
        </p>
      </CardContent>
    </Card>
  );
}
