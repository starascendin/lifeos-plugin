/**
 * CoachChat - Full-bleed chat UI (no wrapping Card).
 *
 * iMessage-like: messages fill the space, input pinned to bottom
 * with safe-area-bottom for iOS. No unnecessary chrome.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Doc } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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

  const activeSession = useQuery(api.lifeos.coaching.getActiveSession, {
    coachProfileId: coachProfile._id,
  });
  const sessionMessages = useQuery(
    api.lifeos.coaching.getSessionMessages,
    sessionId ? { sessionId } : "skip",
  );

  const startSessionAction = useAction(api.lifeos.coaching.startSession);
  const sendMessageAction = useAction(api.lifeos.coaching.sendMessage);
  const endSessionAction = useAction(api.lifeos.coaching.endSession);

  useEffect(() => {
    if (activeSession) {
      setSessionId(activeSession._id);
    }
  }, [activeSession]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, isLoading]);

  const handleStartSession = useCallback(async () => {
    setIsStarting(true);
    try {
      const result = await startSessionAction({
        coachProfileId: coachProfile._id,
      });
      setSessionId(result.sessionId);
      setLocalMessages([]);
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
  }, [startSessionAction, coachProfile]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsEnding(true);
    try {
      await endSessionAction({ sessionId });
      setSessionId(null);
      setLocalMessages([]);
    } catch (error) {
      console.error("Failed to end session:", error);
    } finally {
      setIsEnding(false);
    }
  }, [endSessionAction, sessionId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !sessionId || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const tempId = `temp-${Date.now()}`;
    setLocalMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: userMessage, createdAt: Date.now() },
    ]);

    try {
      const result = await sendMessageAction({
        sessionId,
        message: userMessage,
      });
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
  }, [input, sessionId, isLoading, sendMessageAction]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasActiveSession = !!activeSession && activeSession.status === "active";

  return (
    <div className="flex flex-1 flex-col">
      {/* ─── Empty state / start session ─── */}
      {!hasActiveSession && localMessages.length === 0 && (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl"
              style={{
                backgroundColor: coachProfile.color
                  ? `${coachProfile.color}20`
                  : "hsl(var(--muted))",
              }}
            >
              {coachProfile.icon || (
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <p className="font-medium">{coachProfile.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {coachProfile.focusAreas.slice(0, 3).join(" / ")}
            </p>
            {coachProfile.sessionCadence && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Suggested: {coachProfile.sessionCadence}
              </p>
            )}
            <Button
              className="mt-5"
              onClick={handleStartSession}
              disabled={isStarting}
            >
              {isStarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Session
            </Button>
          </div>
        </div>
      )}

      {/* ─── Messages ─── */}
      {(hasActiveSession || localMessages.length > 0) && (
        <>
          {/* End session bar */}
          {hasActiveSession && (
            <div className="flex items-center justify-end px-3 py-1.5 md:px-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleEndSession}
                disabled={isEnding}
              >
                {isEnding ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="mr-1.5 h-3.5 w-3.5" />
                )}
                End Session
              </Button>
            </div>
          )}

          {/* Scrollable messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 md:px-4 md:py-3">
            <div className="mx-auto max-w-2xl space-y-4">
              {localMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ─── Input ─── */}
          {hasActiveSession && (
            <div className="border-t bg-background px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2 md:px-4 md:pb-3 md:pt-3">
              <div className="mx-auto flex max-w-2xl gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="min-h-[44px] max-h-[120px] resize-none rounded-xl text-base md:min-h-[44px] md:max-h-[200px] md:text-sm"
                  disabled={isLoading}
                  rows={1}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[44px] w-[44px] flex-shrink-0 rounded-xl"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Message Bubble ───

function MessageBubble({ message }: { message: LocalMessage }) {
  const [showTools, setShowTools] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <GraduationCap className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 md:max-w-[75%]",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted",
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} className="text-sm" />
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 border-t border-border/20 pt-1.5">
            <button
              onClick={() => setShowTools(!showTools)}
              className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground"
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
              <div className="mt-1 flex flex-wrap gap-1">
                {message.toolCalls.map((tc, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
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
