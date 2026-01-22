import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, User, Bot, AlertCircle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClaudeCodeResultEntry } from "@/lib/contexts/ClaudeCodeContext";

interface ResultDisplayProps {
  results: ClaudeCodeResultEntry[];
  jsonDebugMode: boolean;
}

interface ParsedClaudeOutput {
  type: string;
  subtype: string;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id?: string;
}

function parseClaudeJsonOutput(output: string): ParsedClaudeOutput | null {
  try {
    const parsed = JSON.parse(output);
    if (parsed.type === "result" && typeof parsed.result === "string") {
      return parsed as ParsedClaudeOutput;
    }
    return null;
  } catch {
    return null;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom table styling for better readability
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          // Code blocks
          pre: ({ children }) => (
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function JsonDebugPanel({ json, parsed }: { json: string; parsed: ParsedClaudeOutput | null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }, [json]);

  return (
    <div className="mt-3 border rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-xs"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="font-medium">JSON Debug Output</span>
        </div>
        {parsed && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>{parsed.num_turns} turns</span>
            <span>{parsed.duration_ms}ms total</span>
            <span>{parsed.duration_api_ms}ms API</span>
          </div>
        )}
      </button>
      {isExpanded && (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <CopyButton text={formattedJson} />
          </div>
          <pre className="p-3 text-xs overflow-x-auto max-h-[400px] overflow-y-auto bg-muted/30">
            {formattedJson}
          </pre>
        </div>
      )}
    </div>
  );
}

function ResultEntry({
  entry,
  showJson,
}: {
  entry: ClaudeCodeResultEntry;
  showJson: boolean;
}) {
  // Try to parse JSON output if available
  const parsedJson = useMemo(() => {
    if (entry.result.json_output) {
      return parseClaudeJsonOutput(entry.result.json_output);
    }
    // Also try parsing the regular output in case it's JSON
    if (entry.result.output) {
      return parseClaudeJsonOutput(entry.result.output);
    }
    return null;
  }, [entry.result.json_output, entry.result.output]);

  // Determine what content to display
  const displayContent = useMemo(() => {
    // If we have parsed JSON with a result field, use that
    if (parsedJson?.result) {
      return parsedJson.result;
    }
    // Otherwise use raw output
    return entry.result.output || "";
  }, [parsedJson, entry.result.output]);

  const isJsonResponse = parsedJson !== null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* User prompt */}
      <div className="flex items-start gap-3 p-3 bg-muted/30">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium">You</span>
            <span>·</span>
            <span>{entry.timestamp.toLocaleTimeString()}</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-xs">
              {entry.environment}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">
            {entry.prompt}
          </p>
        </div>
      </div>

      {/* AI response */}
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            entry.result.success ? "bg-green-500/10" : "bg-red-500/10"
          )}
        >
          {entry.result.success ? (
            <Bot className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span className="font-medium">Claude</span>
            {!entry.result.success && (
              <span className="text-red-500">Error</span>
            )}
            {parsedJson && (
              <span className="text-green-600">
                {parsedJson.subtype}
              </span>
            )}
          </div>

          {entry.result.success && displayContent ? (
            <MarkdownContent content={displayContent} />
          ) : (
            <p className="text-sm text-red-500">
              {entry.result.error || "Unknown error"}
            </p>
          )}

          {/* JSON Debug section - show when debug mode is on AND we have JSON */}
          {showJson && (entry.result.json_output || isJsonResponse) && (
            <JsonDebugPanel
              json={entry.result.json_output || entry.result.output || ""}
              parsed={parsedJson}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function ResultDisplay({ results, jsonDebugMode }: ResultDisplayProps) {
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No results yet</p>
          <p className="text-sm mt-1">Enter a prompt to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {results.map((entry) => (
        <ResultEntry key={entry.id} entry={entry} showJson={jsonDebugMode} />
      ))}
    </div>
  );
}
