import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with GFM support (tables, checkboxes, strikethrough, etc.)
 * Display-only - checkboxes are not interactive
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        // Table styling
        "prose-table:border-collapse prose-table:w-full",
        "prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-muted prose-th:text-left",
        "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2",
        // Checkbox styling
        "prose-li:marker:text-muted-foreground",
        // Code styling
        "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        // Headings
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
        // Links
        "prose-a:text-primary prose-a:underline",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
