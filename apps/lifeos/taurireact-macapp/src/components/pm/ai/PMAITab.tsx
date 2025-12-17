import { useState, useRef, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@holaai/convex";
import { PMAIChatInput } from "./PMAIChatInput";
import { PMAIMessageBubble, type PMAIMessage } from "./PMAIMessageBubble";
import { PMAIContextSidebar } from "./PMAIContextSidebar";
import { Bot, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PMAITab() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PMAIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createThread = useAction(api.lifeos.pm_ai.createThread);
  const sendMessage = useAction(api.lifeos.pm_ai.sendMessage);

  // Initialize thread on mount
  useEffect(() => {
    initThread();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initThread = async () => {
    try {
      const result = await createThread({});
      setThreadId(result.threadId);
      setError(null);
    } catch (err) {
      console.error("Failed to create thread:", err);
      setError("Failed to initialize chat. Please try again.");
    }
  };

  const handleSend = useCallback(async (content: string) => {
    if (!threadId || isLoading) return;

    // Add user message
    const userMessage: PMAIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessage({
        threadId,
        message: content,
      });

      // Add assistant message
      const assistantMessage: PMAIMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.text,
        toolCalls: response.toolCalls,
        toolResults: response.toolResults,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Failed to send message:", err);
      // Add error message
      const errorMessage: PMAIMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        error: err instanceof Error ? err.message : "Unknown error",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [threadId, isLoading, sendMessage]);

  const handleNewConversation = async () => {
    setMessages([]);
    setError(null);
    await initThread();
  };

  return (
    <div className="flex h-full">
      {/* Context Sidebar */}
      <PMAIContextSidebar />

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">PM Assistant</h2>
              <p className="text-xs text-muted-foreground">
                Manage projects and issues with AI
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewConversation}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message) => (
                <PMAIMessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Input */}
        <PMAIChatInput
          onSend={handleSend}
          isLoading={isLoading}
          disabled={!threadId}
        />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">PM Assistant</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        I can help you manage your projects, create issues, track cycles, and more.
        Just ask!
      </p>
      <div className="grid gap-2 text-sm">
        <SuggestionChip text="Create a new project called 'Mobile App'" />
        <SuggestionChip text="Add an urgent bug for the login page" />
        <SuggestionChip text="Show all my high priority issues" />
        <SuggestionChip text="Start a new 2-week sprint" />
      </div>
    </div>
  );
}

function SuggestionChip({ text }: { text: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors text-left">
      <span className="text-muted-foreground">&quot;</span>
      {text}
      <span className="text-muted-foreground">&quot;</span>
    </div>
  );
}
