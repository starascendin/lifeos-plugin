import { useState, useEffect, useMemo } from "react";
import {
  Circle,
  Flag,
  Calendar,
  Hash,
  Tag,
  FolderKanban,
  RefreshCw,
  Bot,
  Loader2,
  ExternalLink,
  Settings,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PropertyRow,
  StatusSelect,
  PrioritySelect,
  DatePickerInput,
  LabelPicker,
} from "../shared";
import { usePM, IssueStatus, Priority } from "@/lib/contexts/PMContext";
import type { Doc, Id } from "@holaai/convex";
import { api } from "@holaai/convex";
import { useQuery, useAction } from "convex/react";
import { Link } from "react-router-dom";
import {
  isCoderAvailable,
  getCoderTemplates,
  getCoderPresets,
  delegateToCoder,
  type CoderTemplate,
  type CoderPreset,
} from "@/lib/services/coder";

// Detect if running in Tauri or Web
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
const isWeb = !isTauri;

interface IssuePropertiesProps {
  issue: Doc<"lifeos_pmIssues">;
  onUpdate: (updates: {
    status?: IssueStatus;
    priority?: Priority;
    dueDate?: number | null;
    estimate?: number;
    labelIds?: Id<"lifeos_pmLabels">[];
    projectId?: Id<"lifeos_pmProjects">;
    cycleId?: Id<"lifeos_pmCycles">;
  }) => Promise<void>;
  onStatusChange: (status: IssueStatus) => Promise<void>;
  onDelegateSuccess?: () => Promise<void>;
}

// Helper to format date range for cycles
function formatDateRange(startDate: number, endDate: number): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, formatOptions)} - ${end.toLocaleDateString(undefined, formatOptions)}`;
}

export function IssueProperties({ issue, onUpdate, onStatusChange, onDelegateSuccess }: IssuePropertiesProps) {
  const { projects, cycles } = usePM();

  // Filter cycles to show: current cycle, 1 previous, and 2 upcoming
  const filteredCycles = useMemo(() => {
    if (!cycles) return [];

    // Separate cycles by status
    const completed = cycles
      .filter((c) => c.status === "completed")
      .sort((a, b) => b.endDate - a.endDate); // Most recent first

    const active = cycles.filter((c) => c.status === "active");

    const upcoming = cycles
      .filter((c) => c.status === "upcoming")
      .sort((a, b) => a.startDate - b.startDate); // Earliest first

    // Combine: 1 previous + current + 2 upcoming
    const result = [
      ...completed.slice(0, 1), // 1 most recent completed
      ...active, // Current/active cycle(s)
      ...upcoming.slice(0, 2), // 2 upcoming
    ];

    // Sort by start date for consistent display order
    return result.sort((a, b) => a.startDate - b.startDate);
  }, [cycles]);

  // Convex hooks for web mode
  // Queries/mutations from pm_coder, actions from pm_coder_actions
  const isCoderConnected = useQuery(api.lifeos.pm_coder.isConnected);
  const listTemplatesAction = useAction(api.lifeos.pm_coder_actions.listTemplates);
  const listPresetsAction = useAction(api.lifeos.pm_coder_actions.listPresets);
  const createTaskAction = useAction(api.lifeos.pm_coder_actions.createTask);

  // Coder delegation state
  const [templates, setTemplates] = useState<CoderTemplate[]>([]);
  const [presets, setPresets] = useState<CoderPreset[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);

  // Determine if delegation UI should be shown
  // - Tauri: always available (uses local CLI)
  // - Web: only if user has Coder connected
  const showDelegation = isTauri ? isCoderAvailable() : isCoderConnected === true;
  const showConnectPrompt = isWeb && isCoderConnected === false;

  // Load templates on mount - different source for Tauri vs Web
  useEffect(() => {
    if (!showDelegation || templates.length > 0) return;

    setIsLoadingTemplates(true);

    const loadTemplates = async () => {
      try {
        let loadedTemplates: CoderTemplate[];

        if (isTauri) {
          loadedTemplates = await getCoderTemplates();
        } else {
          // Web: use Convex action
          loadedTemplates = await listTemplatesAction();
        }

        setTemplates(loadedTemplates);
        if (loadedTemplates.length > 0) {
          setSelectedTemplate(loadedTemplates[0].name);
        }
      } catch (e) {
        console.error("Failed to load templates:", e);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [showDelegation, listTemplatesAction]);

  // Load presets when template changes - different source for Tauri vs Web
  useEffect(() => {
    if (!selectedTemplate) return;

    setIsLoadingPresets(true);
    setSelectedPreset("");

    const loadPresets = async () => {
      try {
        let loadedPresets: CoderPreset[];

        if (isTauri) {
          loadedPresets = await getCoderPresets(selectedTemplate);
        } else {
          // Web: use Convex action
          const presetData = await listPresetsAction({ template: selectedTemplate });
          // Map to CoderPreset format
          loadedPresets = presetData.map((p: { name: string }) => ({
            name: p.name,
            template: selectedTemplate,
          }));
        }

        setPresets(loadedPresets);
        if (loadedPresets.length > 0) {
          setSelectedPreset(loadedPresets[0].name);
        }
      } catch (e) {
        console.error("Failed to load presets:", e);
      } finally {
        setIsLoadingPresets(false);
      }
    };

    loadPresets();
  }, [selectedTemplate, listPresetsAction]);

  // Format issue details as a prompt for the Coder agent
  const formatIssuePrompt = (): string => {
    const parts = [
      `Issue: ${issue.identifier} - ${issue.title}`,
      `Status: ${issue.status}`,
      `Priority: ${issue.priority}`,
    ];

    if (issue.description) {
      parts.push(`\nDescription:\n${issue.description}`);
    }

    return parts.join("\n");
  };

  const handleDelegate = async () => {
    if (!selectedTemplate || !selectedPreset) return;

    setIsDelegating(true);
    setDelegateError(null);

    try {
      if (isWeb) {
        // Web: use Convex action
        const result = await createTaskAction({
          template: selectedTemplate,
          preset: selectedPreset,
          prompt: formatIssuePrompt(),
        });

        if (result.success) {
          onDelegateSuccess?.();
          // Open task URL in new tab
          if (result.taskUrl) {
            window.open(result.taskUrl, "_blank");
          }
        } else {
          setDelegateError(result.error || "Failed to delegate");
        }
      } else {
        // Tauri: use existing CLI delegation
        const result = await delegateToCoder({
          template: selectedTemplate,
          preset: selectedPreset,
          issueIdentifier: issue.identifier,
          issueTitle: issue.title,
          issueDescription: issue.description,
          issueStatus: issue.status,
          issuePriority: issue.priority,
        });

        if (result.success) {
          onDelegateSuccess?.();
        } else {
          setDelegateError(result.error || "Failed to delegate");
        }
      }
    } catch (e) {
      setDelegateError(e instanceof Error ? e.message : "Failed to delegate");
    } finally {
      setIsDelegating(false);
    }
  };

  return (
    <div className="w-60 shrink-0 border-l border-border bg-muted/30 p-4">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Properties
      </h3>

      <div className="space-y-1">
        {/* Status */}
        <PropertyRow label="Status" icon={Circle}>
          <StatusSelect
            value={issue.status as IssueStatus}
            onChange={onStatusChange}
            size="sm"
          />
        </PropertyRow>

        {/* Priority */}
        <PropertyRow label="Priority" icon={Flag}>
          <PrioritySelect
            value={issue.priority as Priority}
            onChange={(priority) => onUpdate({ priority })}
            size="sm"
          />
        </PropertyRow>

        {/* Due Date */}
        <PropertyRow label="Due date" icon={Calendar}>
          <DatePickerInput
            value={issue.dueDate}
            onChange={(dueDate) => onUpdate({ dueDate })}
            placeholder="Set due date"
          />
        </PropertyRow>

        {/* Estimate */}
        <PropertyRow label="Estimate" icon={Hash}>
          <Input
            type="number"
            value={issue.estimate || ""}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              onUpdate({ estimate: val });
            }}
            placeholder="Points"
            className="h-8 w-20 text-sm"
            min={0}
          />
        </PropertyRow>

        {/* Project */}
        <PropertyRow label="Project" icon={FolderKanban}>
          <Select
            value={issue.projectId || "none"}
            onValueChange={(value) =>
              onUpdate({ projectId: value === "none" ? undefined : (value as Id<"lifeos_pmProjects">) })
            }
          >
            <SelectTrigger className="h-8 w-32 border-none bg-transparent shadow-none text-sm">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project._id} value={project._id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Cycle */}
        <PropertyRow label="Cycle" icon={RefreshCw}>
          <Select
            value={issue.cycleId || "none"}
            onValueChange={(value) =>
              onUpdate({ cycleId: value === "none" ? undefined : (value as Id<"lifeos_pmCycles">) })
            }
          >
            <SelectTrigger className="h-8 w-40 border-none bg-transparent shadow-none text-sm">
              <SelectValue placeholder="No cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No cycle</SelectItem>
              {filteredCycles.map((cycle) => (
                <SelectItem key={cycle._id} value={cycle._id}>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      {cycle.name || `Cycle ${cycle.number}`}
                      {cycle.status === "active" && (
                        <span className="text-[10px] font-medium text-green-500">(Current)</span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateRange(cycle.startDate, cycle.endDate)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Labels */}
        <div className="pt-3 border-t border-border mt-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Tag className="h-4 w-4" />
            <span>Labels</span>
          </div>
          <LabelPicker
            selectedIds={issue.labelIds as Id<"lifeos_pmLabels">[]}
            onChange={(labelIds) => onUpdate({ labelIds })}
            projectId={issue.projectId}
          />
        </div>

        {/* Coder Agent Delegation - Show for Tauri OR connected web users */}
        {showDelegation && (
          <div className="pt-3 border-t border-border mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Bot className="h-4 w-4" />
              <span>Delegate to Agent</span>
            </div>

            {/* Show delegated badge if already delegated */}
            {issue.delegatedAt && (
              <div className="mb-2">
                <Badge variant="secondary" className="flex items-center gap-1.5 w-fit">
                  <Bot className="h-3 w-3" />
                  Delegated
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(issue.delegatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}

            {/* Template selector */}
            <div className="space-y-2">
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
                disabled={isLoadingTemplates || isDelegating}
              >
                <SelectTrigger className="h-8 text-xs">
                  {isLoadingTemplates ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    <SelectValue placeholder="Select template" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name} className="text-xs">
                      {t.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Preset selector */}
              <Select
                value={selectedPreset}
                onValueChange={setSelectedPreset}
                disabled={isLoadingPresets || !selectedTemplate || isDelegating}
              >
                <SelectTrigger className="h-8 text-xs">
                  {isLoadingPresets ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    <SelectValue placeholder="Select preset" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.name} value={p.name} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Error display */}
              {delegateError && (
                <p className="text-xs text-destructive">{delegateError}</p>
              )}

              {/* Delegate button */}
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={handleDelegate}
                disabled={isDelegating || !selectedTemplate || !selectedPreset}
              >
                {isDelegating ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Delegating...
                  </>
                ) : (
                  <>
                    <Bot className="mr-1 h-3 w-3" />
                    {issue.delegatedAt ? "Delegate Again" : "Delegate"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Prompt to connect Coder - Show for web users who haven't connected */}
        {showConnectPrompt && (
          <div className="pt-3 border-t border-border mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Bot className="h-4 w-4" />
              <span>Delegate to Agent</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Connect your Coder account to delegate issues to AI coding agents.
            </p>
            <Button size="sm" variant="outline" className="w-full h-8 text-xs" asChild>
              <Link to="/settings">
                <Settings className="mr-1.5 h-3 w-3" />
                Connect Coder
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
