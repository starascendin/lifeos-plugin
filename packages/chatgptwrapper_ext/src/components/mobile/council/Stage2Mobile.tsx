import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LLM_CONFIG, type LLMType } from '../../../config/llm';
import type { Stage2Result, AggregateRanking, ResponseEvaluation } from '../../../store/councilStore';

interface Stage2MobileProps {
  rankings: Stage2Result[];
  labelToModel?: Record<string, { model: string; llmType: LLMType }>;
  aggregateRankings?: AggregateRanking[];
}

function EvaluationCard({ evaluation, labelToModel }: {
  evaluation: ResponseEvaluation;
  labelToModel?: Record<string, { model: string; llmType: LLMType }>;
}) {
  const [expanded, setExpanded] = useState(false);

  const modelInfo = labelToModel?.[evaluation.responseLabel];
  const modelName = modelInfo ? LLM_CONFIG[modelInfo.llmType].name : evaluation.responseLabel;
  const modelColor = modelInfo ? LLM_CONFIG[modelInfo.llmType].color : undefined;

  return (
    <div className="border rounded-lg p-3 mb-2">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            style={{ borderColor: modelColor, color: modelColor }}
          >
            {modelName}
          </Badge>
          <span className="font-medium">{evaluation.totalScore}/25</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Scores */}
          <div className="space-y-1">
            {evaluation.scores.map((score) => (
              <div key={score.criterion} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">{score.criterion}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      score.score >= 4 ? "bg-green-500" :
                      score.score >= 3 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${(score.score / 5) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right font-medium">{score.score}</span>
              </div>
            ))}
          </div>

          {/* Strengths */}
          {evaluation.strengths.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-green-600 mb-1">Strengths</h5>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {evaluation.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {evaluation.weaknesses.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-red-600 mb-1">Weaknesses</h5>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {evaluation.weaknesses.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Points Added */}
          {evaluation.pointsAdded && evaluation.pointsAdded.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-emerald-600 mb-1">Points Added</h5>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {evaluation.pointsAdded.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Points Docked */}
          {evaluation.pointsDocked && evaluation.pointsDocked.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-orange-600 mb-1">Points Docked</h5>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {evaluation.pointsDocked.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Stage2Mobile({ rankings, labelToModel, aggregateRankings }: Stage2MobileProps) {
  if (rankings.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        Stage 2: Peer Rankings
      </h4>

      {/* Aggregate Rankings Summary */}
      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1">
          {aggregateRankings.map((ar, index) => {
            const config = LLM_CONFIG[ar.llmType];
            return (
              <Badge
                key={ar.llmType}
                variant="secondary"
                className="shrink-0 gap-1"
              >
                <span className="font-bold text-yellow-500">#{index + 1}</span>
                <span style={{ color: config.color }}>{config.icon}</span>
                <span>{config.name}</span>
                <span className="text-muted-foreground text-xs">
                  ({ar.averageRank.toFixed(1)})
                </span>
              </Badge>
            );
          })}
        </div>
      )}

      <Tabs defaultValue={rankings[0]?.llmType} className="w-full">
        <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${rankings.length}, 1fr)` }}>
          {rankings.map((r) => {
            const config = LLM_CONFIG[r.llmType];
            return (
              <TabsTrigger
                key={r.llmType}
                value={r.llmType}
                className="text-xs gap-1"
                style={{ color: config.color }}
              >
                <span>{config.icon}</span>
                <span className="hidden sm:inline">{config.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {rankings.map((r) => (
          <TabsContent key={r.llmType} value={r.llmType} className="mt-2">
            <ScrollArea className="max-h-[400px]">
              {r.evaluations.length > 0 ? (
                <div>
                  {r.evaluations.map((evaluation, i) => (
                    <EvaluationCard
                      key={i}
                      evaluation={evaluation}
                      labelToModel={labelToModel}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg whitespace-pre-wrap">
                  {r.ranking}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
