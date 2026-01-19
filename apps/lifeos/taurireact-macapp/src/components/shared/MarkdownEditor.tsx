import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Eye, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  readOnly?: boolean;
}

/**
 * Markdown editor with edit/preview toggle
 * - Edit mode: Textarea for editing markdown
 * - Preview mode: Rendered markdown display
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  className,
  minHeight = "200px",
  readOnly = false,
}: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  if (readOnly) {
    return (
      <div className={cn("rounded-md border border-border p-4", className)}>
        {value ? (
          <MarkdownRenderer content={value} />
        ) : (
          <p className="text-muted-foreground text-sm italic">No content</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/50">
        <span className="text-xs text-muted-foreground">
          {isPreview ? "Preview" : "Edit"} mode
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPreview(!isPreview)}
          className="h-7 px-2"
        >
          {isPreview ? (
            <>
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              Edit
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Preview
            </>
          )}
        </Button>
      </div>

      {/* Content area */}
      <div className="p-3" style={{ minHeight }}>
        {isPreview ? (
          value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-muted-foreground text-sm italic">
              Nothing to preview
            </p>
          )
        ) : (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[180px] resize-y border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ minHeight }}
          />
        )}
      </div>
    </div>
  );
}
