import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface IssueDescriptionProps {
  description?: string;
  onSave: (description: string) => Promise<void>;
}

export function IssueDescription({ description, onSave }: IssueDescriptionProps) {
  const [value, setValue] = useState(description || "");
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setValue(description || "");
  }, [description]);

  const handleChange = (newValue: string) => {
    setValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-save after 1 second of inactivity
    timeoutRef.current = setTimeout(async () => {
      if (newValue !== description) {
        setIsSaving(true);
        try {
          await onSave(newValue);
        } catch (error) {
          console.error("Failed to save description:", error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 1000);
  };

  const handleBlur = async () => {
    // Clear timeout and save immediately on blur
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value !== description) {
      setIsSaving(true);
      try {
        await onSave(value);
      } catch (error) {
        console.error("Failed to save description:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">
          Description
        </label>
        {isSaving && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add a description..."
        className="min-h-[120px] resize-none"
      />
    </div>
  );
}
