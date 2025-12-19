import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Trophy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// Table styling is applied via prose classes
import type {
  Stage2Evaluation,
  AggregateRanking,
} from "@/lib/contexts/LLMCouncilContext";

interface Stage2PanelProps {
  evaluations: Stage2Evaluation[];
  aggregateRankings?: AggregateRanking[];
  labelToModel?: Record<string, string>;
}

export function Stage2Panel({
  evaluations,
  aggregateRankings,
  labelToModel,
}: Stage2PanelProps) {
  const [activeTab, setActiveTab] = useState(
    evaluations[0]?.evaluatorModelId ?? ""
  );

  // Get short model name for tab display
  const getShortName = (modelName: string) => {
    if (modelName.length <= 12) return modelName;
    const parts = modelName.split(/[\s-]/);
    return parts[0];
  };

  // Create reverse mapping from model ID to label
  const modelToLabel: Record<string, string> = {};
  if (labelToModel) {
    Object.entries(labelToModel).forEach(([label, modelId]) => {
      modelToLabel[modelId] = label;
    });
  }

  // De-anonymize evaluation text by replacing labels with model names
  const deanonymizeText = (text: string) => {
    if (!labelToModel) return text;

    let result = text;
    Object.entries(labelToModel).forEach(([label, modelId]) => {
      // Find the model name from evaluations or aggregateRankings
      const ranking = aggregateRankings?.find((r) => r.modelId === modelId);
      if (ranking) {
        // Replace "Response A" with "Response A (GPT-4o)" etc.
        result = result.replace(
          new RegExp(label, "g"),
          `${label} (${ranking.modelName})`
        );
      }
    });
    return result;
  };

  if (evaluations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No evaluations yet</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aggregate Rankings - "Street Cred" */}
      {aggregateRankings && aggregateRankings.length > 0 && (
        <Card className="bg-accent/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Aggregate Rankings (Street Cred)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {aggregateRankings.map((ranking, index) => (
                <div
                  key={ranking.modelId}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? "bg-yellow-500 text-yellow-950"
                          : index === 1
                            ? "bg-gray-300 text-gray-700"
                            : index === 2
                              ? "bg-orange-400 text-orange-950"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">
                      {ranking.modelName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Avg: {ranking.averageRank.toFixed(2)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({ranking.rankingsCount} votes)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Evaluations */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {evaluations.map((evaluation) => (
            <TabsTrigger
              key={evaluation.evaluatorModelId}
              value={evaluation.evaluatorModelId}
              className="text-xs"
            >
              {getShortName(evaluation.evaluatorModelName)}
              {evaluation.error && (
                <AlertCircle className="ml-1 h-3 w-3 text-destructive" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {evaluations.map((evaluation) => (
          <TabsContent
            key={evaluation.evaluatorModelId}
            value={evaluation.evaluatorModelId}
            className="mt-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{evaluation.evaluatorModelName}</Badge>
              {evaluation.error && <Badge variant="destructive">Error</Badge>}
            </div>

            {/* Parsed Ranking */}
            {evaluation.parsedRanking && evaluation.parsedRanking.length > 0 && (
              <div className="mb-3 p-2 rounded-md bg-muted/50">
                <span className="text-xs font-medium text-muted-foreground">
                  Extracted Ranking:{" "}
                </span>
                <span className="text-xs">
                  {evaluation.parsedRanking
                    .map((modelId) => {
                      const ranking = aggregateRankings?.find(
                        (r) => r.modelId === modelId
                      );
                      return ranking?.modelName ?? modelId;
                    })
                    .join(" > ")}
                </span>
              </div>
            )}

            <div className="rounded-md border p-4 max-h-[500px] overflow-y-auto">
              {evaluation.error ? (
                <div className="text-destructive text-sm">
                  {evaluation.error}
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-table:text-sm prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-table:border prose-th:border prose-td:border">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {deanonymizeText(evaluation.evaluation)}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
