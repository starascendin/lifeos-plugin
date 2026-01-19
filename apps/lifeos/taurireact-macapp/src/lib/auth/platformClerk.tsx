import React from "react";
import type { ReactNode } from "react";
import * as ClerkReact from "@clerk/clerk-react";
import { isCapacitor } from "@/lib/platform";
import { useCapacitorAuth } from "@/lib/auth/capacitorAuth";

type UseAuthReturn = ReturnType<typeof ClerkReact.useAuth>;
type UseUserReturn = ReturnType<typeof ClerkReact.useUser>;

export function SignedIn({ children }: { children: ReactNode }) {
  if (!isCapacitor) return <ClerkReact.SignedIn>{children}</ClerkReact.SignedIn>;
  const { isLoading, isAuthenticated } = useCapacitorAuth();
  if (isLoading || !isAuthenticated) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  if (!isCapacitor) return <ClerkReact.SignedOut>{children}</ClerkReact.SignedOut>;
  const { isLoading, isAuthenticated } = useCapacitorAuth();
  if (isLoading || isAuthenticated) return null;
  return <>{children}</>;
}

export function useAuth(): UseAuthReturn {
  if (!isCapacitor) return ClerkReact.useAuth();

  // Minimal Clerk-like surface for Capacitor.
  const { isLoading, isAuthenticated, fetchAccessToken } = useCapacitorAuth();

  const getToken = async (opts?: { template?: string; skipCache?: boolean }) => {
    const template = opts?.template;
    if (template && template !== "convex") {
      console.warn(`Capacitor getToken only supports template="convex" (requested: ${template})`);
      return null;
    }
    return fetchAccessToken({ forceRefreshToken: !!opts?.skipCache });
  };

  // Cast: Clerk's hook return type is broader than we need here; consumers in this
  // app use only `isLoaded`, `isSignedIn`, and `getToken({template:"convex"})`.
  return {
    isLoaded: !isLoading,
    isSignedIn: isAuthenticated,
    sessionId: null,
    userId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    actor: null,
    has: () => false,
    getToken: getToken as any,
  } as any;
}

export function useUser(): UseUserReturn {
  if (!isCapacitor) return ClerkReact.useUser();

  const { isLoading, isAuthenticated, userId, userEmail } = useCapacitorAuth();

  const user = isAuthenticated
    ? ({
        id: userId ?? "user_capacitor",
        firstName: null,
        lastName: null,
        fullName: userEmail ? userEmail.split("@")[0] : null, // Use email prefix as name
        imageUrl: "",
        emailAddresses: userEmail ? [{ emailAddress: userEmail }] : [],
        primaryEmailAddress: userEmail ? { emailAddress: userEmail } : null,
      } as any)
    : null;

  return {
    isLoaded: !isLoading,
    isSignedIn: isAuthenticated,
    user,
  } as any;
}

export function useSession(): any {
  if (!isCapacitor) return (ClerkReact as any).useSession();
  // Enough to prevent UI from spinning forever; treat external accounts as unknown.
  return { session: { user: { externalAccounts: [] } } };
}

export function useClerk(): any {
  if (!isCapacitor) return ClerkReact.useClerk();
  const { signOut } = useCapacitorAuth();
  return {
    signOut: async () => {
      try {
        const { ClerkNative } = await import("@plebxai/capacitor-clerk-native");
        await ClerkNative.signOut();
      } catch {
        // ignore (plugin not available on web)
      }
      await signOut();
    },
  };
}

// Re-export for non-Capacitor usage sites.
export const ClerkProvider = ClerkReact.ClerkProvider;
export const AuthenticateWithRedirectCallback = ClerkReact.AuthenticateWithRedirectCallback;
export const useSignIn = ClerkReact.useSignIn;
export const useSignUp = ClerkReact.useSignUp;
