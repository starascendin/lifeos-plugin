import { AppShell } from "./AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUser } from "@clerk/clerk-react";
import { api } from "@holaai/convex";
import { useAction, useQuery } from "convex/react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

export function LifeOSDashboard() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { user } = useUser();
  const currentUser = useQuery(api.common.users.currentUser);
  const [connectionStatus, setConnectionStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const testConnection = useAction(api.common.dev.testConvexConnection);

  const handleTestConnection = async () => {
    setConnectionStatus({ loading: true });
    try {
      const result = await testConnection();
      setConnectionStatus({
        loading: false,
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      setConnectionStatus({
        loading: false,
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl">LifeOS Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here is your account overview!.
        </p>
      </div>

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Clerk User Profile</CardTitle>
          <CardDescription>Your Clerk authentication details</CardDescription>
        </CardHeader>
        <CardContent>
          {user && (
            <div className="flex items-center gap-4">
              {user.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              )}
              <div className="space-y-1">
                <p className="font-medium">{user.fullName || "Not set"}</p>
                <p className="text-muted-foreground text-sm">
                  {user.primaryEmailAddress?.emailAddress || "No email"}
                </p>
                <div>
                  <Badge variant="secondary">Clerk ID: {user.id}</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convex User Card */}
      <Card>
        <CardHeader>
          <CardTitle>Convex User Record</CardTitle>
          <CardDescription>
            Your synced user data in Convex (via @holaai/convex)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentUser === undefined ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Convex user...
            </div>
          ) : currentUser === null ? (
            <p className="text-muted-foreground">
              No Convex user found (EnsureUser should create one)
            </p>
          ) : (
            <div className="space-y-2">
              <p>
                <span className="font-medium">Convex ID:</span>{" "}
                {currentUser._id}
              </p>
              <p>
                <span className="font-medium">Token Identifier:</span>{" "}
                {currentUser.tokenIdentifier}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {currentUser.email || "Not set"}
              </p>
              <p>
                <span className="font-medium">Name:</span>{" "}
                {currentUser.name || "Not set"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Test Card */}
      <Card>
        <CardHeader>
          <CardTitle>Convex Connection Test</CardTitle>
          <CardDescription>
            Test the connection to @holaai/convex backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleTestConnection}
            disabled={connectionStatus.loading}
          >
            {connectionStatus.loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>

          {connectionStatus.success !== undefined && (
            <div
              className={`flex items-center gap-2 ${
                connectionStatus.success ? "text-green-600" : "text-red-600"
              }`}
            >
              {connectionStatus.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span>{connectionStatus.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Current environment settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Convex URL:</span>{" "}
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {import.meta.env.VITE_CONVEX_URL || "Not set"}
              </code>
            </p>
            <div className="flex items-center gap-2">
              <span className="font-medium">Package:</span>
              <Badge>@holaai/convex (workspace)</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
