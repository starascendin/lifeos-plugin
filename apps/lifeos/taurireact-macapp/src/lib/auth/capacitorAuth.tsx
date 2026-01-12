import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Preferences } from "@capacitor/preferences";

const STORAGE_KEYS = {
  clerkSessionId: "auth.clerkSessionId",
  userId: "auth.userId",
  userEmail: "auth.userEmail",
  convexToken: "auth.convexToken",
  convexTokenUpdatedAtMs: "auth.convexTokenUpdatedAtMs",
} as const;

function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (!exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + skewSeconds;
}

async function getPref(key: string) {
  const { value } = await Preferences.get({ key });
  return value ?? null;
}

async function setPref(key: string, value: string | null) {
  if (value === null) {
    await Preferences.remove({ key });
  } else {
    await Preferences.set({ key, value });
  }
}

export type CapacitorAuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  clerkSessionId: string | null;
  convexToken: string | null;
  convexTokenUpdatedAtMs: number | null;
  completeSignIn: (args: {
    clerkSessionId: string;
    userId?: string | null;
    userEmail?: string | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  fetchAccessToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>;
};

const CapacitorAuthContext = createContext<CapacitorAuthState | null>(null);

export function useCapacitorAuth() {
  const ctx = useContext(CapacitorAuthContext);
  if (!ctx) throw new Error("Missing <CapacitorAuthProvider />");
  return ctx;
}

export function useConvexAuthFromCapacitor() {
  const { isLoading, isAuthenticated, fetchAccessToken } = useCapacitorAuth();
  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
  );
}

export function getApiBaseUrlForCapacitor(): string {
  // Prefer the origin of the hosted OAuth redirect page (same deployment),
  // otherwise fall back to current origin if it's http(s).
  const redirectUrl = import.meta.env.VITE_CLERK_OAUTH_REDIRECT_URL as string | undefined;
  if (redirectUrl) {
    try {
      return new URL(redirectUrl).origin;
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined" && /^https?:\/\//.test(window.location.origin)) {
    return window.location.origin;
  }

  // Last resort: hard-code your production web origin.
  return "https://www.rjlabs.dev";
}

export function CapacitorAuthProvider({
  apiBaseUrl,
  children,
}: {
  apiBaseUrl: string;
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [clerkSessionId, setClerkSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [convexToken, setConvexToken] = useState<string | null>(null);
  const [convexTokenUpdatedAtMs, setConvexTokenUpdatedAtMs] = useState<number | null>(null);

  // Keep refs in sync so `fetchAccessToken` stays stable (Convex will re-run auth if
  // the callback identity changes).
  const clerkSessionIdRef = useRef<string | null>(null);
  const convexTokenRef = useRef<string | null>(null);
  useEffect(() => {
    clerkSessionIdRef.current = clerkSessionId;
  }, [clerkSessionId]);
  useEffect(() => {
    convexTokenRef.current = convexToken;
  }, [convexToken]);

  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const mintConvexToken = useCallback(
    async (sessionId: string) => {
      // Prefer minting via the native Clerk iOS SDK when available (no server secret required).
      if (typeof window !== "undefined" && "Capacitor" in window) {
        try {
          const { ClerkNative } = await import("@plebxai/capacitor-clerk-native");
          const resp = await ClerkNative.getToken({ template: "convex" });
          if (resp?.jwt && typeof resp.jwt === "string") {
            return resp.jwt;
          }
        } catch {
          // Fall through to server mint.
        }
      }

      const resp = await fetch(`${apiBaseUrl}/api/session-to-convex-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(
          `Failed to mint Convex token (${resp.status}): ${text || resp.statusText}`
        );
      }

      const data = await resp.json();
      const token = (data as any).jwt || (data as any).token || null;
      if (!token || typeof token !== "string") {
        throw new Error("Invalid token response from server");
      }

      const payload = decodeJwtPayload(token);
      console.log("Minted Convex JWT:", {
        iss: payload?.iss,
        aud: payload?.aud,
        sub: payload?.sub,
        exp: payload?.exp,
      });

      return token;
    },
    [apiBaseUrl]
  );

  const refreshConvexToken = useCallback(
    async (sessionId: string) => {
      if (refreshInFlight.current) return refreshInFlight.current;
      refreshInFlight.current = (async () => {
        try {
          const token = await mintConvexToken(sessionId);
          const now = Date.now();
          setConvexToken(token);
          setConvexTokenUpdatedAtMs(now);
          await setPref(STORAGE_KEYS.convexToken, token);
          await setPref(STORAGE_KEYS.convexTokenUpdatedAtMs, String(now));
          return token;
        } finally {
          refreshInFlight.current = null;
        }
      })();
      return refreshInFlight.current;
    },
    [mintConvexToken]
  );

  const signOut = useCallback(async () => {
    setClerkSessionId(null);
    setUserId(null);
    setUserEmail(null);
    setConvexToken(null);
    setConvexTokenUpdatedAtMs(null);

    await Promise.all([
      setPref(STORAGE_KEYS.clerkSessionId, null),
      setPref(STORAGE_KEYS.userId, null),
      setPref(STORAGE_KEYS.userEmail, null),
      setPref(STORAGE_KEYS.convexToken, null),
      setPref(STORAGE_KEYS.convexTokenUpdatedAtMs, null),
    ]);
  }, []);

  const completeSignIn = useCallback(
    async (args: { clerkSessionId: string; userId?: string | null; userEmail?: string | null }) => {
      const nextSessionId = args.clerkSessionId;
      const nextUserId = args.userId ?? null;
      const nextUserEmail = args.userEmail ?? null;

      setClerkSessionId(nextSessionId);
      setUserId(nextUserId);
      setUserEmail(nextUserEmail);

      await Promise.all([
        setPref(STORAGE_KEYS.clerkSessionId, nextSessionId),
        setPref(STORAGE_KEYS.userId, nextUserId),
        setPref(STORAGE_KEYS.userEmail, nextUserEmail),
      ]);

      const token = await refreshConvexToken(nextSessionId);
      setConvexToken(token);
    },
    [refreshConvexToken]
  );

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const sessionId = clerkSessionIdRef.current;
      const token = convexTokenRef.current;
      if (!sessionId) return null;
      if (!forceRefreshToken && token && !isJwtExpired(token)) {
        return token;
      }
      try {
        return await refreshConvexToken(sessionId);
      } catch (e) {
        console.error("Failed to refresh token, signing out:", e);
        await signOut();
        return null;
      }
    },
    [refreshConvexToken, signOut]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedSessionId, storedUserId, storedUserEmail, storedToken, storedUpdatedAtRaw] =
          await Promise.all([
            getPref(STORAGE_KEYS.clerkSessionId),
            getPref(STORAGE_KEYS.userId),
            getPref(STORAGE_KEYS.userEmail),
            getPref(STORAGE_KEYS.convexToken),
            getPref(STORAGE_KEYS.convexTokenUpdatedAtMs),
          ]);

        if (cancelled) return;

        const storedUpdatedAtMs = storedUpdatedAtRaw ? Number(storedUpdatedAtRaw) : null;

        setClerkSessionId(storedSessionId);
        setUserId(storedUserId);
        setUserEmail(storedUserEmail);
        setConvexToken(storedToken);
        setConvexTokenUpdatedAtMs(Number.isFinite(storedUpdatedAtMs as any) ? storedUpdatedAtMs : null);

        // Best-effort refresh on startup if we have a session id but no valid token.
        if (storedSessionId && (!storedToken || isJwtExpired(storedToken))) {
          try {
            await refreshConvexToken(storedSessionId);
          } catch (e) {
            console.error("Startup token refresh failed:", e);
            await signOut();
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshConvexToken, signOut]);

  const value = useMemo<CapacitorAuthState>(
    () => ({
      isLoading,
      isAuthenticated: !!clerkSessionId,
      userId,
      userEmail,
      clerkSessionId,
      convexToken,
      convexTokenUpdatedAtMs,
      completeSignIn,
      signOut,
      fetchAccessToken,
    }),
    [
      isLoading,
      clerkSessionId,
      userId,
      userEmail,
      convexToken,
      convexTokenUpdatedAtMs,
      completeSignIn,
      signOut,
      fetchAccessToken,
    ]
  );

  return (
    <CapacitorAuthContext.Provider value={value}>
      {children}
    </CapacitorAuthContext.Provider>
  );
}
