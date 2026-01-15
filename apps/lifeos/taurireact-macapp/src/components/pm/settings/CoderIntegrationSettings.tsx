import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@holaai/convex";

// Actions are in a separate file (pm_coder_actions) but exported via the api object
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  Check,
  Loader2,
  XCircle,
  Bot,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";

export function CoderIntegrationSettings() {
  const integration = useQuery(api.lifeos.pm_coder.getIntegration);
  const connectCoder = useMutation(api.lifeos.pm_coder.connectCoder);
  const disconnectCoder = useMutation(api.lifeos.pm_coder.disconnectCoder);
  const listTemplates = useAction(api.lifeos.pm_coder_actions.listTemplates);

  const [coderUrl, setCoderUrl] = useState(
    "https://coder-production-coder2.rocketjump.tech"
  );
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!apiToken.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // Save the token first
      await connectCoder({ coderUrl, coderApiToken: apiToken.trim() });

      // Test the connection by listing templates
      await listTemplates();

      setTestResult({
        success: true,
        message: "Connected successfully!",
      });
      setApiToken(""); // Clear the input on success
    } catch (e) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Connection failed",
      });
      // If connection test fails, disconnect to clean up
      try {
        await disconnectCoder();
      } catch {
        // Ignore cleanup errors
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectCoder();
      setTestResult(null);
    } catch (e) {
      console.error("Failed to disconnect:", e);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Loading state
  if (integration === undefined) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading Coder integration...</span>
      </div>
    );
  }

  // Connected state
  if (integration?.hasToken) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span className="font-medium">Connected to Coder</span>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-sm font-medium">Server</span>
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[250px]">
              {integration.coderUrl}
            </code>
          </div>

          <div className="flex justify-between items-center gap-4">
            <span className="text-sm font-medium">Connected</span>
            <span className="text-xs text-muted-foreground">
              {new Date(integration.connectedAt).toLocaleDateString()}
            </span>
          </div>

          {integration.lastUsedAt && (
            <div className="flex justify-between items-center gap-4">
              <span className="text-sm font-medium">Last Used</span>
              <span className="text-xs text-muted-foreground">
                {new Date(integration.lastUsedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {isDisconnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Disconnect
          </Button>

          <a
            href={`${integration.coderUrl}/tasks`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View Tasks in Coder
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  // Not connected state
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bot className="h-4 w-4" />
        <span>Connect your Coder account to delegate issues to AI agents</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="coder-url">Coder Server URL</Label>
          <Input
            id="coder-url"
            value={coderUrl}
            onChange={(e) => setCoderUrl(e.target.value)}
            placeholder="https://coder.example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="coder-token">API Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="coder-token"
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="coder_xxx..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          <a
            href={`${coderUrl}/settings/tokens`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Create token in Coder
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <Button
          onClick={handleConnect}
          disabled={!apiToken.trim() || isTesting}
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>

        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm ${
              testResult.success
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {testResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        <p>
          <strong>Note:</strong> Your API token is stored securely and used to
          create tasks in your Coder account. You can revoke it at any time from
          your Coder settings.
        </p>
      </div>
    </div>
  );
}
