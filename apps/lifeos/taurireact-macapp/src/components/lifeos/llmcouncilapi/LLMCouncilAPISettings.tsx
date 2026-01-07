import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LLMCouncilAPISettingsProps {
  baseUrl: string;
  apiKey: string;
  onSave: (baseUrl: string, apiKey: string) => void;
}

export function LLMCouncilAPISettings({
  baseUrl,
  apiKey,
  onSave,
}: LLMCouncilAPISettingsProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(baseUrl);
  const [key, setKey] = useState(apiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Update local state when props change
  useEffect(() => {
    setUrl(baseUrl);
    setKey(apiKey);
  }, [baseUrl, apiKey]);

  const handleTest = async () => {
    if (!url || !key) {
      setTestResult({ success: false, message: "URL and API Key are required" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`${url}health`, {
        headers: { "X-API-Key": key },
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          message: data.extensionConnected
            ? "Connected! Extension is online."
            : "Server reachable, but extension offline.",
        });
      } else if (res.status === 401) {
        setTestResult({ success: false, message: "Invalid API Key (401)" });
      } else {
        setTestResult({ success: false, message: `Error: ${res.status}` });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave(url, key);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Settings</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Council API Settings</DialogTitle>
          <DialogDescription>
            Configure the connection to your LLM Council proxy server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">Server URL</Label>
            <Input
              id="url"
              placeholder="https://council-proxy.example.com/"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Include trailing slash (e.g., https://council-proxy.tail05d28.ts.net/)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="your-api-key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setTestResult(null);
              }}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`rounded-lg p-3 text-sm ${
                testResult.success
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !url || !key}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button onClick={handleSave} disabled={!url || !key}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
