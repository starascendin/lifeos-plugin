import { useState } from "react";
import { ChevronDown, ChevronRight, User, Bot, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClaudeCodeResultEntry } from "@/lib/contexts/ClaudeCodeContext";

interface ResultDisplayProps {
  results: ClaudeCodeResultEntry[];
  jsonDebugMode: boolean;
}

function ResultEntry({
  entry,
  showJson,
}: {
  entry: ClaudeCodeResultEntry;
  showJson: boolean;
}) {
  const [isJsonExpanded, setIsJsonExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* User prompt */}
      <div className="flex items-start gap-3 p-3 bg-muted/30">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium">You</span>
            <span>•</span>
            <span>{entry.timestamp.toLocaleTimeString()}</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-xs">
              {entry.environment}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">
            {entry.prompt}
          </p>
        </div>
      </div>

      {/* AI response */}
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            entry.result.success ? "bg-green-500/10" : "bg-red-500/10"
          )}
        >
          {entry.result.success ? (
            <Bot className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium">Claude</span>
            {!entry.result.success && (
              <span className="text-red-500">Error</span>
            )}
          </div>

          {entry.result.success && entry.result.output ? (
            <pre className="text-sm whitespace-pre-wrap break-words font-mono bg-muted/50 p-3 rounded-md overflow-x-auto">
              {entry.result.output}
            </pre>
          ) : (
            <p className="text-sm text-red-500">
              {entry.result.error || "Unknown error"}
            </p>
          )}

          {/* JSON Debug section */}
          {showJson && entry.result.json_output && (
            <div className="mt-2">
              <button
                onClick={() => setIsJsonExpanded(!isJsonExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isJsonExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                JSON Debug Output
              </button>
              {isJsonExpanded && (
                <pre className="mt-2 text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-[300px] overflow-y-auto">
                  {(() => {
                    try {
                      return JSON.stringify(
                        JSON.parse(entry.result.json_output!),
                        null,
                        2
                      );
                    } catch {
                      return entry.result.json_output;
                    }
                  })()}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResultDisplay({ results, jsonDebugMode }: ResultDisplayProps) {
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No results yet</p>
          <p className="text-sm mt-1">Enter a prompt to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {results.map((entry) => (
        <ResultEntry key={entry.id} entry={entry} showJson={jsonDebugMode} />
      ))}
    </div>
  );
}
