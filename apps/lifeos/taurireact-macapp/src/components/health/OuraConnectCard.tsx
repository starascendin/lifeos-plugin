import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@holaai/convex";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";

export function OuraConnectCard() {
  const getAuthUrl = useAction(api.lifeos.oura_actions.getAuthorizationUrl);
  const exchangeToken = useAction(api.lifeos.oura_actions.exchangeToken);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const url = await getAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      toast.error(`Failed to start OAuth: ${err.message}`);
      setLoading(false);
    }
  };

  const handleExchangeCode = async () => {
    if (!manualCode.trim()) return;
    setLoading(true);
    try {
      await exchangeToken({ code: manualCode.trim() });
      toast.success("Oura Ring connected!");
      setManualCode("");
      setShowManualInput(false);
    } catch (err: any) {
      toast.error(`Token exchange failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Connect Oura Ring</CardTitle>
        <CardDescription>
          Link your Oura Ring to sync sleep, activity, readiness, and health data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleConnect} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4 mr-2" />
          )}
          Connect with Oura
        </Button>

        {showManualInput && (
          <div className="flex gap-2">
            <Input
              placeholder="Paste authorization code..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExchangeCode()}
            />
            <Button onClick={handleExchangeCode} disabled={loading || !manualCode.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
