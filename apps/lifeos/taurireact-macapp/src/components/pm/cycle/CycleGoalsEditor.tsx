import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X, Target } from "lucide-react";

interface CycleGoalsEditorProps {
  goals: string[] | undefined;
  onSave: (goals: string[]) => Promise<void>;
  readOnly?: boolean;
}

export function CycleGoalsEditor({
  goals,
  onSave,
  readOnly = false,
}: CycleGoalsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    setEditValue((goals ?? []).join("\n"));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newGoals = editValue
        .split("\n")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);
      await onSave(newGoals);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4" />
            Goals
          </h4>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="Enter goals (one per line)..."
          className="min-h-[120px] resize-none"
          disabled={isSaving}
        />
        <p className="text-xs text-muted-foreground">
          Enter one goal per line
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4" />
          Goals
        </h4>
        {!readOnly && (
          <Button size="sm" variant="ghost" onClick={handleStartEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      {goals && goals.length > 0 ? (
        <ul className="space-y-1.5">
          {goals.map((goal, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
              <span>{goal}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No goals set</p>
      )}
    </div>
  );
}
