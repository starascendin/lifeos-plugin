"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@holaai/convex/convex/_generated/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Server,
  Key,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

export default function SettingsPage() {
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState<string>("");

  const testConnection = useAction(api.dev.testConvexConnection);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "Not configured";
  const clerkKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "Not configured";

  const maskedClerkKey =
    clerkKey.length > 14
      ? `${clerkKey.slice(0, 10)}...${clerkKey.slice(-4)}`
      : clerkKey;

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    try {
      const result = await testConnection();
      if (result.success) {
        setConnectionStatus("success");
        setConnectionMessage(result.message || "Connection successful");
      } else {
        setConnectionStatus("error");
        setConnectionMessage("Connection failed");
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionMessage(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink>Settings</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your application settings and configurations
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Developer / Connection Info
              </CardTitle>
              <CardDescription>
                View your authentication and backend service configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Clerk Publishable Key</span>
                </div>
                <code className="block bg-muted px-3 py-2 rounded-md text-sm font-mono">
                  {maskedClerkKey}
                </code>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Convex URL</span>
                </div>
                <code className="block bg-muted px-3 py-2 rounded-md text-sm font-mono">
                  {convexUrl}
                </code>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Test Convex Connection</p>
                    <p className="text-sm text-muted-foreground">
                      Verify connectivity to your Convex backend
                    </p>
                  </div>
                  <Button
                    onClick={handleTestConnection}
                    disabled={connectionStatus === "testing"}
                  >
                    {connectionStatus === "testing" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Testing...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                </div>

                {connectionStatus !== "idle" &&
                  connectionStatus !== "testing" && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-md ${
                        connectionStatus === "success"
                          ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                          : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {connectionStatus === "success" ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                      <span>{connectionMessage}</span>
                      <Badge
                        variant={
                          connectionStatus === "success"
                            ? "default"
                            : "destructive"
                        }
                        className="ml-auto"
                      >
                        {connectionStatus === "success"
                          ? "Connected"
                          : "Failed"}
                      </Badge>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
