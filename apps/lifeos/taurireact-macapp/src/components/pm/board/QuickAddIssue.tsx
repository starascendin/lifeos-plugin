import { useState } from "react";
import { usePM, IssueStatus } from "@/lib/contexts/PMContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface QuickAddIssueProps {
  status: IssueStatus;
  onClose: () => void;
}

export function QuickAddIssue({ status, onClose }: QuickAddIssueProps) {
  const { createIssue, filters } = usePM();
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createIssue({
        title: title.trim(),
        status,
        projectId: filters.projectId,
        cycleId: filters.cycleId,
      });
      setTitle("");
      onClose();
    } catch (error) {
      console.error("Failed to create issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-2"
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Issue title..."
        className="mb-2 text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim() || isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
