import { useEffect, useState } from "react";
import { useClaudeCode } from "@/lib/contexts/ClaudeCodeContext";
import { PromptInput } from "./PromptInput";
import { ResultDisplay } from "./ResultDisplay";
import { MCPToolsList } from "./MCPToolsList";
import { ThreadSidebar } from "./ThreadSidebar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Terminal,
  AlertCircle,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Container,
  MessageSquare,
  Plus,
  MoreVertical,
  Server,
  Cloud,
} from "lucide-react";
import type { Environment } from "@/lib/services/claudecode";

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

// Default MCP config path - relative to monorepo
const DEFAULT_MCP_CONFIG_PATH =
  "/Users/bryanliu/Sync/00.Projects/holaai-convexo-monorepo/packages/claudecode-noncode-agent-docker/.mcp.json";

// Host types for future cloud support
type HostType = "local" | "cloud";

export function ClaudeCodeTab() {
  const {
    environment,
    containerStatus,
    isExecuting,
    jsonDebugMode,
    error,
    isDockerAvailable,
    isCheckingDocker,
    isStartingContainer,
    isStoppingContainer,
    isCreatingContainer,
    isRemovingContainer,
    activeThreadId,
    threads,
    setEnvironment,
    setJsonDebugMode,
    refreshContainerStatus,
    startContainerAction,
    stopContainerAction,
    createContainerAction,
    removeContainerAction,
    execute,
    clearResults,
    clearError,
    getActiveThreadResults,
  } = useClaudeCode();

  // Host selection (local vs cloud - cloud to be implemented later)
  const [hostType] = useState<HostType>("local");

  // Create container dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [mcpConfigPath, setMcpConfigPath] = useState(DEFAULT_MCP_CONFIG_PATH);

  // Remove container confirmation
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Get results for active thread only
  const activeResults = getActiveThreadResults();

  // Get active thread info
  const activeThread = threads.find((t) => t.id === activeThreadId);

  // Refresh container status periodically when executing
  useEffect(() => {
    if (isExecuting) {
      const interval = setInterval(refreshContainerStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isExecuting, refreshContainerStatus]);

  const handleCreateContainer = async () => {
    await createContainerAction(mcpConfigPath);
    setShowCreateDialog(false);
  };

  const handleRemoveContainer = async () => {
    await removeContainerAction();
    setShowRemoveConfirm(false);
  };

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
    <div className="h-full flex">
      {/* Thread Sidebar */}
      <ThreadSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal className="w-5 h-5 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold shrink-0">ClaudeCode</h1>
              {activeThread && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {activeThread.title}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {/* Host indicator */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {hostType === "local" ? (
                  <>
                    <Server className="w-3.5 h-3.5" />
                    <span>Local</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Cloud</span>
                  </>
                )}
              </div>

              {/* Environment selector */}
              <div className="flex items-center gap-2">
                <Label htmlFor="env-select" className="text-sm">
                  Env:
                </Label>
                <Select
                  value={environment}
                  onValueChange={(v) => setEnvironment(v as Environment)}
                >
                  <SelectTrigger id="env-select" className="w-24">
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
                  JSON:
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
              {/* Create container button - when container doesn't exist */}
              {!containerStatus?.exists && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowCreateDialog(true)}
                  disabled={isCreatingContainer}
                >
                  {isCreatingContainer ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      Create
                    </>
                  )}
                </Button>
              )}

              {/* Start button - when container exists but stopped */}
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

              {/* Stop button - when container is running */}
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

              {/* Refresh button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={refreshContainerStatus}
                title="Refresh status"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>

              {/* More options dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {activeResults.length > 0 && (
                    <>
                      <DropdownMenuItem onClick={clearResults}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {containerStatus?.exists && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setShowRemoveConfirm(true)}
                      disabled={containerStatus.running || isRemovingContainer}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Container
                    </DropdownMenuItem>
                  )}
                  {!containerStatus?.exists && (
                    <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Container
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-red-500/10 rounded-lg text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={clearError} className="text-xs hover:underline">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* MCP Tools collapsible */}
        <MCPToolsList />

        {/* Results area - show only active thread results */}
        {!activeThreadId && containerStatus?.running ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm p-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium mb-2">No Conversation Selected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select a conversation from the sidebar or start a new one to
                begin chatting with Claude.
              </p>
              <p className="text-xs text-muted-foreground">
                Tip: Type a message below to automatically create a new
                conversation.
              </p>
            </div>
          </div>
        ) : (
          <ResultDisplay results={activeResults} jsonDebugMode={jsonDebugMode} />
        )}

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
            Container{" "}
            <code className="font-mono">claude-agent-{environment}</code> not
            found. Click "Create" to set it up.
          </div>
        )}
      </div>

      {/* Create Container Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Container</DialogTitle>
            <DialogDescription>
              Create a new Claude agent container for the {environment}{" "}
              environment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mcp-path">MCP Config Path</Label>
              <Input
                id="mcp-path"
                value={mcpConfigPath}
                onChange={(e) => setMcpConfigPath(e.target.value)}
                placeholder="/path/to/.mcp.json"
              />
              <p className="text-xs text-muted-foreground">
                Path to the .mcp.json configuration file
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateContainer}
              disabled={isCreatingContainer || !mcpConfigPath}
            >
              {isCreatingContainer ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Container"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Container Confirmation Dialog */}
      <Dialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Container</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the container{" "}
              <code className="font-mono">claude-agent-{environment}</code>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveContainer}
              disabled={isRemovingContainer}
            >
              {isRemovingContainer ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Container"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
