import { useState, useEffect } from "react";
import { Bot, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getCoderTemplates,
  getCoderPresets,
  delegateToCoder,
  type CoderTemplate,
  type CoderPreset,
} from "@/lib/services/coder";
import type { Doc } from "@holaai/convex";

interface DelegateToAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: Doc<"lifeos_pmIssues">;
  onSuccess: () => void;
}

export function DelegateToAgentDialog({
  open,
  onOpenChange,
  issue,
  onSuccess,
}: DelegateToAgentDialogProps) {
  const [templates, setTemplates] = useState<CoderTemplate[]>([]);
  const [presets, setPresets] = useState<CoderPreset[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoadingTemplates(true);
      setError(null);
      getCoderTemplates()
        .then((t) => {
          setTemplates(t);
          // Auto-select first template if available
          if (t.length > 0 && !selectedTemplate) {
            setSelectedTemplate(t[0].name);
          }
        })
        .catch((e) => {
          setError(e.message || "Failed to load templates");
        })
        .finally(() => {
          setIsLoadingTemplates(false);
        });
    }
  }, [open]);

  // Load presets when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setIsLoadingPresets(true);
      setSelectedPreset("");
      getCoderPresets(selectedTemplate)
        .then((p) => {
          setPresets(p);
          // Auto-select first preset if available
          if (p.length > 0) {
            setSelectedPreset(p[0].name);
          }
        })
        .catch((e) => {
          setError(e.message || "Failed to load presets");
        })
        .finally(() => {
          setIsLoadingPresets(false);
        });
    }
  }, [selectedTemplate]);

  const handleDelegate = async () => {
    if (!selectedTemplate || !selectedPreset) {
      setError("Please select a template and preset");
      return;
    }

    setIsDelegating(true);
    setError(null);

    try {
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
        onSuccess();
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to delegate to agent");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delegate to agent");
    } finally {
      setIsDelegating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Delegate to Agent
          </DialogTitle>
          <DialogDescription>
            Create a Coder task to have an AI agent work on this issue.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Issue Preview */}
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="font-medium">{issue.identifier}</div>
            <div className="text-muted-foreground line-clamp-2">
              {issue.title}
            </div>
          </div>

          {/* Template Selection */}
          <div className="grid gap-2">
            <Label htmlFor="template">Template</Label>
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
              disabled={isLoadingTemplates}
            >
              <SelectTrigger id="template">
                {isLoadingTemplates ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <SelectValue placeholder="Select a template" />
                )}
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset Selection */}
          <div className="grid gap-2">
            <Label htmlFor="preset">Preset</Label>
            <Select
              value={selectedPreset}
              onValueChange={setSelectedPreset}
              disabled={isLoadingPresets || !selectedTemplate}
            >
              <SelectTrigger id="preset">
                {isLoadingPresets ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <SelectValue placeholder="Select a preset" />
                )}
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-sm text-destructive rounded-md bg-destructive/10 p-3">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDelegating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelegate}
            disabled={
              isDelegating ||
              isLoadingTemplates ||
              isLoadingPresets ||
              !selectedTemplate ||
              !selectedPreset
            }
          >
            {isDelegating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Delegating...
              </>
            ) : (
              <>
                <Bot className="mr-2 h-4 w-4" />
                Delegate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
