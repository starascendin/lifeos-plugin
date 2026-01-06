import { useState, useCallback } from "react";
import { useAgenda, formatWeekRange } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";
import { ModelSelector, UsageDisplay } from "../ModelSelector";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const DEFAULT_WEEKLY_PROMPT = `Provide a weekly summary for {weekStartDate} to {weekEndDate}:

END DAY SCORES: {dayScores}
WEEKLY AVERAGE: {average}

TASKS COMPLETED: {completedCount}
{completedTasksList}

TASKS REMAINING: {remainingCount}
{remainingTasksList}

VOICE MEMO HIGHLIGHTS:
{memoTranscripts}

Please provide:
1. Week performance summary (2-3 sentences)
2. Key accomplishments
3. Focus recommendations for next week`;

export function WeeklyAISummarySection() {
  const {
    weeklySummary,
    isLoadingWeeklySummary,
    isGeneratingWeeklySummary,
    generateWeeklySummary,
    updateWeeklyPrompt,
    currentWeekStart,
    weekStartDate,
    selectedModel,
    setSelectedModel,
  } = useAgenda();

  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Get current prompt (edited, saved, or default)
  const currentPrompt =
    editedPrompt ?? weeklySummary?.customPrompt ?? DEFAULT_WEEKLY_PROMPT;
  const hasUnsavedChanges =
    editedPrompt !== null && editedPrompt !== (weeklySummary?.customPrompt ?? DEFAULT_WEEKLY_PROMPT);

  const hasSummary = weeklySummary?.aiSummary;

  // Save prompt handler
  const handleSavePrompt = useCallback(async () => {
    if (!editedPrompt || !hasUnsavedChanges) return;

    setIsSavingPrompt(true);
    try {
      await updateWeeklyPrompt({
        weekStartDate,
        customPrompt: editedPrompt,
      });
      setEditedPrompt(null); // Reset to indicate saved
    } catch (error) {
      console.error("Failed to save prompt:", error);
    } finally {
      setIsSavingPrompt(false);
    }
  }, [editedPrompt, hasUnsavedChanges, updateWeeklyPrompt, weekStartDate]);

  // Reset to default prompt
  const handleResetPrompt = useCallback(() => {
    setEditedPrompt(DEFAULT_WEEKLY_PROMPT);
  }, []);

  // Format the generation time
  const formatGeneratedTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const weekRangeDisplay = formatWeekRange(currentWeekStart);

  return (
    <Card className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Sparkles className="h-5 w-5 text-violet-500 flex-shrink-0" />
            <span className="truncate">Weekly Summary</span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden sm:block">
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={isGeneratingWeeklySummary}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateWeeklySummary}
              disabled={isGeneratingWeeklySummary}
              className="gap-2 flex-shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${isGeneratingWeeklySummary ? "animate-spin" : ""}`}
              />
              <span className="hidden xs:inline">
                {isGeneratingWeeklySummary
                  ? "Generating..."
                  : hasSummary
                    ? "Regenerate"
                    : "Generate"}
              </span>
            </Button>
          </div>
        </div>
        {/* Mobile model selector */}
        <div className="sm:hidden mt-2">
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={isGeneratingWeeklySummary}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Collapsible prompt editor */}
        <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between gap-2"
            >
              <span className="text-xs">
                {isPromptOpen ? "Hide" : "Edit"} Summary Prompt
              </span>
              {isPromptOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <Textarea
              value={currentPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className="min-h-[200px] text-xs font-mono"
              placeholder="Enter your custom prompt template..."
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetPrompt}
                  className="text-xs"
                >
                  Reset to Default
                </Button>
              </div>
              <Button
                size="sm"
                onClick={handleSavePrompt}
                disabled={!hasUnsavedChanges || isSavingPrompt}
                className="gap-2 text-xs"
              >
                <Save className="h-3 w-3" />
                {isSavingPrompt ? "Saving..." : "Save Prompt"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Placeholders: {"{weekStartDate}"}, {"{weekEndDate}"},{" "}
              {"{dayScores}"}, {"{average}"}, {"{completedCount}"},{" "}
              {"{completedTasksList}"}, {"{remainingCount}"},{" "}
              {"{remainingTasksList}"}, {"{memoTranscripts}"}
            </p>
          </CollapsibleContent>
        </Collapsible>

        {/* Summary content */}
        {isLoadingWeeklySummary ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isGeneratingWeeklySummary ? (
          <div className="flex items-center gap-3 py-4">
            <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <span className="text-muted-foreground">
              Generating weekly summary with {selectedModel.split("/")[1]}...
            </span>
          </div>
        ) : hasSummary ? (
          <div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {weeklySummary.aiSummary}
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-3 sm:flex-row sm:items-center sm:justify-between">
              <UsageDisplay
                usage={weeklySummary.usage ?? null}
                model={weeklySummary.model}
              />
              {weeklySummary.generatedAt && (
                <p className="text-xs text-muted-foreground">
                  Generated {formatGeneratedTime(weeklySummary.generatedAt)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-1">
              No summary generated yet
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              {weekRangeDisplay}
            </p>
            <Button
              onClick={generateWeeklySummary}
              disabled={isGeneratingWeeklySummary}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate Weekly Summary
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              AI will analyze your scores, tasks, and voice memos
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
