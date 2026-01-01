import { useAgenda, isToday } from "@/lib/contexts/AgendaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Calendar } from "lucide-react";
import { ModelSelector, UsageDisplay } from "../ModelSelector";

export function AISummarySection() {
  const {
    dailySummary,
    isLoadingSummary,
    isGeneratingSummary,
    generateSummary,
    currentDate,
    selectedModel,
    setSelectedModel,
  } = useAgenda();

  const hasSummary = dailySummary?.aiSummary;
  const isTodayView = isToday(currentDate);

  // Format the generation time
  const formatGeneratedTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Card className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-500" />
            {isTodayView ? "Today's Summary" : "Daily Summary"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isGeneratingSummary}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSummary}
              disabled={isGeneratingSummary}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isGeneratingSummary ? "animate-spin" : ""}`}
              />
              {isGeneratingSummary
                ? "Generating..."
                : hasSummary
                  ? "Regenerate"
                  : "Generate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingSummary ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isGeneratingSummary ? (
          <div className="flex items-center gap-3 py-4">
            <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <span className="text-muted-foreground">
              Generating AI summary with {selectedModel.split("/")[1]}...
            </span>
          </div>
        ) : hasSummary ? (
          <div>
            <p className="text-sm leading-relaxed">{dailySummary.aiSummary}</p>
            <div className="flex items-center justify-between mt-3">
              <UsageDisplay
                usage={dailySummary.usage ?? null}
                model={dailySummary.model}
              />
              {dailySummary.generatedAt && (
                <p className="text-xs text-muted-foreground">
                  Generated at {formatGeneratedTime(dailySummary.generatedAt)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-3">
              No summary generated yet
            </p>
            <Button
              onClick={generateSummary}
              disabled={isGeneratingSummary}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate Summary
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              AI will analyze your habits, tasks, and priorities
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
