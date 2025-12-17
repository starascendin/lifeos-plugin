import { cn } from "@/lib/utils";
import { Check, AlertCircle, Wrench } from "lucide-react";

export interface ToolCall {
  name: string;
  args: unknown;
}

export interface ToolResult {
  name: string;
  result: unknown;
}

export interface PMAIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  error?: string;
  createdAt: number;
}

interface PMAIMessageBubbleProps {
  message: PMAIMessage;
}

export function PMAIMessageBubble({ message }: PMAIMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words text-sm">
          {message.content}
        </div>

        {/* Error indicator */}
        {message.error && (
          <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            {message.error}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "text-xs mt-1",
            isUser ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>

      {/* Tool calls/results (for assistant messages) */}
      {!isUser && message.toolResults && message.toolResults.length > 0 && (
        <div className="max-w-[85%] space-y-1">
          {message.toolResults.map((tr, idx) => (
            <ToolResultBadge key={idx} toolResult={tr} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolResultBadge({ toolResult }: { toolResult: ToolResult }) {
  const result = toolResult.result as { success?: boolean; message?: string; issueId?: string; identifier?: string; projectId?: string; cycleId?: string; labelId?: string };
  const isSuccess = result?.success !== false;

  // Get a friendly label for the tool
  const toolLabels: Record<string, string> = {
    create_issue: "Created Issue",
    update_issue: "Updated Issue",
    delete_issue: "Deleted Issue",
    list_issues: "Listed Issues",
    create_project: "Created Project",
    update_project: "Updated Project",
    list_projects: "Listed Projects",
    archive_project: "Archived Project",
    create_cycle: "Created Cycle",
    update_cycle: "Updated Cycle",
    delete_cycle: "Deleted Cycle",
    list_cycles: "Listed Cycles",
    create_label: "Created Label",
    list_labels: "Listed Labels",
    get_pm_context: "Got Context",
  };

  const label = toolLabels[toolResult.name] || toolResult.name;

  // Get identifier if available
  const identifier = result?.identifier || result?.issueId || result?.projectId || result?.cycleId || result?.labelId;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        isSuccess
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400"
      )}
    >
      {isSuccess ? (
        <Check className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      <Wrench className="h-3 w-3" />
      <span>{label}</span>
      {identifier && (
        <span className="font-mono opacity-75">
          {typeof identifier === "string" && identifier.includes("-")
            ? identifier
            : `#${identifier}`}
        </span>
      )}
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
