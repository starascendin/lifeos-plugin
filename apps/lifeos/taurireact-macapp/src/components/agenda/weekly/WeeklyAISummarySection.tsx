import { useState, useCallback } from "react";
import { useAgenda, formatWeekRange } from "@/lib/contexts/AgendaContext";
// Card imports removed — using plain div for compactness
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  RefreshCw,
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

  const currentPrompt =
    editedPrompt ?? weeklySummary?.customPrompt ?? DEFAULT_WEEKLY_PROMPT;
  const hasUnsavedChanges =
    editedPrompt !== null &&
    editedPrompt !== (weeklySummary?.customPrompt ?? DEFAULT_WEEKLY_PROMPT);

  const hasSummary = weeklySummary?.aiSummary;

  const handleSavePrompt = useCallback(async () => {
    if (!editedPrompt || !hasUnsavedChanges) return;
    setIsSavingPrompt(true);
    try {
      await updateWeeklyPrompt({
        weekStartDate,
        customPrompt: editedPrompt,
      });
      setEditedPrompt(null);
    } catch (error) {
      console.error("Failed to save prompt:", error);
    } finally {
      setIsSavingPrompt(false);
    }
  }, [editedPrompt, hasUnsavedChanges, updateWeeklyPrompt, weekStartDate]);

  const handleResetPrompt = useCallback(() => {
    setEditedPrompt(DEFAULT_WEEKLY_PROMPT);
  }, []);

  const weekRangeDisplay = formatWeekRange(currentWeekStart);

  return (
    <div className="rounded-lg border bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium">Weekly Summary</span>
        </div>
        <div className="flex items-center gap-1">
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={isGeneratingWeeklySummary}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={generateWeeklySummary}
            disabled={isGeneratingWeeklySummary}
            title={hasSummary ? "Regenerate" : "Generate"}
          >
            <RefreshCw
              className={`h-3 w-3 ${isGeneratingWeeklySummary ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoadingWeeklySummary ? (
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : isGeneratingWeeklySummary ? (
        <div className="flex items-center gap-2 py-1">
          <div className="h-3.5 w-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground">
            Generating with {selectedModel.split("/")[1]}...
          </span>
        </div>
      ) : hasSummary ? (
        <>
          <p className="text-xs leading-relaxed whitespace-pre-wrap">
            {weeklySummary.aiSummary}
          </p>
          <div className="flex items-center justify-between">
            <UsageDisplay
              usage={weeklySummary.usage ?? null}
              model={weeklySummary.model}
            />
            {weeklySummary.generatedAt && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(weeklySummary.generatedAt).toLocaleDateString(
                  "en-US",
                  { weekday: "short", month: "short", day: "numeric" },
                )}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{weekRangeDisplay}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={generateWeeklySummary}
            disabled={isGeneratingWeeklySummary}
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </Button>
        </div>
      )}

      {/* Prompt editor */}
      <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            {isPromptOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {isPromptOpen ? "Hide" : "Edit"} prompt
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          <Textarea
            value={currentPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="min-h-[120px] text-xs font-mono"
            placeholder="Enter your custom prompt template..."
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetPrompt}
              className="text-xs h-6"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSavePrompt}
              disabled={!hasUnsavedChanges || isSavingPrompt}
              className="gap-1 text-xs h-6"
            >
              <Save className="h-2.5 w-2.5" />
              {isSavingPrompt ? "Saving..." : "Save"}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
