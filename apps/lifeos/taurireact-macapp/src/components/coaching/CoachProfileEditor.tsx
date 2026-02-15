/**
 * CoachProfileEditor - Create/edit coach profiles.
 * Clean single-column form. Templates at top for quick start.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

interface CoachProfileEditorProps {
  profileId: Id<"lifeos_coachingProfiles"> | null;
  onSave: () => void;
  onCancel: () => void;
}

const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", provider: "Google" },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
  },
  { id: "openai/gpt-5", name: "GPT-5", provider: "OpenAI" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "OpenAI" },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
  },
];

const FOCUS_AREA_PRESETS = [
  "Business Strategy",
  "Client Management",
  "Project Management",
  "Time Management",
  "Goal Setting",
  "Personal Development",
  "Leadership",
  "Decision Making",
  "Work-Life Balance",
  "Productivity",
  "Communication",
  "Networking",
  "Financial Planning",
  "Health & Wellness",
  "Creative Thinking",
];

const COACH_TEMPLATES = [
  {
    name: "Business Coach",
    icon: "🏢",
    color: "#3b82f6",
    focusAreas: [
      "Business Strategy",
      "Client Management",
      "Project Management",
    ],
    instructions: `You are an experienced business coach. Your role is to help the user with strategic business decisions, client management, and project execution.

Coaching approach:
- Start each session by reviewing outstanding action items and checking progress
- Ask probing questions to help the user think through challenges
- Use the Eisenhower matrix (urgent vs important) to help prioritize
- Reference their actual projects, tasks, and clients using available tools
- End sessions with clear, actionable next steps

Key behaviors:
- Be direct but supportive - don't sugarcoat problems
- Challenge assumptions when you see blind spots
- Connect current decisions to stated goals and initiatives
- Track patterns across sessions (overcommitting, avoiding hard conversations, etc.)
- Celebrate wins and progress on action items`,
    sessionCadence: "weekly" as const,
  },
  {
    name: "Life Coach",
    icon: "🌟",
    color: "#a855f7",
    focusAreas: [
      "Personal Development",
      "Goal Setting",
      "Work-Life Balance",
      "Health & Wellness",
    ],
    instructions: `You are a thoughtful life coach focused on holistic personal development. Help the user align their daily actions with their deeper values and long-term goals.

Coaching approach:
- Begin sessions with a check-in: How are you feeling? What's been on your mind?
- Use reflective questioning to deepen self-awareness
- Help set SMART goals and break them into manageable steps
- Balance accountability with compassion
- Look at the full picture: work, relationships, health, personal growth

Key behaviors:
- Listen more than advise - help the user find their own answers
- Notice emotional patterns and energy levels
- Connect daily tasks to larger life themes
- Gently challenge comfort zones while respecting boundaries
- Review and celebrate progress regularly`,
    sessionCadence: "weekly" as const,
  },
  {
    name: "GTD Coach",
    icon: "📋",
    color: "#22c55e",
    focusAreas: [
      "Productivity",
      "Time Management",
      "Goal Setting",
      "Decision Making",
    ],
    instructions: `You are a productivity coach using the Getting Things Done (GTD) methodology. Help the user capture, clarify, organize, and execute their commitments effectively.

Coaching approach:
- Review their current task list, inbox, and upcoming deadlines
- Help process loose items into actionable next steps
- Apply the 2-minute rule: do it now if it takes under 2 minutes
- Weekly review: clear inboxes, review projects, update next actions
- Ensure every project has a clear next action defined

Key behaviors:
- Be systematic and thorough in reviews
- Help distinguish between projects (multi-step outcomes) and tasks (single actions)
- Identify stuck projects and help unblock them
- Suggest delegation or elimination when appropriate
- Keep the focus on outcomes, not just activity`,
    sessionCadence: "daily" as const,
  },
];

export function CoachProfileEditor({
  profileId,
  onSave,
  onCancel,
}: CoachProfileEditorProps) {
  const existingProfile = useQuery(
    api.lifeos.coaching.getCoachProfile,
    profileId ? { profileId } : "skip",
  );

  const createProfile = useMutation(api.lifeos.coaching.createCoachProfile);
  const updateProfile = useMutation(api.lifeos.coaching.updateCoachProfile);
  const deleteProfile = useMutation(api.lifeos.coaching.deleteCoachProfile);

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [model, setModel] = useState("google/gemini-3-flash");
  const [greeting, setGreeting] = useState("");
  const [sessionCadence, setSessionCadence] = useState<string>("ad_hoc");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (existingProfile) {
      setName(existingProfile.name);
      setInstructions(existingProfile.instructions);
      setFocusAreas(existingProfile.focusAreas);
      setModel(existingProfile.model);
      setGreeting(existingProfile.greeting || "");
      setSessionCadence(existingProfile.sessionCadence || "ad_hoc");
      setIcon(existingProfile.icon || "");
      setColor(existingProfile.color || "");
    }
  }, [existingProfile]);

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleApplyTemplate = (template: (typeof COACH_TEMPLATES)[number]) => {
    setName(template.name);
    setInstructions(template.instructions);
    setFocusAreas(template.focusAreas);
    setIcon(template.icon);
    setColor(template.color);
    setSessionCadence(template.sessionCadence);
    setGreeting(
      `Hi! I'm your ${template.name}. Ready to get started? What's on your mind today?`,
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !instructions.trim()) {
      toast.error("Name and instructions are required");
      return;
    }

    setIsSaving(true);
    try {
      const enabledTools = [
        "get_todays_tasks",
        "get_tasks",
        "create_issue",
        "mark_issue_complete",
        "get_issue",
        "update_issue",
        "get_projects",
        "get_project",
        "get_current_cycle",
        "get_cycles",
        "get_daily_agenda",
        "get_weekly_agenda",
        "get_monthly_agenda",
        "get_clients",
        "get_client",
        "get_projects_for_client",
        "get_people",
        "get_person",
        "search_people",
        "get_person_timeline",
        "search_notes",
        "get_recent_notes",
        "create_quick_note",
        "get_ai_convo_summaries",
        "search_ai_convo_summaries",
        "create_ai_convo_summary",
        "get_initiatives",
        "get_initiative",
        "get_initiative_with_stats",
      ];

      if (profileId) {
        await updateProfile({
          profileId,
          name,
          instructions,
          focusAreas,
          enabledTools: existingProfile?.enabledTools ?? enabledTools,
          model,
          greeting: greeting || undefined,
          sessionCadence: sessionCadence as any,
          icon: icon || undefined,
          color: color || undefined,
        });
        toast.success("Coach updated");
      } else {
        await createProfile({
          name,
          slug: generateSlug(name),
          instructions,
          focusAreas,
          enabledTools,
          model,
          greeting: greeting || undefined,
          sessionCadence: sessionCadence as any,
          icon: icon || undefined,
          color: color || undefined,
        });
        toast.success("Coach created");
      }
      onSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profileId) return;
    if (
      !confirm(
        "Delete this coach? All sessions and action items will be removed.",
      )
    )
      return;
    try {
      await deleteProfile({ profileId });
      toast.success("Coach deleted");
      onSave();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Action bar */}
      <div className="mb-4 flex items-center justify-end gap-2">
        {profileId && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1.5 h-4 w-4" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Templates (new profile only) */}
      {!profileId && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Quick start
          </p>
          <div className="flex flex-wrap gap-2">
            {COACH_TEMPLATES.map((t) => (
              <Button
                key={t.name}
                variant="outline"
                size="sm"
                onClick={() => handleApplyTemplate(t)}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Form — single column, clean spacing */}
      <div className="max-w-xl space-y-4">
        {/* Identity row */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Business Coach"
              className="text-base md:text-sm"
            />
          </div>
          <div className="w-16 space-y-1.5">
            <Label className="text-xs">Icon</Label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🏢"
              maxLength={4}
              className="text-center text-base md:text-sm"
            />
          </div>
          <div className="w-14 space-y-1.5">
            <Label className="text-xs">Color</Label>
            <Input
              type="color"
              value={color || "#3b82f6"}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 cursor-pointer px-1"
            />
          </div>
        </div>

        {/* Model + Cadence row */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32 space-y-1.5">
            <Label className="text-xs">Cadence</Label>
            <Select value={sessionCadence} onValueChange={setSessionCadence}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="ad_hoc">Ad-hoc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Focus areas */}
        <div className="space-y-1.5">
          <Label className="text-xs">Focus Areas</Label>
          <div className="flex flex-wrap gap-1.5">
            {FOCUS_AREA_PRESETS.map((area) => (
              <Badge
                key={area}
                variant={focusAreas.includes(area) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleFocusArea(area)}
              >
                {area}
              </Badge>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* Instructions */}
        <div className="space-y-1.5">
          <Label className="text-xs">System Prompt</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Define the coach's personality, methodology, and approach..."
            className="min-h-[180px] font-mono text-xs md:min-h-[240px]"
          />
        </div>

        {/* Greeting */}
        <div className="space-y-1.5">
          <Label className="text-xs">Greeting Message</Label>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Hi! I'm your coach. What would you like to work on today?"
            className="min-h-[60px] text-sm"
          />
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}
