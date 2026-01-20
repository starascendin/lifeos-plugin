import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/**
 * Simple markdown textarea editor
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  className,
  minHeight = "150px",
}: MarkdownEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "resize-y font-mono text-sm",
        className
      )}
      style={{ minHeight }}
    />
  );
}
