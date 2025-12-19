import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stage1Panel } from "./Stage1Panel";
import { Stage2Panel } from "./Stage2Panel";
import { Stage3Panel } from "./Stage3Panel";
import type {
  Stage1Response,
  Stage2Evaluation,
  Stage3Response,
  AggregateRanking,
} from "@/lib/contexts/LLMCouncilContext";
import { MessageSquare, CheckCircle2, Loader2 } from "lucide-react";

interface StageDisplayProps {
  query?: string;
  stage1Responses: Stage1Response[];
  stage2Evaluations: Stage2Evaluation[];
  stage3Response?: Stage3Response;
  aggregateRankings?: AggregateRanking[];
  labelToModel?: Record<string, string>;
  currentStage: number; // 1, 2, 3, or 0 for complete
}

export function StageDisplay({
  query,
  stage1Responses,
  stage2Evaluations,
  stage3Response,
  aggregateRankings,
  labelToModel,
  currentStage,
}: StageDisplayProps) {
  const getStageStatus = (stage: number) => {
    if (currentStage === 0) return "complete";
    if (stage < currentStage) return "complete";
    if (stage === currentStage) {
      // Special case: Stage 3 is complete if we have a response
      if (stage === 3 && stage3Response?.isComplete) return "complete";
      return "active";
    }
    return "pending";
  };

  const renderStageHeader = (stage: number, title: string, count?: number) => {
    const status = getStageStatus(stage);

    return (
      <div className="flex items-center gap-2">
        {status === "active" ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : status === "complete" ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
        )}
        <span>{title}</span>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {count}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* User Query */}
      {query && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Query
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{query}</p>
          </CardContent>
        </Card>
      )}

      {/* Stage 1: Individual Responses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {renderStageHeader(
              1,
              "Stage 1: Individual Responses",
              stage1Responses.length
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stage1Responses.length > 0 ? (
            <Stage1Panel responses={stage1Responses} />
          ) : currentStage === 1 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Collecting responses from council members...
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Waiting for query...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage 2: Peer Evaluation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {renderStageHeader(
              2,
              "Stage 2: Peer Evaluation",
              stage2Evaluations.length
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stage2Evaluations.length > 0 ? (
            <Stage2Panel
              evaluations={stage2Evaluations}
              aggregateRankings={aggregateRankings}
              labelToModel={labelToModel}
            />
          ) : currentStage === 2 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Council members are evaluating responses...
            </div>
          ) : currentStage > 2 || getStageStatus(2) === "complete" ? (
            <div className="text-sm text-muted-foreground">No evaluations</div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Waiting for Stage 1 to complete...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage 3: Chairman Synthesis */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {renderStageHeader(3, "Stage 3: Chairman's Final Answer")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stage3Response ? (
            <Stage3Panel response={stage3Response} />
          ) : currentStage === 3 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chairman is synthesizing the final answer...
            </div>
          ) : currentStage > 3 || getStageStatus(3) === "complete" ? (
            <div className="text-sm text-muted-foreground">
              No synthesis available
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Waiting for Stage 2 to complete...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
