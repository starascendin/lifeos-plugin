import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@holaai/convex/convex/_generated/api";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Trash2, ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { ToolPicker } from "./ToolPicker";
import { AgentRunHistory } from "./AgentRunHistory";

// ==================== MODELS ====================

const AGENT_MODELS = [
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano (fastest)" },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
  { id: "xai/grok-4.1-fast-reasoning", name: "Grok 4.1 Fast" },
  { id: "openai/gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini" },
] as const;

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

// ==================== TYPES ====================

export interface AgentConfig {
  _id: Id<"lifeos_customAgentConfigs">;
  name: string;
  slug: string;
  instructions: string;
  enabledTools: string[];
  model: string;
  greeting?: string;
  cronSchedule?: string;
  cronPrompt?: string;
  cronEnabled?: boolean;
  cronTimezone?: string;
  lastRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface AgentEditorProps {
  agent?: AgentConfig;
  onBack: () => void;
  onSaved: () => void;
}

// ==================== COMPONENT ====================

export function AgentEditor({ agent, onBack, onSaved }: AgentEditorProps) {
  const createAgent = useMutation(api.lifeos.agents.createAgentConfig);
  const updateAgent = useMutation(api.lifeos.agents.updateAgentConfig);
  const deleteAgent = useMutation(api.lifeos.agents.deleteAgentConfig);

  const [name, setName] = useState(agent?.name || "");
  const [slug, setSlug] = useState(agent?.slug || "");
  const [instructions, setInstructions] = useState(agent?.instructions || "");
  const [enabledTools, setEnabledTools] = useState<string[]>(
    agent?.enabledTools || []
  );
  const [model, setModel] = useState(agent?.model || "openai/gpt-5-nano");
  const [greeting, setGreeting] = useState(agent?.greeting || "");
  const [cronEnabled, setCronEnabled] = useState(agent?.cronEnabled || false);
  const [cronSchedule, setCronSchedule] = useState(
    agent?.cronSchedule || "0 9 * * *"
  );
  const [cronPrompt, setCronPrompt] = useState(agent?.cronPrompt || "");
  const [cronTimezone, setCronTimezone] = useState(
    agent?.cronTimezone || "America/New_York"
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "runs">("config");

  // Auto-generate slug from name
  useEffect(() => {
    if (!agent) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  }, [name, agent]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!instructions.trim()) {
      toast.error("Instructions are required");
      return;
    }
    if (enabledTools.length === 0) {
      toast.error("Select at least one tool");
      return;
    }

    setSaving(true);
    try {
      if (agent) {
        await updateAgent({
          agentConfigId: agent._id,
          name,
          instructions,
          enabledTools,
          model,
          greeting: greeting || undefined,
          cronEnabled,
          cronSchedule: cronEnabled ? cronSchedule : undefined,
          cronPrompt: cronEnabled ? cronPrompt : undefined,
          cronTimezone: cronEnabled ? cronTimezone : undefined,
        });
        toast.success("Agent updated");
      } else {
        await createAgent({
          name,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          instructions,
          enabledTools,
          model,
          greeting: greeting || undefined,
          cronEnabled,
          cronSchedule: cronEnabled ? cronSchedule : undefined,
          cronPrompt: cronEnabled ? cronPrompt : undefined,
          cronTimezone: cronEnabled ? cronTimezone : undefined,
        });
        toast.success("Agent created");
      }
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save agent"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      const id = agent._id;
      onBack();
      await deleteAgent({ agentConfigId: id });
      toast.success("Agent deleted");
    } catch (error) {
      toast.error("Failed to delete agent");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-xl font-semibold">
            {agent ? `Edit: ${agent.name}` : "Create Agent"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {agent && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {confirmDelete ? "Confirm Delete?" : "Delete"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Tabs for existing agents */}
      {agent && (
        <div className="flex gap-1 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "config"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("config")}
          >
            Configuration
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "runs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("runs")}
          >
            Run History
          </button>
        </div>
      )}

      {activeTab === "runs" && agent ? (
        <AgentRunHistory agentConfigId={agent._id} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Basic config */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily Standup Agent"
              />
            </div>

            {!agent && (
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="font-mono text-sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">System Instructions</Label>
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="You are a helpful assistant that manages my daily tasks..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting (optional)</Label>
              <Input
                id="greeting"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="Hello! I'm your daily standup agent."
              />
            </div>

            {/* Cron Schedule */}
            <hr className="border-border" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label>Scheduled Runs</Label>
                </div>
                <Switch
                  checked={cronEnabled}
                  onCheckedChange={setCronEnabled}
                />
              </div>

              {cronEnabled && (
                <div className="space-y-3 pl-6 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label htmlFor="cronSchedule">
                      Cron Expression
                    </Label>
                    <Input
                      id="cronSchedule"
                      value={cronSchedule}
                      onChange={(e) => setCronSchedule(e.target.value)}
                      placeholder="0 9 * * *"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      e.g. "0 9 * * *" = every day at 9am, "0 9 * * 1-5" =
                      weekdays at 9am
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cronTimezone">Timezone</Label>
                    <Select
                      value={cronTimezone}
                      onValueChange={setCronTimezone}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cronPrompt">Cron Prompt</Label>
                    <Textarea
                      id="cronPrompt"
                      value={cronPrompt}
                      onChange={(e) => setCronPrompt(e.target.value)}
                      placeholder="What should the agent do on each scheduled run?"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column: Tool picker */}
          <div className="space-y-2">
            <Label>Enabled Tools</Label>
            <div className="max-h-[600px] overflow-auto border rounded-md p-2">
              <ToolPicker
                selectedTools={enabledTools}
                onChange={setEnabledTools}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
