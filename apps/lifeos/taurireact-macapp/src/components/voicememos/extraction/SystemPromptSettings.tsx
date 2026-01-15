import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Settings, RotateCcw, Save, ChevronDown, ChevronRight } from "lucide-react";

interface SystemPromptDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Dialog for editing the system prompt (used in Voice Notes header)
 */
export function SystemPromptDialog({ trigger }: SystemPromptDialogProps) {
  const settings = useQuery(api.lifeos.voicememo_extraction.getExtractionSettings);
  const updateSettings = useMutation(api.lifeos.voicememo_extraction.updateExtractionSettings);
  const resetSettings = useMutation(api.lifeos.voicememo_extraction.resetExtractionSettings);

  const [prompt, setPrompt] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync prompt with settings when dialog opens or settings change
  useEffect(() => {
    if (settings) {
      setPrompt(settings.extractionSystemPrompt);
    }
  }, [settings?.extractionSystemPrompt]);

  // Show loading state while settings are loading
  if (settings === undefined) {
    return trigger || (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <Settings className="h-4 w-4" />
        Loading...
      </Button>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ extractionSystemPrompt: prompt });
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (settings) {
      setPrompt(settings.defaultPrompt);
      await resetSettings();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            System Prompt
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Extraction System Prompt</DialogTitle>
          <DialogDescription>
            Customize the AI instructions for extracting insights from your voice memos.
            {settings?.isCustom && (
              <span className="ml-2 text-xs text-blue-500">(Custom)</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto py-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Enter your custom system prompt..."
          />
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!settings?.isCustom}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Collapsible view of system prompt (used in History Panel)
 */
export function SystemPromptCollapsible() {
  const settings = useQuery(api.lifeos.voicememo_extraction.getExtractionSettings);
  const [isOpen, setIsOpen] = useState(false);

  if (!settings) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Settings className="h-3 w-3" />
            System Prompt
            {settings.isCustom && (
              <span className="text-blue-500">(Custom)</span>
            )}
          </span>
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-auto font-mono whitespace-pre-wrap">
          {settings.extractionSystemPrompt}
        </div>
        <div className="mt-2">
          <SystemPromptDialog
            trigger={
              <Button variant="outline" size="sm" className="w-full text-xs h-7">
                Edit System Prompt
              </Button>
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
