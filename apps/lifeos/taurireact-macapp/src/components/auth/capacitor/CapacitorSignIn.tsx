import { useMemo, useState } from "react";
import { isCapacitor } from "@/lib/platform";
import { useCapacitorAuth, getApiBaseUrlForCapacitor } from "@/lib/auth/capacitorAuth";
import { ClerkNative } from "@plebxai/capacitor-clerk-native";

export function CapacitorSignIn() {
  const { completeSignIn } = useCapacitorAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  const apiBaseUrl = useMemo(() => getApiBaseUrlForCapacitor(), []);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!isCapacitor) throw new Error("Not running in Capacitor");
      if (!publishableKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

      await ClerkNative.initialize({ publishableKey });

      const session = await ClerkNative.signInWithOAuth({
        provider: "google",
        // After sign-out, this prevents silently reusing the previous Google account.
        prefersEphemeralWebBrowserSession: true,
      });

      if (!session.sessionId) throw new Error("No sessionId returned from native Clerk");

      await completeSignIn({
        clerkSessionId: session.sessionId,
        userId: session.userId,
        userEmail: session.userEmail,
      });

      // Navigate into the app (HashRouter).
      if (typeof window !== "undefined") {
        window.location.hash = "#/lifeos";
      }
    } catch (e: any) {
      console.error("[CapacitorSignIn] failed:", e);
      setError(e?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col gap-3 w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">LifeOS</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue.
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full rounded-md bg-black text-white py-2 px-3 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        {error && (
          <div className="text-sm text-red-600 break-words">
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          API: {apiBaseUrl}
        </div>
      </div>
    </div>
  );
}
