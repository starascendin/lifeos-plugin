/**
 * CoachingTab - Main coaching container
 *
 * Three-pane layout:
 * - Left: Coach profiles list
 * - Center: Active chat or session history
 * - Right: Action items sidebar (when in session)
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  GraduationCap,
  MessageSquare,
  History,
  CheckSquare,
  Settings2,
} from "lucide-react";
import { CoachChat } from "./CoachChat";
import { CoachProfileEditor } from "./CoachProfileEditor";
import { CoachSessionHistory } from "./CoachSessionHistory";
import { CoachActionItems } from "./CoachActionItems";

type View = "chat" | "history" | "actions" | "settings";

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

  // Auto-select first profile if none selected
  if (!selectedProfileId && profiles.length > 0 && !showProfileEditor) {
    setSelectedProfileId(profiles[0]._id);
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left sidebar - Coach list */}
      <div className="w-64 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Coaches</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingProfileId(null);
              setShowProfileEditor(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>

        <div className="space-y-2">
          {profiles.map((profile) => {
            const pendingCount = actionItemCounts[profile._id] || 0;
            return (
              <button
                key={profile._id}
                onClick={() => {
                  setSelectedProfileId(profile._id);
                  setShowProfileEditor(false);
                  setView("chat");
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  selectedProfileId === profile._id && !showProfileEditor
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                  style={{
                    backgroundColor: profile.color
                      ? `${profile.color}20`
                      : "hsl(var(--muted))",
                  }}
                >
                  {profile.icon || <GraduationCap className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{profile.name}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {profile.focusAreas.slice(0, 2).join(", ")}
                  </p>
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {pendingCount} action{pendingCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}

          {profiles.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">No coaches yet</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setEditingProfileId(null);
                    setShowProfileEditor(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create your first coach
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Center content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {showProfileEditor ? (
          <CoachProfileEditor
            profileId={editingProfileId}
            onSave={() => setShowProfileEditor(false)}
            onCancel={() => setShowProfileEditor(false)}
          />
        ) : selectedProfile ? (
          <>
            {/* View tabs */}
            <div className="mb-4 flex items-center gap-1 border-b pb-2">
              <Button
                variant={view === "chat" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("chat")}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Chat
              </Button>
              <Button
                variant={view === "history" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("history")}
              >
                <History className="mr-1.5 h-4 w-4" />
                Sessions
              </Button>
              <Button
                variant={view === "actions" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("actions")}
              >
                <CheckSquare className="mr-1.5 h-4 w-4" />
                Action Items
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingProfileId(selectedProfileId);
                  setShowProfileEditor(true);
                }}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            {/* View content */}
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
          </>
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <CardContent className="text-center">
              <GraduationCap className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <CardTitle className="mb-2">AI Coaching</CardTitle>
              <p className="text-muted-foreground text-sm">
                Select a coach to start a session, or create a new one.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
