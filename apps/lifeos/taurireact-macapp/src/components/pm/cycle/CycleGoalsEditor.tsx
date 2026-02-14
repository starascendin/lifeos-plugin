import { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Target } from "lucide-react";

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
  const goalsText = (goals ?? []).join("\n");
  const [value, setValue] = useState(goalsText);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(goalsText);

  // Sync from props ONLY when not focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue(goalsText);
      lastSavedRef.current = goalsText;
    }
  }, [goalsText]);

  const save = useCallback(async (text: string) => {
    const newGoals = text
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    const next = newGoals.join("\n");
    if (lastSavedRef.current === next) return;
    setIsSaving(true);
    try {
      await onSave(newGoals);
      lastSavedRef.current = next;
      setSavedAt(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  const scheduleAutoSave = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(text);
    }, 1500);
  }, [save]);

  const handleChange = (text: string) => {
    setValue(text);
    scheduleAutoSave(text);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    save(value);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const formatSavedAt = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Target className="h-4 w-4" />
          Goals
        </h3>
        <span className="text-xs text-muted-foreground">
          {isSaving
            ? "Saving..."
            : savedAt
              ? `Saved at ${formatSavedAt(savedAt)}`
              : ""}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={handleBlur}
        placeholder="Enter goals (one per line)..."
        className="min-h-[80px] resize-none text-sm"
        disabled={readOnly}
      />
    </div>
  );
}
