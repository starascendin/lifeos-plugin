import { useState, useRef, useEffect, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { PMAIChatInput } from "./PMAIChatInput";
import { PMAIMessageBubble, type PMAIMessage } from "./PMAIMessageBubble";
import { usePM } from "@/lib/contexts/PMContext";
import { Bot, Sparkles, RefreshCw, History, ChevronDown, Info, FolderKanban, FileText, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const THREAD_STORAGE_KEY = "pm-ai-thread-id";

export function PMAITab() {
  const [threadId, setThreadId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(THREAD_STORAGE_KEY);
    }
    return null;
  });
  const [messages, setMessages] = useState<PMAIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createThread = useAction(api.lifeos.pm_ai.createThread);
  const sendMessageAction = useAction(api.lifeos.pm_ai.sendMessage);

  const threads = useQuery(api.lifeos.pm_ai.listThreads, { limit: 10 });
  const threadMessages = useQuery(
    api.lifeos.pm_ai.getThreadMessages,
    threadId ? { threadId } : "skip"
  );

  // PM Context for the info tooltip
  const { projects, currentCycle, issuesByStatus } = usePM();
  const totalIssueCount = issuesByStatus
    ? Object.values(issuesByStatus).reduce((sum, issues) => sum + issues.length, 0)
    : 0;

  useEffect(() => {
    if (threadId) {
      localStorage.setItem(THREAD_STORAGE_KEY, threadId);
    }
  }, [threadId]);

  useEffect(() => {
    if (threadMessages && threadMessages.length > 0 && !isLoadingHistory) {
      setIsLoadingHistory(true);
      const loadedMessages: PMAIMessage[] = threadMessages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolResults: msg.toolResults,
        createdAt: msg.createdAt,
      }));
      setMessages(loadedMessages);
      setIsLoadingHistory(false);
    }
  }, [threadMessages]);

  useEffect(() => {
    if (!threadId) {
      initThread();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initThread = async () => {
    try {
      const result = await createThread({});
      setThreadId(result.threadId);
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error("Failed to create thread:", err);
      setError("Failed to initialize chat. Please try again.");
    }
  };

  const switchThread = (newThreadId: string) => {
    setThreadId(newThreadId);
    setMessages([]);
  };

  const handleSend = useCallback(async (content: string) => {
    if (!threadId || isLoading) return;

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
      const response = await sendMessageAction({
        threadId,
        message: content,
      });

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
  }, [threadId, isLoading, sendMessageAction]);

  const handleNewConversation = async () => {
    localStorage.removeItem(THREAD_STORAGE_KEY);
    setMessages([]);
    setError(null);
    await initThread();
  };

  const formatThreadTitle = (thread: { title?: string; _creationTime: number }) => {
    if (thread.title && thread.title !== "PM Chat") {
      return thread.title;
    }
    return new Date(thread._creationTime).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">PM Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Manage projects and issues with AI
            </p>
          </div>

          {/* Context Info Tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
                  <Info className="h-4 w-4 mr-1" />
                  <span className="text-xs">
                    {projects?.length || 0} projects · {totalIssueCount} issues
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="w-72 p-0">
                <div className="p-3 space-y-3">
                  {/* Projects */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                      <FolderKanban className="h-3.5 w-3.5" />
                      Projects
                    </div>
                    {projects && projects.length > 0 ? (
                      <div className="space-y-1">
                        {projects.slice(0, 4).map((project) => (
                          <div key={project._id} className="flex items-center gap-2 text-sm">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: project.color || "#6366f1" }}
                            />
                            <span className="truncate">{project.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {project.issueCount || 0}
                            </span>
                          </div>
                        ))}
                        {projects.length > 4 && (
                          <div className="text-xs text-muted-foreground">
                            +{projects.length - 4} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No projects</div>
                    )}
                  </div>

                  {/* Active Cycle */}
                  {currentCycle && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                        <Timer className="h-3.5 w-3.5" />
                        Active Cycle
                      </div>
                      <div className="text-sm">
                        {currentCycle.name || `Cycle ${currentCycle.number}`}
                        <span className="text-xs text-muted-foreground ml-2">
                          {currentCycle.completedIssueCount || 0}/{currentCycle.issueCount || 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Issues Summary */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Issues by Status
                    </div>
                    {issuesByStatus && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(issuesByStatus).map(([status, issues]) => (
                          issues.length > 0 && (
                            <span key={status} className="px-1.5 py-0.5 bg-muted rounded">
                              {status.replace("_", " ")}: {issues.length}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1">
          {/* Thread History Dropdown */}
          {threads && threads.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <History className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {threads.map((thread) => (
                  <DropdownMenuItem
                    key={thread._id}
                    onClick={() => switchThread(thread._id)}
                    className={thread._id === threadId ? "bg-accent" : ""}
                  >
                    <span className="truncate">{formatThreadTitle(thread)}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleNewConversation}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  New Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewConversation}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !isLoadingHistory ? (
          <EmptyState onSuggestionClick={handleSend} />
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
  );
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    "What projects do I have?",
    "Show my high priority issues",
    "Create an issue for login bug",
    "Start a new 2-week sprint",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
        <Bot className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">PM Assistant</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Manage projects, create issues, and track cycles with AI
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((text) => (
          <button
            key={text}
            onClick={() => onSuggestionClick(text)}
            className="px-3 py-1.5 text-sm rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
