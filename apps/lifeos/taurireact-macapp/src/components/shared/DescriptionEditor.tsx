import { useState, useEffect, useRef } from "react";
import { TiptapEditor } from "./TiptapEditor";

interface DescriptionEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

/**
 * Description editor with edit/view mode toggle
 * - Click to edit
 * - Blur to save and exit edit mode
 * - Auto-saves while editing (debounced)
 */
export function DescriptionEditor({
  value,
  onSave,
  placeholder = "Click to add a description...",
  className,
}: DescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>(value);
  const localValueRef = useRef<string>(value);

  // Sync with external value
  useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value);
      lastSavedRef.current = value;
      localValueRef.current = value;
    }
  }, [value]);

  // Keep ref in sync
  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  // Debounced auto-save while editing
  useEffect(() => {
    if (!isEditing) return;
    if (localValue === lastSavedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSave(localValue);
        lastSavedRef.current = localValue;
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localValue, isEditing, onSave]);

  // Save and exit edit mode
  const handleExitEditing = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (localValueRef.current !== lastSavedRef.current) {
      setIsSaving(true);
      try {
        await onSave(localValueRef.current);
        lastSavedRef.current = localValueRef.current;
      } finally {
        setIsSaving(false);
      }
    }

    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={className}>
        <div className="relative">
          <TiptapEditor
            content={localValue}
            onChange={setLocalValue}
            placeholder={placeholder}
            onBlur={handleExitEditing}
          />
          {isSaving && (
            <span className="absolute top-0 right-0 text-xs text-muted-foreground">
              Saving...
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="description-view prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 rounded-md p-2 -m-2 min-h-[40px]"
        onClick={() => setIsEditing(true)}
        dangerouslySetInnerHTML={{
          __html: localValue || `<p class="text-muted-foreground/50">${placeholder}</p>`,
        }}
      />
      <style>{`
        .description-view ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .description-view ul[data-type="taskList"] li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0.25rem 0;
        }
        .description-view ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          user-select: none;
          margin: 0;
          padding: 0;
          height: 1.25rem;
        }
        .description-view ul[data-type="taskList"] li > label input[type="checkbox"] {
          appearance: none;
          width: 1rem;
          height: 1rem;
          border: 1.5px solid hsl(var(--muted-foreground) / 0.5);
          border-radius: 0.25rem;
          margin: 0;
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
        }
        .description-view ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
          background-color: hsl(var(--primary));
          border-color: hsl(var(--primary));
        }
        .description-view ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid hsl(var(--primary-foreground));
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .description-view ul[data-type="taskList"] li > div {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
        }
        .description-view ul[data-type="taskList"] li > div > p {
          margin: 0;
          line-height: 1.25rem;
        }
        .description-view ul[data-type="taskList"] li[data-checked="true"] > div > p {
          text-decoration: line-through;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
}
