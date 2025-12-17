import { useState } from "react";
import { Check, Plus, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePM } from "@/lib/contexts/PMContext";
import { cn } from "@/lib/utils";
import type { Id, Doc } from "@holaai/convex";

interface LabelPickerProps {
  selectedIds: Id<"lifeos_pmLabels">[];
  onChange: (ids: Id<"lifeos_pmLabels">[]) => void;
  projectId?: Id<"lifeos_pmProjects">;
  disabled?: boolean;
}

export function LabelPicker({
  selectedIds,
  onChange,
  projectId,
  disabled = false,
}: LabelPickerProps) {
  const { labels, createLabel } = usePM();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");

  // Filter labels for this project or workspace-wide labels
  const availableLabels = labels?.filter(
    (label) => !label.projectId || label.projectId === projectId
  );

  const selectedLabels = availableLabels?.filter((label) =>
    selectedIds.includes(label._id)
  );

  const toggleLabel = (labelId: Id<"lifeos_pmLabels">) => {
    if (selectedIds.includes(labelId)) {
      onChange(selectedIds.filter((id) => id !== labelId));
    } else {
      onChange([...selectedIds, labelId]);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    try {
      const colors = [
        "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
        "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      await createLabel({
        name: newLabelName.trim(),
        color: randomColor,
        projectId,
      });

      setNewLabelName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create label:", error);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {selectedLabels?.map((label) => (
        <LabelBadge
          key={label._id}
          label={label}
          onRemove={() => toggleLabel(label._id)}
        />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            disabled={disabled}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add label
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-2">
            {isCreating ? (
              <div className="flex gap-2">
                <Input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateLabel();
                    if (e.key === "Escape") setIsCreating(false);
                  }}
                  autoFocus
                />
                <Button size="sm" className="h-8" onClick={handleCreateLabel}>
                  Add
                </Button>
              </div>
            ) : (
              <>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {availableLabels?.map((label) => {
                    const isSelected = selectedIds.includes(label._id);
                    return (
                      <button
                        key={label._id}
                        onClick={() => toggleLabel(label._id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-muted transition-colors",
                          isSelected && "bg-muted"
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="flex-1 truncate">{label.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create new label
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function LabelBadge({
  label,
  onRemove,
}: {
  label: Doc<"lifeos_pmLabels">;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
      }}
    >
      {label.name}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="hover:bg-black/10 rounded-full p-0.5 -mr-1"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// Simple display component for showing labels without edit capability
export function LabelDisplay({
  labelIds,
  labels,
  className,
}: {
  labelIds: Id<"lifeos_pmLabels">[];
  labels?: Doc<"lifeos_pmLabels">[];
  className?: string;
}) {
  if (!labelIds.length || !labels) return null;

  const displayLabels = labels.filter((l) => labelIds.includes(l._id));

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayLabels.map((label) => (
        <span
          key={label._id}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${label.color}20`,
            color: label.color,
          }}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
