import { useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Id, Doc } from "@holaai/convex/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SentimentBadge, type Sentiment } from "./SentimentBadge";
import { SystemPromptCollapsible } from "./SystemPromptSettings";
import {
  History,
  X,
  CheckCircle2,
  Lightbulb,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useEffect } from "react";

interface ExtractionHistoryPanelProps {
  voiceMemoId: Id<"life_voiceMemos">;
  memoName: string;
  onClose: () => void;
}

export function ExtractionHistoryPanel({
  voiceMemoId,
  memoName,
  onClose,
}: ExtractionHistoryPanelProps) {
  const history = useQuery(api.lifeos.voicememo_extraction.getExtractionHistory, {
    voiceMemoId,
  });

  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const extractVoiceMemo = useAction(api.lifeos.voicememo_extraction.extractVoiceMemo);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await extractVoiceMemo({
        voiceMemoId,
        customPrompt: customPrompt.trim() || undefined,
      });
      setCustomPrompt("");
    } catch (error) {
      console.error("Failed to regenerate:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Set default version when history loads
  useEffect(() => {
    if (history && history.length > 0 && !selectedVersion) {
      setSelectedVersion(history[0]._id);
    }
  }, [history, selectedVersion]);

  const selectedExtraction = history?.find((h) => h._id === selectedVersion);

  if (!history) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Extraction History
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            No extraction history for this memo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          History
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b bg-muted/30">
        <p className="text-xs text-muted-foreground mb-2 truncate" title={memoName}>
          {memoName}
        </p>
        <Select value={selectedVersion || ""} onValueChange={setSelectedVersion}>
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {history.map((ext) => (
              <SelectItem key={ext._id} value={ext._id}>
                <div className="flex items-center gap-2">
                  <span>Version {ext.version}</span>
                  <span className="text-xs text-muted-foreground">
                    ({formatDistanceToNow(ext.createdAt, { addSuffix: true })})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {selectedExtraction && (
          <div className="p-4 space-y-4">
            {/* Status & Timestamp */}
            <div className="flex items-center gap-2 flex-wrap">
              <SentimentBadge sentiment={selectedExtraction.sentiment as Sentiment} />
              <Badge variant="outline" className="text-xs">
                v{selectedExtraction.version}
              </Badge>
              {selectedExtraction.status === "completed" && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              {format(selectedExtraction.createdAt, "PPpp")}
            </p>

            {/* Summary */}
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Summary</h4>
              <p className="text-sm text-muted-foreground">
                {selectedExtraction.summary}
              </p>
            </div>

            {/* Labels */}
            {selectedExtraction.labels.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Labels</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedExtraction.labels.map((label, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {selectedExtraction.actionItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Action Items
                </h4>
                <ul className="space-y-1">
                  {selectedExtraction.actionItems.map((item, i) => (
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

            {/* Key Points */}
            {selectedExtraction.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Key Points
                </h4>
                <ul className="space-y-1">
                  {selectedExtraction.keyPoints.map((point, i) => (
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

            {/* Custom Prompt */}
            {selectedExtraction.customPrompt && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Custom Instructions
                </h4>
                <p className="text-sm text-muted-foreground italic">
                  "{selectedExtraction.customPrompt}"
                </p>
              </div>
            )}

            {/* Model */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Model: {selectedExtraction.model}
              </p>
            </div>

            {/* Regenerate Section */}
            <div className="space-y-2 pt-3 border-t">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                Regenerate with Instructions
              </h4>
              <Textarea
                placeholder="Add custom instructions (e.g., 'Focus on technical details' or 'Extract meeting attendees')"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[80px] text-sm"
                disabled={isRegenerating}
              />
              <Button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="w-full"
                size="sm"
              >
                {isRegenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate Extraction
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Creates a new version with your custom instructions
              </p>
            </div>

            {/* System Prompt Settings */}
            <div className="pt-3 border-t">
              <SystemPromptCollapsible />
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
