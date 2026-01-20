import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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
        // List styling
        "prose-ul:list-disc prose-ol:list-decimal",
        "prose-li:marker:text-muted-foreground",
        // Code styling
        "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        // Headings
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
        // Links
        "prose-a:text-primary prose-a:underline",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom checkbox rendering for task lists
          input: ({ checked, ...props }) => {
            if (props.type === "checkbox") {
              return (
                <span
                  className={cn(
                    "inline-flex items-center justify-center h-4 w-4 rounded border mr-2 align-text-bottom",
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/50"
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
              );
            }
            return <input {...props} />;
          },
          // Remove default list-style for task lists
          li: ({ children, className: liClassName, ...props }) => {
            const hasCheckbox = Array.isArray(children) &&
              children.some((child: any) =>
                child?.props?.type === "checkbox" ||
                (child?.type === "span" && child?.props?.className?.includes("checkbox"))
              );
            return (
              <li
                className={cn(
                  liClassName,
                  hasCheckbox && "list-none ml-0"
                )}
                {...props}
              >
                {children}
              </li>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
