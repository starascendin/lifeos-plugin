import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingIndicatorProps {
  content: string;
  isLoading: boolean;
}

export function StreamingIndicator({ content, isLoading }: StreamingIndicatorProps) {
  return (
    <div className="flex justify-start mt-3">
      <div className="max-w-[85%] rounded-lg px-4 py-2 bg-muted text-foreground">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <LoadingDots />
            <span className="text-sm text-muted-foreground">
              Thinking...
            </span>
          </div>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
            <div className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
          </>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
