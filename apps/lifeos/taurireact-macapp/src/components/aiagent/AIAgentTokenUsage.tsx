import { Coins, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAIAgent } from "@/lib/contexts/AIAgentContext";

/**
 * Format large numbers with K/M suffix
 */
function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

interface AIAgentTokenUsageProps {
  showReset?: boolean;
  compact?: boolean;
}

export function AIAgentTokenUsage({
  showReset = true,
  compact = false,
}: AIAgentTokenUsageProps) {
  const { cumulativeUsage, resetUsage } = useAIAgent();

  const hasUsage = cumulativeUsage.totalTokens > 0;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Coins className="h-3 w-3" />
            <span>{formatTokenCount(cumulativeUsage.totalTokens)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <div>Prompt: {cumulativeUsage.promptTokens.toLocaleString()}</div>
            <div>Completion: {cumulativeUsage.completionTokens.toLocaleString()}</div>
            <div className="font-medium border-t pt-1 mt-1">
              Total: {cumulativeUsage.totalTokens.toLocaleString()}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 rounded-md">
      <Coins className="h-4 w-4 text-muted-foreground" />

      <div className="flex items-center gap-4 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground">In</span>
              <span className="font-mono font-medium">
                {formatTokenCount(cumulativeUsage.promptTokens)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Prompt tokens: {cumulativeUsage.promptTokens.toLocaleString()}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground">Out</span>
              <span className="font-mono font-medium">
                {formatTokenCount(cumulativeUsage.completionTokens)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Completion tokens: {cumulativeUsage.completionTokens.toLocaleString()}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center border-l pl-4">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-semibold">
                {formatTokenCount(cumulativeUsage.totalTokens)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Total tokens: {cumulativeUsage.totalTokens.toLocaleString()}
          </TooltipContent>
        </Tooltip>
      </div>

      {showReset && hasUsage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1"
              onClick={resetUsage}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Reset token count</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
