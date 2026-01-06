import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mic, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface MemoItemProps {
  memo: {
    _id: string;
    name: string;
    duration: number;
    transcript?: string;
    clientCreatedAt: number;
    transcriptionStatus: string;
  };
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

export function WeeklyMemosSection() {
  const { weeklyMemos, isLoadingWeeklyData } = useAgenda();

  if (isLoadingWeeklyData) {
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

  const memos = weeklyMemos ?? [];
  const totalDuration = memos.reduce((sum, m) => sum + m.duration, 0);
  const transcribedCount = memos.filter(
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
          {memos.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{memos.length} memo{memos.length !== 1 ? "s" : ""}</span>
              <span>{formatDuration(totalDuration)} total</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {memos.length === 0 ? (
          <div className="text-center py-8">
            <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No voice memos recorded this week
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {memos.map((memo) => (
              <MemoItem key={memo._id} memo={memo} />
            ))}

            {transcribedCount > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                {transcribedCount} of {memos.length} memo
                {memos.length !== 1 ? "s" : ""} transcribed
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
