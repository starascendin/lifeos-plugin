import { Cat, Plus, Trash2, AlertCircle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CatGirlProvider, useCatGirl, CATGIRL_MODELS } from "@/lib/contexts/CatGirlContext";
import { CatGirlChat } from "./CatGirlChat";
import { CatGirlInput } from "./CatGirlInput";
import { CatGirlModelSelector } from "./CatGirlModelSelector";

function TokenUsageDisplay() {
  const { cumulativeUsage } = useCatGirl();

  if (cumulativeUsage.totalTokens === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded bg-muted">
          <Coins className="h-3 w-3" />
          <span>{cumulativeUsage.totalTokens.toLocaleString()}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-0.5">
          <div>Prompt: {cumulativeUsage.promptTokens.toLocaleString()}</div>
          <div>Completion: {cumulativeUsage.completionTokens.toLocaleString()}</div>
          <div className="font-medium">Total: {cumulativeUsage.totalTokens.toLocaleString()}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function CatGirlContent() {
  const {
    threadId,
    messages,
    isLoading,
    error,
    selectedModelId,
    sendMessage,
    clearMessages,
    clearError,
  } = useCatGirl();

  const selectedModel = CATGIRL_MODELS.find((m) => m.id === selectedModelId);

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900">
            <Cat className="h-5 w-5 text-pink-600 dark:text-pink-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">CatGirlAI</h1>
            <p className="text-sm text-muted-foreground">
              Your LifeOS assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CatGirlModelSelector disabled={isLoading} />
          <TokenUsageDisplay />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={clearMessages}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Conversation</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={clearMessages}
                disabled={messages.length === 0 || isLoading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear Messages</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <CatGirlChat messages={messages} isLoading={isLoading} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <CatGirlInput
            onSend={sendMessage}
            disabled={!threadId || isLoading}
            placeholder={
              !threadId
                ? "Initializing..."
                : "Ask about your projects, tasks, or contacts..."
            }
          />
        </div>
      </Card>

      {/* Footer Info */}
      <div className="mt-4 text-center text-xs text-muted-foreground">
        <p>
          Powered by <strong>Convex AI Agent</strong>
        </p>
        <p className="mt-1">
          Model:{" "}
          <code className="bg-muted px-1 rounded">
            {selectedModel?.name || selectedModelId}
          </code>
        </p>
      </div>
    </div>
  );
}

export function CatGirlTab() {
  return (
    <CatGirlProvider>
      <CatGirlContent />
    </CatGirlProvider>
  );
}
