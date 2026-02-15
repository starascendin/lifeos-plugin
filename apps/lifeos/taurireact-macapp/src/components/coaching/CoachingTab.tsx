/**
 * CoachingTab - Main coaching container
 *
 * Mobile: Full-screen views. Coach picker -> tapping a coach goes full-screen into chat.
 *         Back button to return to coach picker.
 * Desktop: Single-panel with coach switcher dropdown in header bar.
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Plus,
  GraduationCap,
  MessageSquare,
  History,
  CheckSquare,
  Settings2,
  ChevronLeft,
  ChevronDown,
  SquarePen,
} from "lucide-react";
import { CoachChat } from "./CoachChat";
import { CoachProfileEditor } from "./CoachProfileEditor";
import { CoachSessionHistory } from "./CoachSessionHistory";
import { CoachActionItems } from "./CoachActionItems";

type View = "chat" | "history" | "actions";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export function CoachingTab() {
  const profiles = useQuery(api.lifeos.coaching.getCoachProfiles) ?? [];
  const actionItemCounts =
    useQuery(api.lifeos.coaching.getActionItemCounts) ?? {};
  const isDesktop = useIsDesktop();

  const [selectedProfileId, setSelectedProfileId] =
    useState<Id<"lifeos_coachingProfiles"> | null>(null);
  const [view, setView] = useState<View>("chat");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingProfileId, setEditingProfileId] =
    useState<Id<"lifeos_coachingProfiles"> | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const endSessionAction = useAction(api.lifeos.coaching.endSession);

  const selectedProfile = profiles.find((p) => p._id === selectedProfileId);

  // Auto-select first profile on desktop
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (
      isDesktop &&
      !selectedProfileId &&
      profiles.length > 0 &&
      !showProfileEditor &&
      !hasAutoSelected.current
    ) {
      setSelectedProfileId(profiles[0]._id);
      hasAutoSelected.current = true;
    }
  }, [isDesktop, selectedProfileId, profiles, showProfileEditor]);

  const handleSelectCoach = (id: Id<"lifeos_coachingProfiles">) => {
    setSelectedProfileId(id);
    setShowProfileEditor(false);
    setView("chat");
    setChatKey((k) => k + 1);
  };

  const handleBack = () => {
    setSelectedProfileId(null);
    setShowProfileEditor(false);
    hasAutoSelected.current = true;
  };

  const activeSession = useQuery(
    api.lifeos.coaching.getActiveSession,
    selectedProfileId ? { coachProfileId: selectedProfileId } : "skip",
  );

  const handleNewChat = async () => {
    if (activeSession && activeSession.status === "active") {
      try {
        await endSessionAction({ sessionId: activeSession._id });
      } catch (e) {
        console.error("Failed to end session for new chat:", e);
      }
    }
    setChatKey((k) => k + 1);
  };

  // ─── DESKTOP LAYOUT ───
  if (isDesktop) {
    // Profile editor view
    if (showProfileEditor) {
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2"
              onClick={() => {
                setShowProfileEditor(false);
                if (!selectedProfileId && profiles.length > 0) {
                  setSelectedProfileId(profiles[0]._id);
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <span className="text-sm font-medium">
              {editingProfileId ? "Edit Coach" : "New Coach"}
            </span>
          </div>
          <div className="flex-1 overflow-auto px-4 py-4">
            <div className="mx-auto max-w-xl">
              <CoachProfileEditor
                profileId={editingProfileId}
                onSave={() => {
                  setShowProfileEditor(false);
                  if (!selectedProfileId && profiles.length > 0) {
                    setSelectedProfileId(profiles[0]._id);
                  }
                }}
                onCancel={() => {
                  setShowProfileEditor(false);
                  if (!selectedProfileId && profiles.length > 0) {
                    setSelectedProfileId(profiles[0]._id);
                  }
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    // No coach selected + no profiles
    if (!selectedProfile && profiles.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center">
          <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            No coaches yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create your first coach to start a session.
          </p>
          <Button
            className="mt-4"
            size="sm"
            onClick={() => {
              setEditingProfileId(null);
              setShowProfileEditor(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create Coach
          </Button>
        </div>
      );
    }

    // Main desktop view with coach selected
    return (
      <div className="flex h-full flex-col">
        {/* Header bar */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          {/* Coach switcher dropdown */}
          <CoachSwitcher
            profiles={profiles}
            actionItemCounts={actionItemCounts}
            selectedProfile={selectedProfile ?? null}
            onSelectCoach={handleSelectCoach}
            onNewCoach={() => {
              setEditingProfileId(null);
              setShowProfileEditor(true);
            }}
          />

          {/* View tabs */}
          {selectedProfile && (
            <>
              <div className="mx-1.5 h-5 w-px bg-border" />
              <DesktopViewTabs view={view} onViewChange={setView} />
            </>
          )}

          <div className="flex-1" />

          {/* Actions */}
          {selectedProfile && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() => {
                  handleNewChat();
                  setView("chat");
                }}
              >
                <SquarePen className="h-3.5 w-3.5" />
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditingProfileId(selectedProfileId);
                  setShowProfileEditor(true);
                }}
                title="Coach settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {selectedProfile ? (
            <>
              {view === "chat" && (
                <CoachChat key={chatKey} coachProfile={selectedProfile} />
              )}
              {view === "history" && (
                <CoachSessionHistory
                  coachProfileId={selectedProfile._id}
                  coachName={selectedProfile.name}
                />
              )}
              {view === "actions" && (
                <CoachActionItems
                  coachProfileId={selectedProfile._id}
                  coachName={selectedProfile.name}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  Select a coach to start
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MOBILE LAYOUT ───

  if (showProfileEditor) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowProfileEditor(false)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium">
            {editingProfileId ? "Edit Coach" : "New Coach"}
          </span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <CoachProfileEditor
            profileId={editingProfileId}
            onSave={() => setShowProfileEditor(false)}
            onCancel={() => setShowProfileEditor(false)}
          />
        </div>
      </div>
    );
  }

  if (selectedProfile) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-sm"
            style={{
              backgroundColor: selectedProfile.color
                ? `${selectedProfile.color}20`
                : "hsl(var(--muted))",
            }}
          >
            {selectedProfile.icon || (
              <GraduationCap className="h-3.5 w-3.5" />
            )}
          </div>
          <span className="min-w-0 truncate text-sm font-medium">
            {selectedProfile.name}
          </span>
          <div className="flex-1" />
          <MobileViewTabs
            view={view}
            onViewChange={setView}
            onNewChat={handleNewChat}
            onSettings={() => {
              setEditingProfileId(selectedProfileId);
              setShowProfileEditor(true);
            }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "chat" && (
            <CoachChat key={chatKey} coachProfile={selectedProfile} />
          )}
          {view === "history" && (
            <CoachSessionHistory
              coachProfileId={selectedProfile._id}
              coachName={selectedProfile.name}
            />
          )}
          {view === "actions" && (
            <CoachActionItems
              coachProfileId={selectedProfile._id}
              coachName={selectedProfile.name}
            />
          )}
        </div>
      </div>
    );
  }

  // Mobile: Coach picker
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold">AI Coaches</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingProfileId(null);
            setShowProfileEditor(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No coaches yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a coach to start your first session.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditingProfileId(null);
                setShowProfileEditor(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create Coach
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {profiles.map((profile) => {
            const pendingCount = actionItemCounts[profile._id] || 0;
            return (
              <button
                key={profile._id}
                onClick={() => handleSelectCoach(profile._id)}
                className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors active:bg-muted/50"
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{
                    backgroundColor: profile.color
                      ? `${profile.color}20`
                      : "hsl(var(--muted))",
                  }}
                >
                  {profile.icon || <GraduationCap className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{profile.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {profile.focusAreas.slice(0, 3).join(", ")}
                  </p>
                </div>
                {pendingCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="flex-shrink-0 text-xs"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Coach Switcher (desktop dropdown) ───

function CoachSwitcher({
  profiles,
  actionItemCounts,
  selectedProfile,
  onSelectCoach,
  onNewCoach,
}: {
  profiles: Array<{
    _id: Id<"lifeos_coachingProfiles">;
    name: string;
    icon?: string;
    color?: string;
    focusAreas: string[];
  }>;
  actionItemCounts: Record<string, number>;
  selectedProfile: {
    _id: Id<"lifeos_coachingProfiles">;
    name: string;
    icon?: string;
    color?: string;
    focusAreas: string[];
  } | null;
  onSelectCoach: (id: Id<"lifeos_coachingProfiles">) => void;
  onNewCoach: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2.5">
          {selectedProfile ? (
            <>
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs"
                style={{
                  backgroundColor: selectedProfile.color
                    ? `${selectedProfile.color}20`
                    : "hsl(var(--muted))",
                }}
              >
                {selectedProfile.icon || (
                  <GraduationCap className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="text-sm font-medium">
                {selectedProfile.name}
              </span>
            </>
          ) : (
            <>
              <GraduationCap className="h-4 w-4" />
              <span className="text-sm">Select coach</span>
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {profiles.map((profile) => {
          const pendingCount = actionItemCounts[profile._id] || 0;
          return (
            <DropdownMenuItem
              key={profile._id}
              onClick={() => onSelectCoach(profile._id)}
              className={cn(
                "gap-2.5",
                selectedProfile?._id === profile._id && "bg-accent",
              )}
            >
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs"
                style={{
                  backgroundColor: profile.color
                    ? `${profile.color}20`
                    : "hsl(var(--muted))",
                }}
              >
                {profile.icon || <GraduationCap className="h-3.5 w-3.5" />}
              </div>
              <span className="flex-1 truncate">{profile.name}</span>
              {pendingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto px-1.5 text-[10px]"
                >
                  {pendingCount}
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
        {profiles.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onNewCoach} className="gap-2.5">
          <Plus className="h-4 w-4" />
          <span>New Coach</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Desktop View Tabs ───

function DesktopViewTabs({
  view,
  onViewChange,
}: {
  view: View;
  onViewChange: (v: View) => void;
}) {
  const tabs: { key: View; icon: typeof MessageSquare; label: string }[] = [
    { key: "chat", icon: MessageSquare, label: "Chat" },
    { key: "history", icon: History, label: "Sessions" },
    { key: "actions", icon: CheckSquare, label: "Actions" },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {tabs.map(({ key, icon: Icon, label }) => (
        <Button
          key={key}
          variant={view === key ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => onViewChange(key)}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}

// ─── Mobile View Tabs (icon only) ───

function MobileViewTabs({
  view,
  onViewChange,
  onNewChat,
  onSettings,
}: {
  view: View;
  onViewChange: (v: View) => void;
  onNewChat: () => void;
  onSettings: () => void;
}) {
  const tabs: { key: View; icon: typeof MessageSquare; label: string }[] = [
    { key: "chat", icon: MessageSquare, label: "Chat" },
    { key: "history", icon: History, label: "Sessions" },
    { key: "actions", icon: CheckSquare, label: "Actions" },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {tabs.map(({ key, icon: Icon }) => (
        <Button
          key={key}
          variant={view === key ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 px-0"
          onClick={() => onViewChange(key)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 px-0"
        onClick={() => {
          onNewChat();
          onViewChange("chat");
        }}
        title="New chat"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 px-0"
        onClick={onSettings}
      >
        <Settings2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
