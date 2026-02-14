/**
 * CoachingTab - Main coaching container
 *
 * Mobile: Full-screen views. Coach picker -> tapping a coach goes full-screen into chat.
 *         Back button to return to coach picker.
 * Desktop: Left sidebar (coach list) + center content area.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  GraduationCap,
  MessageSquare,
  History,
  CheckSquare,
  Settings2,
  ChevronLeft,
} from "lucide-react";
import { CoachChat } from "./CoachChat";
import { CoachProfileEditor } from "./CoachProfileEditor";
import { CoachSessionHistory } from "./CoachSessionHistory";
import { CoachActionItems } from "./CoachActionItems";

type View = "chat" | "history" | "actions";

export function CoachingTab() {
  const profiles = useQuery(api.lifeos.coaching.getCoachProfiles) ?? [];
  const actionItemCounts =
    useQuery(api.lifeos.coaching.getActionItemCounts) ?? {};

  const [selectedProfileId, setSelectedProfileId] =
    useState<Id<"lifeos_coachingProfiles"> | null>(null);
  const [view, setView] = useState<View>("chat");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingProfileId, setEditingProfileId] =
    useState<Id<"lifeos_coachingProfiles"> | null>(null);

  const selectedProfile = profiles.find((p) => p._id === selectedProfileId);

  // Auto-select first profile on desktop (don't auto-select on mobile — let user tap)
  if (!selectedProfileId && profiles.length > 0 && !showProfileEditor) {
    setSelectedProfileId(profiles[0]._id);
  }

  const handleSelectCoach = (id: Id<"lifeos_coachingProfiles">) => {
    setSelectedProfileId(id);
    setShowProfileEditor(false);
    setView("chat");
  };

  const handleBack = () => {
    setSelectedProfileId(null);
    setShowProfileEditor(false);
  };

  // ─── MOBILE: Full-screen profile editor ───
  if (showProfileEditor) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
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
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row md:gap-4 md:p-6">
          {/* Desktop sidebar still visible */}
          <div className="hidden md:block">
            <CoachSidebar
              profiles={profiles}
              actionItemCounts={actionItemCounts}
              selectedProfileId={selectedProfileId}
              showProfileEditor={showProfileEditor}
              onSelectCoach={handleSelectCoach}
              onNewCoach={() => {
                setEditingProfileId(null);
                setShowProfileEditor(true);
              }}
            />
          </div>
          <div className="flex-1 overflow-auto p-3 md:p-0">
            <CoachProfileEditor
              profileId={editingProfileId}
              onSave={() => setShowProfileEditor(false)}
              onCancel={() => setShowProfileEditor(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── MOBILE: Full-screen coach detail (chat/history/actions) ───
  if (selectedProfile) {
    return (
      <div className="flex h-full flex-col md:flex-row md:gap-4 md:p-6">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <CoachSidebar
            profiles={profiles}
            actionItemCounts={actionItemCounts}
            selectedProfileId={selectedProfileId}
            showProfileEditor={false}
            onSelectCoach={handleSelectCoach}
            onNewCoach={() => {
              setEditingProfileId(null);
              setShowProfileEditor(true);
            }}
          />
        </div>

        {/* Content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Mobile coach header with back + tabs */}
          <div className="flex items-center gap-1 border-b px-2 py-1.5 md:hidden">
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
            <ViewTabs
              view={view}
              onViewChange={setView}
              onSettings={() => {
                setEditingProfileId(selectedProfileId);
                setShowProfileEditor(true);
              }}
            />
          </div>

          {/* Desktop tabs */}
          <div className="mb-3 hidden items-center gap-1 border-b pb-2 md:flex">
            <ViewTabs
              view={view}
              onViewChange={setView}
              onSettings={() => {
                setEditingProfileId(selectedProfileId);
                setShowProfileEditor(true);
              }}
              showLabels
            />
          </div>

          {/* View content */}
          <div className="flex min-h-0 flex-1 flex-col">
            {view === "chat" && <CoachChat coachProfile={selectedProfile} />}
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
      </div>
    );
  }

  // ─── No coach selected (or mobile coach picker) ───
  return (
    <div className="flex h-full flex-col md:flex-row md:gap-4 md:p-6">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <CoachSidebar
          profiles={profiles}
          actionItemCounts={actionItemCounts}
          selectedProfileId={selectedProfileId}
          showProfileEditor={false}
          onSelectCoach={handleSelectCoach}
          onNewCoach={() => {
            setEditingProfileId(null);
            setShowProfileEditor(true);
          }}
        />
      </div>

      {/* Mobile: full-screen coach picker */}
      <div className="flex flex-1 flex-col md:hidden">
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

      {/* Desktop: empty state in center */}
      <div className="hidden flex-1 items-center justify-center md:flex">
        <div className="text-center">
          <GraduationCap className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">AI Coaching</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a coach to start a session, or create a new one.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar (desktop only) ───

function CoachSidebar({
  profiles,
  actionItemCounts,
  selectedProfileId,
  showProfileEditor,
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
  selectedProfileId: Id<"lifeos_coachingProfiles"> | null;
  showProfileEditor: boolean;
  onSelectCoach: (id: Id<"lifeos_coachingProfiles">) => void;
  onNewCoach: () => void;
}) {
  return (
    <div className="w-56 flex-shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Coaches
        </h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onNewCoach}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {profiles.map((profile) => {
          const pendingCount = actionItemCounts[profile._id] || 0;
          const isSelected =
            selectedProfileId === profile._id && !showProfileEditor;
          return (
            <button
              key={profile._id}
              onClick={() => onSelectCoach(profile._id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/50",
              )}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                style={{
                  backgroundColor: profile.color
                    ? `${profile.color}20`
                    : "hsl(var(--muted))",
                }}
              >
                {profile.icon || <GraduationCap className="h-4 w-4" />}
              </div>
              <span className="min-w-0 truncate">{profile.name}</span>
              {pendingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-auto flex-shrink-0 text-[10px] px-1.5"
                >
                  {pendingCount}
                </Badge>
              )}
            </button>
          );
        })}

        {profiles.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-xs text-muted-foreground">No coaches yet</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onNewCoach}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View Tabs ───

function ViewTabs({
  view,
  onViewChange,
  onSettings,
  showLabels = false,
}: {
  view: View;
  onViewChange: (v: View) => void;
  onSettings: () => void;
  showLabels?: boolean;
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
          className={cn("h-8", showLabels ? "px-3" : "w-8 px-0")}
          onClick={() => onViewChange(key)}
        >
          <Icon className={cn("h-4 w-4", showLabels && "mr-1.5")} />
          {showLabels && label}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8", showLabels ? "ml-auto px-3" : "w-8 px-0")}
        onClick={onSettings}
      >
        <Settings2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
