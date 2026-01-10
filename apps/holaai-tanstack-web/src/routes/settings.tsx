import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme-context";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useUser,
} from "@clerk/tanstack-react-start";
import { api } from "@holaai/convex/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CheckCircle,
  Key,
  Loader2,
  MessageSquare,
  Monitor,
  Moon,
  Send,
  Server,
  Sun,
  XCircle,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  return (
    <>
      <SignedIn>
        <AppShell>
          <SettingsContent />
        </AppShell>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function SettingsContent() {
  const { user } = useUser();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Connection test state
  const [connectionStatus, setConnectionStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  // Message state
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Convex hooks
  const testConnection = useAction(api.dev.testConvexConnection);
  const messages = useQuery(api.messages.list);
  const sendMessage = useMutation(api.messages.send);

  // Environment variables
  const convexUrl = import.meta.env.VITE_CONVEX_URL || "Not configured";
  const clerkKey =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "Not configured";
  const maskedClerkKey =
    clerkKey.length > 14
      ? `${clerkKey.slice(0, 10)}...${clerkKey.slice(-4)}`
      : clerkKey;

  // Handler functions
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

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      await sendMessage({ content: newMessage.trim() });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information from Clerk</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={user?.fullName || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.primaryEmailAddress?.emailAddress || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Profile information is managed through Clerk. Click your profile in
            the sidebar to access Clerk settings.
          </p>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the application looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
              >
                <Monitor className="mr-2 h-4 w-4" />
                System
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Current resolved theme:{" "}
            <span className="font-medium">{resolvedTheme}</span>
          </p>
        </CardContent>
      </Card>

      {/* Convex Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Convex Configuration
          </CardTitle>
          <CardDescription>
            View your backend service configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clerk Publishable Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Clerk Publishable Key</span>
            </div>
            <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {maskedClerkKey}
            </code>
          </div>

          {/* Convex URL */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Convex URL</span>
            </div>
            <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {convexUrl}
            </code>
          </div>

          {/* Connection Test */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Test Convex Connection</p>
                <p className="text-muted-foreground text-sm">
                  Verify connectivity to your Convex backend
                </p>
              </div>
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
            </div>

            {connectionStatus.success !== undefined && (
              <div
                className={`flex items-center gap-2 rounded-md p-3 ${
                  connectionStatus.success
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {connectionStatus.success ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span>{connectionStatus.message}</span>
                <Badge
                  variant={connectionStatus.success ? "default" : "destructive"}
                  className="ml-auto"
                >
                  {connectionStatus.success ? "Connected" : "Failed"}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message Test
          </CardTitle>
          <CardDescription>
            Test real-time messaging with Convex reactive queries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isSending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !newMessage.trim()}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Messages Display */}
          <div className="rounded-md border">
            <div className="border-b bg-muted/50 p-3">
              <p className="font-medium text-sm">
                Messages {messages !== undefined && `(${messages.length})`}
              </p>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto p-3">
              {messages === undefined ? (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  No messages yet. Send one to test!
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className="space-y-1 rounded-md bg-muted/50 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {message.userName || "Anonymous"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Messages update automatically via Convex's reactive queries
          </p>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>Application information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Framework:</span> TanStack Start
          </p>
          <p>
            <span className="font-medium">Router:</span> TanStack Router
            v1.134.4
          </p>
          <p>
            <span className="font-medium">Backend:</span> @holaai/convex
            (workspace package)
          </p>
          <p>
            <span className="font-medium">Authentication:</span> Clerk
          </p>
          <p>
            <span className="font-medium">UI:</span> shadcn/ui (new-york style,
            stone base)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
