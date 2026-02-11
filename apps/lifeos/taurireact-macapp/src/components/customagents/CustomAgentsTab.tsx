import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex/convex/_generated/api";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Bot,
  Wrench,
  Clock,
  Calendar,
  Loader2,
} from "lucide-react";
import { AgentEditor, type AgentConfig } from "./AgentEditor";

type View =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; agentId: Id<"lifeos_customAgentConfigs"> };

export function CustomAgentsTab() {
  const agents = useQuery(api.lifeos.agents.getAgentConfigs);
  const [view, setView] = useState<View>({ mode: "list" });

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (view.mode === "create") {
    return (
      <AgentEditor
        onBack={() => setView({ mode: "list" })}
        onSaved={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "edit") {
    const agent = agents?.find((a) => a._id === view.agentId);
    if (!agent) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading...
        </div>
      );
    }
    return (
      <AgentEditor
        agent={agent as AgentConfig}
        onBack={() => setView({ mode: "list" })}
        onSaved={() => setView({ mode: "list" })}
      />
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom AI Agents</h2>
          <p className="text-sm text-muted-foreground">
            Configure AI agents with specific tools and optional cron scheduling
          </p>
        </div>
        <Button onClick={() => setView({ mode: "create" })}>
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {!agents ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-muted-foreground" />
          <span className="text-muted-foreground">Loading agents...</span>
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No agents yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Create your first custom AI agent with a specific set of LifeOS
              tools and optional scheduled runs.
            </p>
            <Button onClick={() => setView({ mode: "create" })}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card
              key={agent._id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() =>
                setView({ mode: "edit", agentId: agent._id })
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    {agent.name}
                  </CardTitle>
                  {agent.cronEnabled && (
                    <Badge
                      variant="outline"
                      className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Scheduled
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {agent.instructions.slice(0, 120)}
                  {agent.instructions.length > 120 && "..."}
                </p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {agent.enabledTools.length} tools
                  </span>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {agent.model.split("/")[1]}
                  </Badge>
                </div>

                {agent.lastRunAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last run: {formatTime(agent.lastRunAt)}
                  </div>
                )}

                {agent.cronEnabled && agent.cronSchedule && (
                  <div className="text-xs text-muted-foreground font-mono">
                    {agent.cronSchedule}{" "}
                    {agent.cronTimezone && `(${agent.cronTimezone})`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
