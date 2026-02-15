import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mic, Clock, FileText, HardDrive, Cloud, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
  getMemosForDateRange,
  type StoredVoiceMemo,
} from "@/lib/storage/voiceMemoStorage";
import {
  getVoiceMemos,
  type VoiceMemo as ExportedVoiceMemo,
} from "@/lib/services/voicememos";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

// Sanitize memo name: if it's a raw ISO timestamp, format it as local time
function displayMemoName(name: string, createdAt: number): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(name)) {
    const date = new Date(createdAt);
    return `Recording - ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }
  return name;
}

// Unified memo type for merged display
interface MergedWeeklyMemo {
  id: string;
  name: string;
  duration: number;
  transcript?: string;
  clientCreatedAt: number;
  transcriptionStatus: string;
  syncStatus: SyncStatus;
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case "local":
      return (
        <Badge
          variant="outline"
          className="text-[10px] gap-0.5 text-gray-500 border-gray-300 h-4 px-1"
        >
          <HardDrive className="h-2.5 w-2.5" />
          Local
        </Badge>
      );
    case "cloud":
      return (
        <Badge
          variant="outline"
          className="text-[10px] gap-0.5 text-blue-500 border-blue-300 h-4 px-1"
        >
          <Cloud className="h-2.5 w-2.5" />
          Cloud
        </Badge>
      );
    case "synced":
      return (
        <Badge
          variant="outline"
          className="text-[10px] gap-0.5 text-green-500 border-green-300 h-4 px-1"
        >
          <Check className="h-2.5 w-2.5" />
          Synced
        </Badge>
      );
    case "exported":
      return (
        <Badge
          variant="outline"
          className="text-[10px] gap-0.5 text-violet-500 border-violet-300 h-4 px-1"
        >
          <Mic className="h-2.5 w-2.5" />
          VM
        </Badge>
      );
    default:
      return null;
  }
}

function MemoItem({ memo }: { memo: MergedWeeklyMemo }) {
  const hasTranscript =
    memo.transcript && memo.transcriptionStatus === "completed";

  return (
    <div className="border rounded-md p-2 space-y-1.5">
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Mic className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
          <span className="font-medium text-xs truncate">
            {displayMemoName(memo.name, memo.clientCreatedAt)}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">
          {formatDuration(memo.duration)}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-2.5 w-2.5" />
        <span>
          {formatMemoDate(memo.clientCreatedAt)} {formatMemoTime(memo.clientCreatedAt)}
        </span>
        <SyncStatusBadge status={memo.syncStatus} />
      </div>

      {hasTranscript && (
        <div className="pt-1 border-t">
          <div className="flex items-start gap-1.5">
            <FileText className="h-2.5 w-2.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              {memo.transcript}
            </p>
          </div>
        </div>
      )}

      {memo.transcriptionStatus === "processing" && (
        <p className="text-[10px] text-muted-foreground italic pt-1 border-t">
          Transcribing...
        </p>
      )}
    </div>
  );
}

export function WeeklyMemosSection() {
  const { weeklyMemos, isLoadingWeeklyData, weekStartDate, weekEndDate } =
    useAgenda();
  const [localMemos, setLocalMemos] = useState<StoredVoiceMemo[]>([]);
  const [exportedMemos, setExportedMemos] = useState<ExportedVoiceMemo[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  // Load local memos from IndexedDB for the week range
  const loadLocalMemos = useCallback(async () => {
    try {
      const memos = await getMemosForDateRange(weekStartDate, weekEndDate);
      setLocalMemos(memos);
    } catch (error) {
      console.error("Failed to load local memos:", error);
    }
  }, [weekStartDate, weekEndDate]);

  // Load exported macOS Voice Memos from Tauri SQLite for the week range
  const loadExportedMemos = useCallback(async () => {
    if (!isTauri) {
      setExportedMemos([]);
      return;
    }

    try {
      const allExported = await getVoiceMemos();

      // Parse date range
      const [startYear, startMonth, startDay] = weekStartDate
        .split("-")
        .map(Number);
      const [endYear, endMonth, endDay] = weekEndDate.split("-").map(Number);
      const rangeStart = new Date(
        startYear,
        startMonth - 1,
        startDay,
        0,
        0,
        0,
        0,
      ).getTime();
      const rangeEnd = new Date(
        endYear,
        endMonth - 1,
        endDay,
        23,
        59,
        59,
        999,
      ).getTime();

      // Filter to the week range
      const filtered = allExported.filter(
        (m) => m.date >= rangeStart && m.date <= rangeEnd,
      );
      setExportedMemos(filtered);
    } catch (error) {
      console.error("Failed to load exported memos:", error);
    }
  }, [weekStartDate, weekEndDate]);

  // Load all local and exported memos when week changes
  useEffect(() => {
    setIsLoadingLocal(true);
    Promise.all([loadLocalMemos(), loadExportedMemos()]).finally(() =>
      setIsLoadingLocal(false),
    );
  }, [loadLocalMemos, loadExportedMemos]);

  // Merge and deduplicate memos from all sources
  const mergedMemos: MergedWeeklyMemo[] = (() => {
    const cloudMemos = weeklyMemos ?? [];

    // Create a map of cloud memos by localId for deduplication
    const cloudByLocalId = new Map<string, (typeof cloudMemos)[0]>();
    for (const memo of cloudMemos) {
      if (memo.localId) {
        cloudByLocalId.set(memo.localId, memo);
      }
    }

    // Create a set of local memo IDs for deduplication
    const localIds = new Set(localMemos.map((m) => m.id));

    const result: MergedWeeklyMemo[] = [];

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

  const isLoading = isLoadingWeeklyData || isLoadingLocal;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Mic className="h-4 w-4 text-violet-500" />
            Voice Memos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDuration = mergedMemos.reduce((sum, m) => sum + m.duration, 0);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  !isOpen && "-rotate-90",
                )}
              />
              <Mic className="h-4 w-4 text-violet-500" />
              Voice Memos
              {mergedMemos.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({mergedMemos.length})
                </span>
              )}
            </CardTitle>
            {mergedMemos.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(totalDuration)}
              </span>
            )}
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {mergedMemos.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Mic className="h-6 w-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No voice memos this week</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mergedMemos.map((memo) => (
                  <MemoItem key={memo.id} memo={memo} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
