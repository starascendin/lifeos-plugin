import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SentimentBadge, type Sentiment } from "./SentimentBadge";
import {
  CheckCircle2,
  Lightbulb,
  Tags,
  Clock,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react";
import { Doc, Id } from "@holaai/convex/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef } from "react";

interface ExtractionCardProps {
  memo: Doc<"life_voiceMemos"> & { audioUrl: string | null };
  extraction: Doc<"life_voiceMemoExtractions">;
  onClick?: () => void;
  showFullDetails?: boolean;
}

export function ExtractionCard({
  memo,
  extraction,
  onClick,
  showFullDetails = false,
}: ExtractionCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadAndPlayAudio = async () => {
    if (!memo.audioUrl && !audioSrc) {
      return;
    }

    if (!audioSrc && memo.audioUrl) {
      setAudioSrc(memo.audioUrl);
    }

    // Small delay for audio element to load
    setTimeout(() => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    }, 100);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <Card
      className={`transition-all ${onClick ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {memo.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(memo.duration)}</span>
              <span>·</span>
              <span>
                {formatDistanceToNow(extraction.createdAt, { addSuffix: true })}
              </span>
              {extraction.version > 1 && (
                <>
                  <span>·</span>
                  <Badge variant="outline" className="text-xs h-5">
                    v{extraction.version}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SentimentBadge sentiment={extraction.sentiment as Sentiment} />
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Summary */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {extraction.summary}
        </p>

        {/* Labels */}
        {extraction.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(showFullDetails ? extraction.labels : extraction.labels.slice(0, 5)).map(
              (label, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-xs"
                >
                  {label}
                </Badge>
              )
            )}
            {!showFullDetails && extraction.labels.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{extraction.labels.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {/* Action Items Preview */}
        {extraction.actionItems.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">
              {extraction.actionItems.length} action item
              {extraction.actionItems.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Key Points Preview */}
        {extraction.keyPoints.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">
              {extraction.keyPoints.length} key point
              {extraction.keyPoints.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Full Details (when expanded) */}
        {showFullDetails && (
          <div className="space-y-4 pt-2 border-t">
            {/* Action Items List */}
            {extraction.actionItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Action Items
                </h4>
                <ul className="space-y-1">
                  {extraction.actionItems.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-muted-foreground/50">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Points List */}
            {extraction.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Key Points
                </h4>
                <ul className="space-y-1">
                  {extraction.keyPoints.map((point, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-muted-foreground/50">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Audio Player */}
            {memo.audioUrl && (
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadAndPlayAudio();
                  }}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 mr-1" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  {isPlaying ? "Pause" : "Play Audio"}
                </Button>
                {(audioSrc || memo.audioUrl) && (
                  <audio
                    ref={audioRef}
                    src={audioSrc || memo.audioUrl || undefined}
                    onEnded={handleAudioEnded}
                    className="hidden"
                  />
                )}
              </div>
            )}

            {/* Transcript */}
            {memo.transcript && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Transcript</h4>
                <ScrollArea className="h-32 rounded-md border p-3 bg-muted/30">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {memo.transcript}
                  </p>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
