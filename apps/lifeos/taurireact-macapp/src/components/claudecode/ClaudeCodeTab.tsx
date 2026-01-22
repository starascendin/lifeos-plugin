import { useEffect } from "react";
import { useClaudeCode } from "@/lib/contexts/ClaudeCodeContext";
import { PromptInput } from "./PromptInput";
import { ResultDisplay } from "./ResultDisplay";
import { MCPToolsList } from "./MCPToolsList";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Terminal,
  AlertCircle,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Container,
} from "lucide-react";
import type { Environment } from "@/lib/services/claudecode";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export function ClaudeCodeTab() {
  const {
    environment,
    containerStatus,
    isExecuting,
    results,
    jsonDebugMode,
    error,
    isDockerAvailable,
    isCheckingDocker,
    isStartingContainer,
    isStoppingContainer,
    setEnvironment,
    setJsonDebugMode,
    refreshContainerStatus,
    startContainerAction,
    stopContainerAction,
    execute,
    clearResults,
    clearError,
  } = useClaudeCode();

  // Refresh container status periodically when executing
  useEffect(() => {
    if (isExecuting) {
      const interval = setInterval(refreshContainerStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isExecuting, refreshContainerStatus]);

  // Not available in web mode
  if (!isTauri) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Not Available in Web Mode</h2>
          <p className="text-muted-foreground">
            ClaudeCode requires Docker and is only available in the Tauri
            desktop app. Please use the native app to access this feature.
          </p>
        </div>
      </div>
    );
  }

  // Checking Docker
  if (isCheckingDocker) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Checking Docker availability...</p>
        </div>
      </div>
    );
  }

  // Docker not available
  if (isDockerAvailable === false) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Docker Not Available</h2>
          <p className="text-muted-foreground mb-4">
            Docker is required to run ClaudeCode. Please make sure Docker
            Desktop is installed and running.
          </p>
          <Button variant="outline" onClick={refreshContainerStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  const canExecute =
    containerStatus?.running && !isExecuting && !isStartingContainer;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">ClaudeCode</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Environment selector */}
            <div className="flex items-center gap-2">
              <Label htmlFor="env-select" className="text-sm">
                Environment:
              </Label>
              <Select
                value={environment}
                onValueChange={(v) => setEnvironment(v as Environment)}
              >
                <SelectTrigger id="env-select" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">dev</SelectItem>
                  <SelectItem value="staging">staging</SelectItem>
                  <SelectItem value="prod">prod</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* JSON Debug toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="json-toggle" className="text-sm">
                JSON Debug:
              </Label>
              <Switch
                id="json-toggle"
                checked={jsonDebugMode}
                onCheckedChange={setJsonDebugMode}
              />
            </div>
          </div>
        </div>

        {/* Container status bar */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Container className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Container:{" "}
              <span className="font-mono text-xs">
                {containerStatus?.name || `claude-agent-${environment}`}
              </span>
            </span>
            {containerStatus?.exists ? (
              containerStatus.running ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-600">
                  Running
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-600">
                  Stopped
                </span>
              )
            ) : (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-600">
                Not Found
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {containerStatus?.exists && !containerStatus.running && (
              <Button
                size="sm"
                variant="outline"
                onClick={startContainerAction}
                disabled={isStartingContainer}
              >
                {isStartingContainer ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    Start
                  </>
                )}
              </Button>
            )}

            {containerStatus?.running && (
              <Button
                size="sm"
                variant="outline"
                onClick={stopContainerAction}
                disabled={isStoppingContainer || isExecuting}
              >
                {isStoppingContainer ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="w-3 h-3 mr-1" />
                    Stop
                  </>
                )}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={refreshContainerStatus}
              title="Refresh status"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>

            {results.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearResults}
                title="Clear history"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-red-500/10 rounded-lg text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={clearError}
              className="text-xs hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* MCP Tools collapsible */}
      <MCPToolsList />

      {/* Results area */}
      <ResultDisplay results={results} jsonDebugMode={jsonDebugMode} />

      {/* Prompt input */}
      <PromptInput
        onSubmit={execute}
        isExecuting={isExecuting}
        disabled={!canExecute}
      />

      {/* Help text when container not running */}
      {!containerStatus?.running && containerStatus?.exists && (
        <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
          Start the container to execute prompts
        </div>
      )}

      {!containerStatus?.exists && (
        <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
          Container <code className="font-mono">claude-agent-{environment}</code>{" "}
          not found. Please create it first using Docker.
        </div>
      )}
    </div>
  );
}
