import { useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex/convex/_generated/api";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Play, Loader2, ChevronDown, Clock, Wrench } from "lucide-react";
import { toast } from "sonner";

interface AgentRunHistoryProps {
  agentConfigId: Id<"lifeos_customAgentConfigs">;
}

export function AgentRunHistory({ agentConfigId }: AgentRunHistoryProps) {
  const runs = useQuery(api.lifeos.agents.getAgentRuns, { agentConfigId });
  const triggerRun = useAction(api.lifeos.agents.triggerAgentRun);
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const handleRunNow = async () => {
    setIsRunning(true);
    try {
      await triggerRun({
        agentConfigId,
        prompt: prompt || undefined,
      });
      toast.success("Agent run completed");
      setPrompt("");
    } catch (error) {
      toast.error(
        `Run failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsRunning(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "running":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return "...";
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Custom prompt (optional, uses agent instructions if empty)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isRunning && handleRunNow()}
        />
        <Button onClick={handleRunNow} disabled={isRunning}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Now
        </Button>
      </div>

      {!runs ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No runs yet. Click "Run Now" to execute this agent.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Trigger</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead className="w-[120px]">Time</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <Collapsible
                key={run._id}
                open={expandedRun === run._id}
                onOpenChange={(open) =>
                  setExpandedRun(open ? run._id : null)
                }
                asChild
              >
                <>
                  <CollapsibleTrigger asChild>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColor(run.status)}
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {run.trigger}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {run.prompt}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(run.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(run.startedAt, run.completedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            expandedRun === run._id ? "rotate-180" : ""
                          }`}
                        />
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="p-3 space-y-3">
                          {run.error && (
                            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
                              {run.error}
                            </div>
                          )}
                          {run.output && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Output
                              </p>
                              <div className="p-2 bg-background rounded border text-sm whitespace-pre-wrap max-h-60 overflow-auto">
                                {run.output}
                              </div>
                            </div>
                          )}
                          {run.toolCallLog &&
                            run.toolCallLog.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <Wrench className="h-3 w-3" />
                                  Tool Calls ({run.toolCallLog.length})
                                </p>
                                <div className="space-y-1">
                                  {run.toolCallLog.map((tc, i) => (
                                    <div
                                      key={i}
                                      className="p-2 bg-background rounded border text-xs"
                                    >
                                      <span className="font-mono font-medium text-primary">
                                        {tc.tool}
                                      </span>
                                      {tc.params && (
                                        <pre className="text-muted-foreground mt-1 overflow-auto max-h-20">
                                          {tc.params}
                                        </pre>
                                      )}
                                      {tc.result && (
                                        <pre className="text-green-400/80 mt-1 overflow-auto max-h-20">
                                          {tc.result}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
