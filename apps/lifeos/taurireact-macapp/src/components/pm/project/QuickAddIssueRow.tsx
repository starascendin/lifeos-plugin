import { useState, KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { usePM } from "@/lib/contexts/PMContext";
import type { Id } from "@holaai/convex";

interface QuickAddIssueRowProps {
  projectId: Id<"lifeos_pmProjects">;
}

export function QuickAddIssueRow({ projectId }: QuickAddIssueRowProps) {
  const { createIssue } = usePM();
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      await createIssue({
        title: title.trim(),
        projectId,
        status: "backlog",
        priority: "none",
      });
      setTitle("");
    } catch (error) {
      console.error("Failed to create issue:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="grid grid-cols-[80px,1fr,130px,100px,100px] items-center gap-4 px-4 py-2.5 border-t border-border">
      <div className="text-muted-foreground">
        <Plus className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add issue..."
        disabled={isCreating}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <div />
      <div />
      <div />
    </div>
  );
}
