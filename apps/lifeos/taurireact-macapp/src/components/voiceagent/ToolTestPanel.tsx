import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@holaai/convex";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, FlaskConical, Loader2, Copy, Check, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/lib/config";

// Use the Convex site URL from environment (same as app uses)
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL?.replace('.cloud', '.site') || "https://beaming-giraffe-300.convex.site";
const VOICE_AGENT_API_KEY = "voice-agent-secret-key-2024";

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
}

export function ToolTestPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUser = useQuery(api.common.users.currentUser);
  const { config } = useConfig();

  const userId = currentUser?._id;

  const handleTestTasksApi = async () => {
    if (!userId) {
      setTestResult({
        success: false,
        error: "No userId available. Make sure you are logged in.",
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      const response = await fetch(`${CONVEX_SITE_URL}/voice-agent/todays-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": VOICE_AGENT_API_KEY,
        },
        body: JSON.stringify({ userId }),
      });

      const duration = Date.now() - startTime;
      const data = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
          duration,
        });
      } else {
        setTestResult({
          success: true,
          data,
          duration,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const curlCommand = userId
    ? `curl -X POST ${CONVEX_SITE_URL}/voice-agent/todays-tasks \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${VOICE_AGENT_API_KEY}" \\
  -d '{"userId": "${userId}"}'`
    : "# Login first to get userId";

  const handleCopyCurl = async () => {
    await navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <FlaskConical className="h-4 w-4" />
          <span className="text-xs">Debug Tools</span>
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute right-0 top-full mt-2 z-50 w-[500px] bg-background border rounded-lg shadow-lg p-4">
        <div className="space-y-4">
          {/* LiveKit Environment Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                LiveKit Configuration
              </label>
              <div className="flex items-center gap-1">
                {config?.livekit.is_configured ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">OK</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 text-amber-600" />
                    <span className="text-xs text-amber-600">Not Set</span>
                  </>
                )}
              </div>
            </div>
            <div className="bg-muted rounded p-2 space-y-1">
              <div className="flex justify-between items-center">
                <code className="text-xs font-mono text-muted-foreground">LIVEKIT_URL</code>
                <code className="text-xs font-mono truncate max-w-[250px]">
                  {config?.livekit.server_url || <span className="text-muted-foreground italic">Not set</span>}
                </code>
              </div>
              <div className="flex justify-between items-center">
                <code className="text-xs font-mono text-muted-foreground">LIVEKIT_API_KEY</code>
                <code className="text-xs font-mono">
                  {config?.livekit.is_configured ? "••••••••" : <span className="text-muted-foreground italic">Not set</span>}
                </code>
              </div>
              <div className="flex justify-between items-center">
                <code className="text-xs font-mono text-muted-foreground">LIVEKIT_API_SECRET</code>
                <code className="text-xs font-mono">
                  {config?.livekit.is_configured ? "••••••••" : <span className="text-muted-foreground italic">Not set</span>}
                </code>
              </div>
            </div>
          </div>

          {/* User ID Info */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Current User ID
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono">
                {userId || "Not logged in"}
              </code>
              {userId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => navigator.clipboard.writeText(userId)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
            {!userId && (
              <p className="text-xs text-destructive">
                User not loaded yet. Wait or check authentication.
              </p>
            )}
          </div>

          {/* Test Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleTestTasksApi}
              disabled={isLoading || !userId}
              size="sm"
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              Test Get Tasks API
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={cn(
                "text-xs p-3 rounded border",
                testResult.success
                  ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                  : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    "font-medium",
                    testResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                  )}
                >
                  {testResult.success ? "Success" : "Error"}
                </span>
                {testResult.duration && (
                  <span className="text-muted-foreground">
                    {testResult.duration}ms
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs max-h-[200px] overflow-auto">
                {testResult.success
                  ? JSON.stringify(testResult.data, null, 2)
                  : testResult.error}
              </pre>
            </div>
          )}

          {/* Curl Command */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Curl Command
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                onClick={handleCopyCurl}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto">
              {curlCommand}
            </pre>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
