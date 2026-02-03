import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useAction, useConvex } from "convex/react";
import { api } from "@holaai/convex";
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
  transcribeVoiceMemo as transcribeExportedMemo,
  syncTranscriptsToConvex,
  type VoiceMemo as ExportedVoiceMemo,
  type ConvexSyncProgress,
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

type SyncStatus = "local" | "cloud" | "synced" | "exported" | "transcript";

interface RuntimeVoiceMemo extends StoredVoiceMemo {
  audioUrl: string;
  syncStatus: SyncStatus;
  convexId?: string;
  isExported?: boolean;
  exportedMemoId?: number;
  exportedLocalPath?: string | null;
}

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

  const audioUrl = memo.isExported ? loadedAudioUrl : memo.audioUrl;

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

  useEffect(() => {
    return () => {
      if (loadedAudioUrl) {
        URL.revokeObjectURL(loadedAudioUrl);
      }
    };
  }, [loadedAudioUrl]);

  const handlePlayPause = async () => {
    if (memo.isExported && !loadedAudioUrl) {
      await loadExportedAudio();
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (loadedAudioUrl && audioRef.current && memo.isExported) {
      audioRef.current.play();
    }
  }, [loadedAudioUrl, memo.isExported]);

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
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const hasTranscript = Boolean(memo.transcript);

  const renderSyncBadge = () => {
    switch (memo.syncStatus) {
      case "local":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded flex items-center gap-0.5">
            <HardDrive className="h-2.5 w-2.5" />
            Local
          </span>
        );
      case "cloud":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded flex items-center gap-0.5">
            <Cloud className="h-2.5 w-2.5" />
            Cloud
          </span>
        );
      case "synced":
        if (memo.isExported) {
          return (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded flex items-center gap-0.5">
              <Smartphone className="h-2.5 w-2.5" />
              <Check className="h-2.5 w-2.5" />
            </span>
          );
        }
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded flex items-center gap-0.5">
            <Check className="h-2.5 w-2.5" />
            Synced
          </span>
        );
      case "exported":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded flex items-center gap-0.5">
            <Smartphone className="h-2.5 w-2.5" />
          </span>
        );
      case "transcript":
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded flex items-center gap-0.5">
            <FileText className="h-2.5 w-2.5" />
          </span>
        );
    }
  };

  return (
    <div className="py-2 px-1 rounded-md hover:bg-muted/30 transition-colors">
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      <div className="flex items-start gap-2.5">
        {/* Play/Pause */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handlePlayPause}
          disabled={
            isLoadingAudio ||
            (memo.isExported && !memo.exportedLocalPath) ||
            memo.syncStatus === "transcript"
          }
          title={memo.syncStatus === "transcript" ? "No audio (transcript only)" : undefined}
        >
          {isLoadingAudio ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 ml-0.5" />
          )}
        </Button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium truncate">{memo.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(memo.createdAt)}
            </span>
            {renderSyncBadge()}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${memo.duration > 0 ? (currentTime / memo.duration) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatDuration(isPlaying ? currentTime : memo.duration)}
            </span>
          </div>

          {/* Transcript */}
          {hasTranscript && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {memo.transcript}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {!hasTranscript && !memo.isExported && memo.syncStatus !== "cloud" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onTranscribe}
              disabled={isTranscribing}
              title="Transcribe"
            >
              {isTranscribing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {memo.syncStatus === "local" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSync}
              disabled={isSyncing}
              title="Sync to Cloud"
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cloud className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          {!memo.isExported && memo.syncStatus !== "cloud" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface VoiceMemoRecorderProps {
  date: string;
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
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const { groqApiKey, hasGroqApiKey } = useApiKeys();
  const convexGroqApiKey = useQuery(api.lifeos.voicememo.getGroqApiKey, {});
  const convexClient = useConvex();

  const generateUploadUrl = useMutation(api.lifeos.voicememo.generateUploadUrl);
  const createConvexMemo = useMutation(api.lifeos.voicememo.createMemo);
  const transcribeMemoAction = useAction(api.lifeos.voicememo.transcribeMemo);
  const cloudMemos = useQuery(api.lifeos.voicememo.getMemosForDate, { date });

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

  const loadExportedMemos = useCallback(async () => {
    if (!isTauri) {
      setIsLoadingExported(false);
      return;
    }

    setIsLoadingExported(true);
    try {
      const allExported = await getVoiceMemos();
      const [year, month, day] = date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();

      const filteredExported = allExported.filter(
        (memo) => memo.date >= dayStart && memo.date <= dayEnd
      );

      setExportedMemos(filteredExported);
    } catch (err) {
      console.error("Failed to load exported memos:", err);
    } finally {
      setIsLoadingExported(false);
    }
  }, [date]);

  useEffect(() => {
    loadLocalMemos();
    loadExportedMemos();
  }, [loadLocalMemos, loadExportedMemos]);

  const getOrCreateBlobUrl = useCallback((memoId: string, blob: Blob): string => {
    const existing = blobUrlsRef.current.get(memoId);
    if (existing) return existing;
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

    for (const localMemo of localMemos) {
      currentMemoIds.add(localMemo.id);
      const cloudMatch = cloudMemos?.find(
        (cm) => cm.localId === localMemo.id || cm._id === localMemo.convexMemoId
      );

      if (cloudMatch) {
        processedLocalIds.add(cloudMatch.localId);
        mergedMemos.push({
          ...localMemo,
          audioUrl: getOrCreateBlobUrl(localMemo.id, localMemo.audioBlob),
          syncStatus: "synced",
          convexId: cloudMatch._id,
          syncedToConvex: true,
          convexMemoId: cloudMatch._id,
          transcript: cloudMatch.transcript ?? localMemo.transcript,
          transcriptLanguage: cloudMatch.language ?? localMemo.transcriptLanguage,
        });
      } else {
        mergedMemos.push({
          ...localMemo,
          audioUrl: getOrCreateBlobUrl(localMemo.id, localMemo.audioBlob),
          syncStatus: "local",
        });
      }
    }

    if (cloudMemos) {
      for (const cloudMemo of cloudMemos) {
        if (!processedLocalIds.has(cloudMemo.localId)) {
          const hasLocal = localMemos.some(
            (lm) => lm.id === cloudMemo.localId || lm.convexMemoId === cloudMemo._id
          );
          const isExportedInCloud = exportedMemos.some(
            (em) => em.uuid === cloudMemo.localId
          );
          if (isExportedInCloud) {
            processedExportedUuids.add(cloudMemo.localId);
          }
          if (hasLocal || isExportedInCloud) continue;

          const isTranscriptOnly = !cloudMemo.audioUrl;
          mergedMemos.push({
            id: cloudMemo.localId,
            name: cloudMemo.name,
            audioBlob: new Blob(),
            mimeType: isTranscriptOnly ? "audio/m4a" : "audio/webm",
            extension: isTranscriptOnly ? "m4a" : "webm",
            duration: cloudMemo.duration / 1000,
            createdAt: cloudMemo.clientCreatedAt,
            transcript: cloudMemo.transcript,
            transcriptLanguage: cloudMemo.language,
            audioUrl: cloudMemo.audioUrl || "",
            syncStatus: isTranscriptOnly ? "transcript" : "cloud",
            convexId: cloudMemo._id,
            syncedToConvex: true,
            convexMemoId: cloudMemo._id,
          });
        }
      }
    }

    for (const exportedMemo of exportedMemos) {
      const cloudMatch = cloudMemos?.find((cm) => cm.localId === exportedMemo.uuid);
      if (exportedMemo.local_path) {
        mergedMemos.push({
          id: exportedMemo.uuid,
          name: getMemoDisplayName(exportedMemo),
          audioBlob: new Blob(),
          mimeType: "audio/m4a",
          extension: "m4a",
          duration: exportedMemo.duration,
          createdAt: exportedMemo.date,
          transcript: exportedMemo.transcription ?? undefined,
          transcriptLanguage: exportedMemo.transcription_language ?? undefined,
          audioUrl: "",
          syncStatus: cloudMatch ? "synced" : "exported",
          isExported: true,
          exportedMemoId: exportedMemo.id,
          exportedLocalPath: exportedMemo.local_path,
          syncedToConvex: !!cloudMatch,
          convexMemoId: cloudMatch?._id,
        });
      }
    }

    mergedMemos.sort((a, b) => b.createdAt - a.createdAt);

    const urlsToRevoke: string[] = [];
    blobUrlsRef.current.forEach((url, id) => {
      if (!currentMemoIds.has(id)) urlsToRevoke.push(id);
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

  const getSupportedMimeType = (): { mimeType: string; extension: string } => {
    const types: Array<{ mime: string; ext: string }> = [
      { mime: "audio/webm;codecs=opus", ext: "webm" },
      { mime: "audio/ogg;codecs=opus", ext: "ogg" },
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/mp4", ext: "m4a" },
    ];
    for (const { mime, ext } of types) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return { mimeType: mime, extension: ext };
      }
    }
    return { mimeType: "", extension: "webm" };
  };

  const recordingFormatRef = useRef<{ mimeType: string; extension: string }>({
    mimeType: "",
    extension: "webm",
  });

  const startWebRecording = async () => {
    try {
      if (isTauri) {
        try {
          const { checkMicrophonePermission, requestMicrophonePermission } =
            await import("tauri-plugin-macos-permissions-api");
          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              setError("Microphone access denied.");
              return;
            }
          }
        } catch (pluginError) {
          console.warn("Could not check macOS permissions:", pluginError);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const format = getSupportedMimeType();
      recordingFormatRef.current = format;
      const options: MediaRecorderOptions = {
        ...(format.mimeType ? { mimeType: format.mimeType } : {}),
        audioBitsPerSecond: 48000,
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setError(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Failed to access microphone.");
      console.error("Recording error:", err);
    }
  };

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
        resolve({ blob: audioBlob, duration, mimeType: mimeType || "audio/webm", extension: extension || "webm" });
      };
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  };

  const isOnViewedDate = useCallback(
    (timestamp: number): boolean => {
      const [year, month, day] = date.split("-").map(Number);
      const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
      return timestamp >= dayStart && timestamp <= dayEnd;
    },
    [date]
  );

  const autoSyncMemo = async (memo: StoredVoiceMemo) => {
    try {
      setSyncingId(memo.id);
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": memo.mimeType || "audio/webm" },
        body: memo.audioBlob,
      });

      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);

      const uploadResult = await uploadResponse.json();
      const storageId = uploadResult.storageId;
      if (!storageId) throw new Error("No storageId returned from upload");

      const convexMemoId = await createConvexMemo({
        localId: memo.id,
        name: memo.name,
        storageId,
        duration: memo.duration * 1000,
        clientCreatedAt: memo.createdAt,
        clientUpdatedAt: Date.now(),
      });

      await updateMemo(memo.id, { syncedToConvex: true, convexMemoId: String(convexMemoId) });

      setLocalMemos((prev) =>
        prev.map((m) =>
          m.id === memo.id ? { ...m, syncedToConvex: true, convexMemoId: String(convexMemoId) } : m
        )
      );

      transcribeMemoAction({ memoId: convexMemoId })
        .then((result) => {
          if (result.success) console.log("Auto-transcription completed:", result.transcript?.slice(0, 100));
          else console.warn("Auto-transcription failed:", result.error);
        })
        .catch((err) => console.warn("Auto-transcription error:", err));
    } catch (err) {
      console.error("Auto-sync failed:", err);
    } finally {
      setSyncingId(null);
    }
  };

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
          await saveMemo(storedMemo);
          if (isOnViewedDate(now)) setLocalMemos((prev) => [storedMemo, ...prev]);
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

  const handleDelete = async (memoId: string) => {
    try {
      const memo = memos.find((m) => m.id === memoId);
      if (!memo) return;
      if (memo.syncStatus !== "cloud") {
        const blobUrl = blobUrlsRef.current.get(memoId);
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrlsRef.current.delete(memoId);
        }
        await deleteStoredMemo(memoId);
      }
      setLocalMemos((prev) => prev.filter((m) => m.id !== memoId));
    } catch (err) {
      console.error("Failed to delete memo:", err);
      setError("Failed to delete voice note.");
    }
  };

  const handleTranscribe = async (memoId: string) => {
    const memo = memos.find((m) => m.id === memoId);
    if (!memo || memo.syncStatus === "cloud") return;

    setTranscribingId(memoId);
    setError(null);

    try {
      if (memo.isExported && memo.exportedMemoId) {
        if (!convexGroqApiKey) throw new Error("GROQ API key not configured.");
        const result = await transcribeExportedMemo(memo.exportedMemoId, convexGroqApiKey);
        if (!result.success) throw new Error(result.error || "Transcription failed");
        await loadExportedMemos();
      } else {
        if (!hasGroqApiKey || !groqApiKey) {
          setError("GROQ API key not configured.");
          return;
        }
        const filename = `audio.${getExtensionFromMimeType(memo.mimeType)}`;
        const result = await transcribeAudio(memo.audioBlob, groqApiKey, filename);
        await updateMemo(memoId, { transcript: result.text, transcriptLanguage: result.language, transcribedAt: Date.now() });
        setLocalMemos((prev) =>
          prev.map((m) =>
            m.id === memoId ? { ...m, transcript: result.text, transcriptLanguage: result.language, transcribedAt: Date.now() } : m
          )
        );
      }
    } catch (err) {
      console.error("Transcription failed:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribingId(null);
    }
  };

  const handleSync = async (memoId: string) => {
    const memo = memos.find((m) => m.id === memoId);
    if (!memo || memo.syncStatus !== "local") return;

    setSyncingId(memoId);
    setError(null);

    try {
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": memo.mimeType || "audio/webm" },
        body: memo.audioBlob,
      });

      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);

      const uploadResult = await uploadResponse.json();
      const storageId = uploadResult.storageId;
      if (!storageId) throw new Error("No storageId returned");

      const convexMemoId = await createConvexMemo({
        localId: memo.id,
        name: memo.name,
        storageId,
        duration: memo.duration * 1000,
        clientCreatedAt: memo.createdAt,
        clientUpdatedAt: Date.now(),
      });

      await updateMemo(memoId, { syncedToConvex: true, convexMemoId: String(convexMemoId) });
      setLocalMemos((prev) =>
        prev.map((m) =>
          m.id === memoId ? { ...m, syncedToConvex: true, convexMemoId: String(convexMemoId) } : m
        )
      );

      transcribeMemoAction({ memoId: convexMemoId }).catch((err) =>
        console.warn(`Auto-transcription failed for ${memo.name}:`, err)
      );
    } catch (err) {
      console.error("Sync failed:", err);
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  // Bulk actions state
  const [isTranscribingAll, setIsTranscribingAll] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [cloudSyncProgress, setCloudSyncProgress] = useState<ConvexSyncProgress | null>(null);

  const handleTranscribeAll = async () => {
    const memosToTranscribe = memos.filter((m) => !m.transcript && m.syncStatus !== "cloud");
    if (memosToTranscribe.length === 0) return;

    const exportedMemos = memosToTranscribe.filter((m) => m.isExported && m.exportedMemoId);
    const localRecordedMemos = memosToTranscribe.filter((m) => !m.isExported);

    if (localRecordedMemos.length > 0 && (!hasGroqApiKey || !groqApiKey)) {
      setError("GROQ API key not configured.");
      if (exportedMemos.length === 0) return;
    }

    const total = memosToTranscribe.length;
    let current = 0;

    setIsTranscribingAll(true);
    setTranscribeProgress({ current: 0, total });
    setError(null);

    for (const memo of exportedMemos) {
      try {
        current++;
        setTranscribeProgress({ current, total });
        setTranscribingId(memo.id);
        if (!convexGroqApiKey) { console.error(`Failed: GROQ key missing`); continue; }
        const result = await transcribeExportedMemo(memo.exportedMemoId!, convexGroqApiKey);
        if (!result.success) console.error(`Failed to transcribe ${memo.name}:`, result.error);
      } catch (err) {
        console.error(`Failed to transcribe ${memo.name}:`, err);
      }
    }

    if (exportedMemos.length > 0) await loadExportedMemos();

    if (hasGroqApiKey && groqApiKey) {
      for (const memo of localRecordedMemos) {
        try {
          current++;
          setTranscribeProgress({ current, total });
          setTranscribingId(memo.id);
          const filename = `audio.${memo.extension || "webm"}`;
          const result = await transcribeAudio(memo.audioBlob, groqApiKey, filename);
          await updateMemo(memo.id, { transcript: result.text, transcriptLanguage: result.language, transcribedAt: Date.now() });
          setLocalMemos((prev) =>
            prev.map((m) =>
              m.id === memo.id ? { ...m, transcript: result.text, transcriptLanguage: result.language, transcribedAt: Date.now() } : m
            )
          );
        } catch (err) {
          console.error(`Failed to transcribe ${memo.name}:`, err);
        }
      }
    }

    setTranscribingId(null);
    setTranscribeProgress(null);
    setIsTranscribingAll(false);
  };

  const handleSyncAll = async () => {
    const memosToSync = memos.filter((m) => m.syncStatus === "local");
    if (memosToSync.length === 0) return;

    const total = memosToSync.length;
    let current = 0;

    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total });
    setError(null);

    for (const memo of memosToSync) {
      try {
        current++;
        setSyncProgress({ current, total });
        setSyncingId(memo.id);

        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": memo.mimeType || "audio/webm" },
          body: memo.audioBlob,
        });
        if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);

        const uploadResult = await uploadResponse.json();
        const storageId = uploadResult.storageId;
        if (!storageId) throw new Error("No storageId returned");

        const convexMemoId = await createConvexMemo({
          localId: memo.id,
          name: memo.name,
          storageId,
          duration: memo.duration * 1000,
          clientCreatedAt: memo.createdAt,
          clientUpdatedAt: Date.now(),
        });

        await updateMemo(memo.id, { syncedToConvex: true, convexMemoId: String(convexMemoId) });
        setLocalMemos((prev) =>
          prev.map((m) =>
            m.id === memo.id ? { ...m, syncedToConvex: true, convexMemoId: String(convexMemoId) } : m
          )
        );

        transcribeMemoAction({ memoId: convexMemoId }).catch((err) =>
          console.warn(`Auto-transcription failed for ${memo.name}:`, err)
        );
      } catch (err) {
        console.error(`Failed to sync ${memo.name}:`, err);
      }
    }

    setSyncingId(null);
    setSyncProgress(null);
    setIsSyncingAll(false);
  };

  const handleSyncTranscriptsToCloud = async () => {
    if (!isTauri) { setError("Cloud sync is only available in the Tauri app"); return; }
    setIsSyncingToCloud(true);
    setError(null);
    try {
      const result = await syncTranscriptsToConvex(convexClient, (progress) => {
        setCloudSyncProgress(progress);
      });
      if (result.error) setError(result.error);
      else await loadExportedMemos();
    } catch (err) {
      console.error("Cloud sync failed:", err);
      setError(err instanceof Error ? err.message : "Cloud sync failed");
    } finally {
      setIsSyncingToCloud(false);
      setCloudSyncProgress(null);
    }
  };

  const memosNeedingTranscription = memos.filter((m) => !m.transcript && m.syncStatus !== "cloud").length;
  const memosNeedingSync = memos.filter((m) => m.syncStatus === "local").length;
  const memosNeedingCloudSync = memos.filter((m) => m.isExported && m.transcript && m.syncStatus === "exported").length;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <Mic className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Voice Notes</h3>
        {memos.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({memos.length})
          </span>
        )}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Button
          variant={isRecording ? "destructive" : "default"}
          size="sm"
          onClick={handleRecordClick}
          disabled={isSaving}
          className="h-7 gap-1.5 text-xs"
        >
          {isSaving ? (
            <>Saving...</>
          ) : isRecording ? (
            <>
              <Square className="h-3 w-3" />
              Stop ({formatDuration(recordingDuration)})
            </>
          ) : (
            <>
              <Mic className="h-3 w-3" />
              Record
            </>
          )}
        </Button>

        {memosNeedingTranscription > 0 && (
          <Button variant="outline" size="sm" onClick={handleTranscribeAll} disabled={isTranscribingAll} className="h-7 gap-1.5 text-xs">
            {isTranscribingAll ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {transcribeProgress ? `${transcribeProgress.current}/${transcribeProgress.total}` : "..."}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                Transcribe ({memosNeedingTranscription})
              </>
            )}
          </Button>
        )}

        {memosNeedingSync > 0 && (
          <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncingAll} className="h-7 gap-1.5 text-xs">
            {isSyncingAll ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {syncProgress ? `${syncProgress.current}/${syncProgress.total}` : "..."}
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3" />
                Sync ({memosNeedingSync})
              </>
            )}
          </Button>
        )}

        {isTauri && memosNeedingCloudSync > 0 && (
          <Button variant="outline" size="sm" onClick={handleSyncTranscriptsToCloud} disabled={isSyncingToCloud} className="h-7 gap-1.5 text-xs">
            {isSyncingToCloud ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {cloudSyncProgress ? `${cloudSyncProgress.current}/${cloudSyncProgress.total}` : "..."}
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3" />
                Cloud ({memosNeedingCloudSync})
              </>
            )}
          </Button>
        )}
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Recording...</span>
        </div>
      )}

      {error && (
        <div className="p-2 bg-destructive/10 text-destructive rounded-md text-xs mb-2">
          {error}
        </div>
      )}

      {/* Memos list */}
      <div className="space-y-0.5">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
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
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="h-5 w-5 mx-auto mb-1 opacity-40" />
            <p className="text-xs">No voice notes yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
