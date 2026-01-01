import { useState } from "react";
import { Bot, Plus, Trash2, AlertCircle, Key, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AIAgentProvider, useAIAgent, AI_AGENT_MODELS } from "@/lib/contexts/AIAgentContext";
import { AIAgentChat } from "./AIAgentChat";
import { AIAgentInput } from "./AIAgentInput";
import { AIAgentModelSelector } from "./AIAgentModelSelector";
import { AIAgentTokenUsage } from "./AIAgentTokenUsage";

function AIAgentContent() {
  const {
    threadId,
    messages,
    isLoading,
    error,
    apiKey,
    selectedModelId,
    setApiKey,
    createThread,
    sendMessage,
    clearMessages,
    clearError,
  } = useAIAgent();

  const selectedModel = AI_AGENT_MODELS.find((m) => m.id === selectedModelId);

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const handleSaveApiKey = async () => {
    setApiKey(apiKeyInput);
    // Auto-create thread after saving API key, passing the key directly
    await createThread(apiKeyInput);
  };

  const handleStartConversation = async () => {
    clearMessages();
    await createThread();
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">AI Agent</h1>
            <p className="text-sm text-muted-foreground">
              Demo agent with tool use capabilities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {apiKey && (
            <>
              <AIAgentModelSelector disabled={isLoading} />
              <AIAgentTokenUsage compact />
            </>
          )}

          {apiKey && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Key className="h-3 w-3 mr-1" />
              API Key Set
            </Badge>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleStartConversation}
                disabled={isLoading || !apiKey}
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

      {/* API Key Input */}
      {!apiKey && (
        <Card className="p-4 mb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="api-key" className="text-sm font-medium">
                API Key Required
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the API key to authenticate with the demo agent HTTP endpoints.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Enter API key..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Hint: The default key is <code className="bg-muted px-1 rounded">demo-agent-secret-key-2024</code>
            </p>
          </div>
        </Card>
      )}

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
          <AIAgentChat messages={messages} isLoading={isLoading} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <AIAgentInput
            onSend={sendMessage}
            disabled={!threadId || isLoading || !apiKey}
            placeholder={
              !apiKey
                ? "Enter API key first..."
                : !threadId
                ? "Click + to start a conversation..."
                : "Ask me about weather, time, or math..."
            }
          />
        </div>
      </Card>

      {/* Footer Info */}
      <div className="mt-4 text-center text-xs text-muted-foreground">
        <p>
          Powered by <strong>Convex AI Agent</strong> via Vercel AI Gateway
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

export function AIAgentTab() {
  return (
    <AIAgentProvider>
      <AIAgentContent />
    </AIAgentProvider>
  );
}
