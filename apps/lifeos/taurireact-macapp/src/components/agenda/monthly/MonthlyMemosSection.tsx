import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mic, Clock, FileText, HardDrive, Cloud, Check } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import {
  getMemosForDateRange,
  type StoredVoiceMemo,
} from "@/lib/storage/voiceMemoStorage";
import {
  getVoiceMemos,
  type VoiceMemo as ExportedVoiceMemo,
} from "@/lib/services/voicememos";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Sync status type for merged memos
type SyncStatus = "local" | "cloud" | "synced" | "exported";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }
  return `0:${String(secs).padStart(2, "0")}`;
}

function formatMemoDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMemoTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Unified memo type for merged display
interface MergedMonthlyMemo {
  id: string;
  name: string;
  duration: number;
  transcript?: string;
  clientCreatedAt: number;
  transcriptionStatus: string;
  syncStatus: SyncStatus;
}

interface MemoItemProps {
  memo: MergedMonthlyMemo;
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case "local":
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 text-gray-500 border-gray-300"
        >
          <HardDrive className="h-3 w-3" />
          Local
        </Badge>
      );
    case "cloud":
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 text-blue-500 border-blue-300"
        >
          <Cloud className="h-3 w-3" />
          Cloud
        </Badge>
      );
    case "synced":
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 text-green-500 border-green-300"
        >
          <Check className="h-3 w-3" />
          Synced
        </Badge>
      );
    case "exported":
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 text-violet-500 border-violet-300"
        >
          <Mic className="h-3 w-3" />
          Voice Memo
        </Badge>
      );
    default:
      return null;
  }
}

function MemoItem({ memo }: MemoItemProps) {
  const hasTranscript =
    memo.transcript && memo.transcriptionStatus === "completed";

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Mic className="h-4 w-4 text-violet-500 flex-shrink-0" />
          <span className="font-medium text-sm truncate">{memo.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className="text-xs">
            {formatDuration(memo.duration)}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          {formatMemoDate(memo.clientCreatedAt)} at{" "}
          {formatMemoTime(memo.clientCreatedAt)}
        </span>
        <SyncStatusBadge status={memo.syncStatus} />
      </div>

      {hasTranscript && (
        <div className="pt-2 border-t">
          <div className="flex items-start gap-2">
            <FileText className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {memo.transcript}
            </p>
          </div>
        </div>
      )}

      {memo.transcriptionStatus === "processing" && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground italic">
            Transcribing...
          </p>
        </div>
      )}

      {memo.transcriptionStatus === "pending" && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground italic">
            Awaiting transcription
          </p>
        </div>
      )}
    </div>
  );
}

export function MonthlyMemosSection() {
  const { monthlyMemos, isLoadingMonthlyData, monthStartDate, monthEndDate } =
    useAgenda();
  const [localMemos, setLocalMemos] = useState<StoredVoiceMemo[]>([]);
  const [exportedMemos, setExportedMemos] = useState<ExportedVoiceMemo[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  // Load local memos from IndexedDB for the month range
  const loadLocalMemos = useCallback(async () => {
    try {
      const memos = await getMemosForDateRange(monthStartDate, monthEndDate);
      setLocalMemos(memos);
    } catch (error) {
      console.error("Failed to load local memos:", error);
    }
  }, [monthStartDate, monthEndDate]);

  // Load exported macOS Voice Memos from Tauri SQLite for the month range
  const loadExportedMemos = useCallback(async () => {
    if (!isTauri) {
      setExportedMemos([]);
      return;
    }

    try {
      const allExported = await getVoiceMemos();

      // Parse date range
      const [startYear, startMonth, startDay] = monthStartDate
        .split("-")
        .map(Number);
      const [endYear, endMonth, endDay] = monthEndDate.split("-").map(Number);
      const rangeStart = new Date(
        startYear,
        startMonth - 1,
        startDay,
        0,
        0,
        0,
        0
      ).getTime();
      const rangeEnd = new Date(
        endYear,
        endMonth - 1,
        endDay,
        23,
        59,
        59,
        999
      ).getTime();

      // Filter to the month range
      const filtered = allExported.filter(
        (m) => m.date >= rangeStart && m.date <= rangeEnd
      );
      setExportedMemos(filtered);
    } catch (error) {
      console.error("Failed to load exported memos:", error);
    }
  }, [monthStartDate, monthEndDate]);

  // Load all local and exported memos when month changes
  useEffect(() => {
    setIsLoadingLocal(true);
    Promise.all([loadLocalMemos(), loadExportedMemos()]).finally(() =>
      setIsLoadingLocal(false)
    );
  }, [loadLocalMemos, loadExportedMemos]);

  // Merge and deduplicate memos from all sources
  const mergedMemos: MergedMonthlyMemo[] = (() => {
    const cloudMemos = monthlyMemos ?? [];

    // Create a map of cloud memos by localId for deduplication
    const cloudByLocalId = new Map<string, (typeof cloudMemos)[0]>();
    for (const memo of cloudMemos) {
      if (memo.localId) {
        cloudByLocalId.set(memo.localId, memo);
      }
    }

    // Create a set of local memo IDs for deduplication
    const localIds = new Set(localMemos.map((m) => m.id));

    const result: MergedMonthlyMemo[] = [];

    // Add local memos (check if synced to cloud)
    for (const local of localMemos) {
      const cloudMatch = cloudByLocalId.get(local.id);
      result.push({
        id: local.id,
        name: local.name,
        duration: local.duration,
        transcript: local.transcript ?? cloudMatch?.transcript,
        clientCreatedAt: local.createdAt,
        transcriptionStatus:
          cloudMatch?.transcriptionStatus ??
          (local.transcript ? "completed" : "pending"),
        syncStatus: cloudMatch ? "synced" : "local",
      });
    }

    // Add cloud-only memos (not in local)
    for (const cloud of cloudMemos) {
      if (!cloud.localId || !localIds.has(cloud.localId)) {
        result.push({
          id: cloud._id,
          name: cloud.name,
          duration: cloud.duration / 1000, // Cloud duration is in ms
          transcript: cloud.transcript,
          clientCreatedAt: cloud.clientCreatedAt,
          transcriptionStatus: cloud.transcriptionStatus,
          syncStatus: "cloud",
        });
      }
    }

    // Add exported macOS memos (filter out duplicates by uuid)
    const existingIds = new Set(result.map((m) => m.id));
    for (const exported of exportedMemos) {
      // Check if this exported memo is already represented via cloud sync
      const cloudMatch = cloudByLocalId.get(exported.uuid);
      if (!cloudMatch && !existingIds.has(exported.uuid)) {
        result.push({
          id: `exported-${exported.id}`,
          name:
            exported.custom_label ||
            `Recording - ${new Date(exported.date).toLocaleString()}`,
          duration: exported.duration,
          transcript: exported.transcription ?? undefined,
          clientCreatedAt: exported.date,
          transcriptionStatus: exported.transcription ? "completed" : "pending",
          syncStatus: "exported",
        });
      }
    }

    // Sort by creation date descending
    return result.sort((a, b) => b.clientCreatedAt - a.clientCreatedAt);
  })();

  const isLoading = isLoadingMonthlyData || isLoadingLocal;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Mic className="h-5 w-5 text-violet-500" />
            Voice Memos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDuration = mergedMemos.reduce((sum, m) => sum + m.duration, 0);
  const transcribedCount = mergedMemos.filter(
    (m) => m.transcriptionStatus === "completed" && m.transcript
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Mic className="h-5 w-5 text-violet-500" />
            Voice Memos
          </CardTitle>
          {mergedMemos.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                {mergedMemos.length} memo{mergedMemos.length !== 1 ? "s" : ""}
              </span>
              <span>{formatDuration(totalDuration)} total</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {mergedMemos.length === 0 ? (
          <div className="text-center py-8">
            <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No voice memos recorded this month
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {mergedMemos.map((memo) => (
              <MemoItem key={memo.id} memo={memo} />
            ))}

            {transcribedCount > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                {transcribedCount} of {mergedMemos.length} memo
                {mergedMemos.length !== 1 ? "s" : ""} transcribed
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
