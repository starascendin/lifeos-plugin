import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@holaai/convex";
import { Id } from "@holaai/convex/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

interface ExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoId: Id<"life_voiceMemos">;
  memoName: string;
  transcript: string;
  onSuccess?: () => void;
}

export function ExtractionDialog({
  open,
  onOpenChange,
  memoId,
  memoName,
  transcript,
  onSuccess,
}: ExtractionDialogProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractVoiceMemo = useAction(api.lifeos.voicememo_extraction.extractVoiceMemo);

  const handleExtract = async () => {
    setIsExtracting(true);
    setError(null);

    try {
      const result = await extractVoiceMemo({
        voiceMemoId: memoId,
        customPrompt: customPrompt.trim() || undefined,
      });

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.error || "Extraction failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClose = () => {
    if (!isExtracting) {
      setCustomPrompt("");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Extract Insights
          </DialogTitle>
          <DialogDescription>
            AI will analyze "{memoName}" and extract summary, labels, action items, and key points.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transcript Preview</Label>
            <ScrollArea className="h-32 rounded-md border p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {transcript.length > 500 ? `${transcript.slice(0, 500)}...` : transcript}
              </p>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customPrompt" className="text-sm font-medium">
              Custom Instructions (optional)
            </Label>
            <Textarea
              id="customPrompt"
              placeholder="Add specific instructions for the AI, e.g., 'Focus on technical details' or 'Identify meeting participants'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[80px] resize-none"
              disabled={isExtracting}
            />
            <p className="text-xs text-muted-foreground">
              The AI will extract: summary, labels, action items, key points, and sentiment.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExtracting}
          >
            Cancel
          </Button>
          <Button onClick={handleExtract} disabled={isExtracting}>
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract Insights
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
