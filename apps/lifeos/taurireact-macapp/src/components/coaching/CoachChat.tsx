/**
 * CoachChat - Interactive coaching chat UI
 *
 * Manages active sessions, message sending/receiving,
 * and session lifecycle (start/end with auto-summarization).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Doc } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { cn } from "@/lib/utils";
import {
  Send,
  Loader2,
  Play,
  Square,
  GraduationCap,
  Wrench,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface CoachChatProps {
  coachProfile: Doc<"lifeos_coachingProfiles">;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; args: unknown }>;
  toolResults?: Array<{ name: string; result: unknown }>;
  createdAt: number;
}

export function CoachChat({ coachProfile }: CoachChatProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [sessionId, setSessionId] =
    useState<Id<"lifeos_coachingSessions"> | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const activeSession = useQuery(api.lifeos.coaching.getActiveSession, {
    coachProfileId: coachProfile._id,
  });
  const sessionMessages = useQuery(
    api.lifeos.coaching.getSessionMessages,
    sessionId ? { sessionId } : "skip",
  );

  // Actions
  const startSession = useAction(api.lifeos.coaching.startSession);
  const sendMessage = useAction(api.lifeos.coaching.sendMessage);
  const endSession = useAction(api.lifeos.coaching.endSession);

  // Set session ID from active session
  useEffect(() => {
    if (activeSession) {
      setSessionId(activeSession._id);
    }
  }, [activeSession]);

  // Sync remote messages with local state
  useEffect(() => {
    if (sessionMessages && sessionMessages.length > 0) {
      const remote = sessionMessages.map((m) => ({
        id: m!.id,
        role: m!.role,
        content: m!.content,
        toolCalls: m!.toolCalls,
        toolResults: m!.toolResults,
        createdAt: m!.createdAt,
      }));
      setLocalMessages(remote);
    }
  }, [sessionMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isLoading]);

  const handleStartSession = useCallback(async () => {
    setIsStarting(true);
    try {
      const result = await startSession({
        coachProfileId: coachProfile._id,
      });
      setSessionId(result.sessionId);
      setLocalMessages([]);

      // Add greeting if profile has one
      if (coachProfile.greeting) {
        setLocalMessages([
          {
            id: "greeting",
            role: "assistant",
            content: coachProfile.greeting,
            createdAt: Date.now(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to start session:", error);
    } finally {
      setIsStarting(false);
    }
  }, [startSession, coachProfile]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsEnding(true);
    try {
      await endSession({ sessionId });
      setSessionId(null);
      setLocalMessages([]);
    } catch (error) {
      console.error("Failed to end session:", error);
    } finally {
      setIsEnding(false);
    }
  }, [endSession, sessionId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    setLocalMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: userMessage,
        createdAt: Date.now(),
      },
    ]);

    try {
      const result = await sendMessage({
        sessionId,
        message: userMessage,
      });

      // Add assistant response
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.text,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          createdAt: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Add error message
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to send message"}`,
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, sessionId, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasActiveSession = !!activeSession && activeSession.status === "active";

  return (
    <div className="flex flex-1 flex-col">
      {/* Chat header */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
          style={{
            backgroundColor: coachProfile.color
              ? `${coachProfile.color}20`
              : "hsl(var(--muted))",
          }}
        >
          {coachProfile.icon || <GraduationCap className="h-4 w-4" />}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{coachProfile.name}</h3>
          <p className="text-muted-foreground text-xs">
            {coachProfile.focusAreas.join(" / ")}
          </p>
        </div>
        {hasActiveSession ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEndSession}
            disabled={isEnding}
          >
            {isEnding ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Square className="mr-1.5 h-4 w-4" />
            )}
            End Session
          </Button>
        ) : (
          <Button size="sm" onClick={handleStartSession} disabled={isStarting}>
            {isStarting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            Start Session
          </Button>
        )}
      </div>

      {/* Messages area */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
          {!hasActiveSession && localMessages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <GraduationCap className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                <p className="font-medium">Ready for a coaching session?</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Click "Start Session" to begin a conversation with{" "}
                  {coachProfile.name}.
                </p>
                {coachProfile.sessionCadence && (
                  <Badge variant="outline" className="mt-2">
                    Suggested: {coachProfile.sessionCadence}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {localMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="rounded-lg bg-muted px-4 py-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input area */}
        {hasActiveSession && (
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[200px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="self-end"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ==================== MESSAGE BUBBLE ====================

function MessageBubble({ message }: { message: LocalMessage }) {
  const [showTools, setShowTools] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <GraduationCap className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} className="text-sm" />
        )}

        {/* Tool calls indicator */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 border-t border-border/30 pt-2">
            <button
              onClick={() => setShowTools(!showTools)}
              className="flex items-center gap-1 text-muted-foreground text-xs"
            >
              <Wrench className="h-3 w-3" />
              {message.toolCalls.length} tool
              {message.toolCalls.length !== 1 ? "s" : ""} used
              {showTools ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {showTools && (
              <div className="mt-1 space-y-1">
                {message.toolCalls.map((tc, i) => (
                  <Badge key={i} variant="secondary" className="mr-1 text-xs">
                    {tc.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
