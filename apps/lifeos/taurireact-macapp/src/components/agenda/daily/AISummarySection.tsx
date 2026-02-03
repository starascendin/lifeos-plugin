import { useState, useCallback, useRef, useEffect } from "react";
import { useAgenda } from "@/lib/contexts/AgendaContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, RefreshCw, Wrench } from "lucide-react";
import { ModelSelector, UsageDisplay } from "../ModelSelector";
import { DEFAULT_DAILY_PROMPT } from "@holaai/convex";

export function AISummarySection() {
  const {
    dailySummary,
    isLoadingSummary,
    isGeneratingSummary,
    generateSummary,
    selectedModel,
    setSelectedModel,
    saveDailyUserNote,
    updateDailyPrompt,
    dateString,
  } = useAgenda();

  const hasSummary = dailySummary?.aiSummary;

  // User note state - local draft synced from server
  const [noteValue, setNoteValue] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync server value into local state when it changes (and not dirty)
  useEffect(() => {
    if (!noteDirty) {
      setNoteValue(dailySummary?.userNote ?? "");
    }
  }, [dailySummary?.userNote, noteDirty]);

  // Reset dirty flag when date changes
  useEffect(() => {
    setNoteDirty(false);
  }, [dateString]);

  const saveNote = useCallback(
    (value: string) => {
      saveDailyUserNote({ date: dateString, userNote: value });
      setNoteDirty(false);
    },
    [saveDailyUserNote, dateString],
  );

  const handleNoteChange = useCallback(
    (value: string) => {
      setNoteValue(value);
      setNoteDirty(true);
      // Debounce save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveNote(value), 1500);
    },
    [saveNote],
  );

  const handleNoteBlur = useCallback(() => {
    if (noteDirty) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveNote(noteValue);
    }
  }, [noteDirty, noteValue, saveNote]);

  // Debug prompt dialog
  const [debugOpen, setDebugOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");

  const openDebug = useCallback(() => {
    setPromptValue(dailySummary?.customPrompt ?? DEFAULT_DAILY_PROMPT);
    setDebugOpen(true);
  }, [dailySummary?.customPrompt]);

  const savePrompt = useCallback(() => {
    updateDailyPrompt({ date: dateString, customPrompt: promptValue });
    setDebugOpen(false);
  }, [updateDailyPrompt, dateString, promptValue]);

  return (
    <>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
            <h3 className="text-sm font-medium">Today's Summary</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isGeneratingSummary}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => generateSummary(noteValue || undefined)}
              disabled={isGeneratingSummary}
              title={hasSummary ? "Regenerate summary" : "Generate summary"}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isGeneratingSummary ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={openDebug}
              title="Edit prompt template"
            >
              <Wrench className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* User note textarea */}
        <Textarea
          placeholder="Write a note for today..."
          value={noteValue}
          onChange={(e) => handleNoteChange(e.target.value)}
          onBlur={handleNoteBlur}
          className="min-h-[60px] text-sm resize-none mb-3"
          rows={2}
        />

        {/* AI Summary display */}
        {isLoadingSummary ? (
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isGeneratingSummary ? (
          <p className="text-sm text-muted-foreground">
            Generating summary...
          </p>
        ) : hasSummary ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {dailySummary.aiSummary}
            </p>
            <UsageDisplay
              usage={dailySummary.usage ?? null}
              model={dailySummary.model}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No summary yet — click generate to create one.
          </p>
        )}
      </div>

      {/* Debug prompt dialog */}
      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Daily Summary Prompt Template</DialogTitle>
            <DialogDescription>
              Edit the prompt template used to generate the daily summary.
              Available placeholders: {"{date}"}, {"{userNote}"},{" "}
              {"{eventsFormatted}"}, {"{topPriorityCount}"},{" "}
              {"{topTasksFormatted}"}, {"{totalTasks}"},{" "}
              {"{otherTasksFormatted}"}, {"{overdueCount}"},{" "}
              {"{overdueTasksFormatted}"}, {"{habitCompletionCount}"},{" "}
              {"{totalHabits}"}, {"{habitNames}"}, {"{memosFormatted}"}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            className="min-h-[300px] text-sm font-mono"
            rows={12}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPromptValue(DEFAULT_DAILY_PROMPT)}
            >
              Reset to Default
            </Button>
            <Button onClick={savePrompt}>Save Prompt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
