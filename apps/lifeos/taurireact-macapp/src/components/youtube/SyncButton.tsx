import { useSession } from "@/lib/auth/platformClerk";
import { useYouTubeSync } from "../../lib/contexts/SyncContext";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Youtube,
} from "lucide-react";

export function SyncButton() {
  const { session } = useSession();
  const { progress, startSync } = useYouTubeSync();
  const [hasYouTubeAccess, setHasYouTubeAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (session?.user?.externalAccounts) {
      const googleAccount = session.user.externalAccounts.find(
        (account: any) => account.provider === "google"
      );
      setHasYouTubeAccess(!!googleAccount);
    }
  }, [session]);

  const handleSync = async () => {
    console.log("[SyncButton] handleSync called");
    await startSync();
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (progress.totalPlaylists === 0) return 0;
    return Math.round(
      (progress.completedPlaylists / progress.totalPlaylists) * 100
    );
  };

  if (hasYouTubeAccess === null) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasYouTubeAccess) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Sign out and sign back in with Google to enable YouTube sync.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {progress.status === "syncing" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Syncing...</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {progress.currentStep}
            </p>
            <Progress value={getProgressPercentage()} className="h-2" />
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                Playlists: {progress.completedPlaylists}/{progress.totalPlaylists}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Videos: {progress.completedVideos}/{progress.totalVideos}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Transcripts: {progress.transcriptsFetched}
              </Badge>
            </div>
          </div>
        ) : progress.status === "complete" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Sync complete!</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Synced {progress.completedPlaylists} playlists,{" "}
              {progress.completedVideos} videos, {progress.transcriptsFetched}{" "}
              transcripts
            </p>
            <Button onClick={handleSync} className="w-full" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Again
            </Button>
          </div>
        ) : progress.status === "error" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Sync failed</span>
            </div>
            <p className="text-xs text-muted-foreground">{progress.error}</p>
            <Button
              onClick={handleSync}
              variant="destructive"
              className="w-full"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Sync
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="text-green-600 border-green-600"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                YouTube Connected
              </Badge>
            </div>
            <Button onClick={handleSync} className="w-full" size="sm">
              <Youtube className="h-4 w-4 mr-2" />
              Sync Playlists
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
