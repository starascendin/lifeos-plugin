import { useEffect, useMemo, useState } from "react";
import { useSignIn } from "@clerk/clerk-react";

type StartState =
  | { status: "starting" }
  | { status: "redirecting"; to: string }
  | { status: "error"; message: string };

export function CapOAuthStart() {
  const { signIn, isLoaded } = useSignIn();
  const [state, setState] = useState<StartState>({ status: "starting" });

  const params = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isLoaded || !signIn) return;

      try {
        const strategy = params.get("strategy") || "oauth_google";
        const redirectUrlFromQuery = params.get("redirect_url") || undefined;
        const redirectUrlFromEnv = import.meta.env
          .VITE_CLERK_OAUTH_REDIRECT_URL as string | undefined;

        const defaultRedirectUrl = window.location.origin.startsWith("http")
          ? `${window.location.origin}/clerk-callback.html`
          : undefined;

        const redirectUrl =
          redirectUrlFromQuery ?? redirectUrlFromEnv ?? defaultRedirectUrl;

        if (!redirectUrl || !/^https?:\/\//.test(redirectUrl)) {
          throw new Error(
            "Invalid redirect_url. Provide ?redirect_url=https://<origin>/clerk-callback.html (or set VITE_CLERK_OAUTH_REDIRECT_URL)."
          );
        }

        const result = await (signIn as any).create({
          strategy,
          redirectUrl,
        });

        const externalUrl =
          result.firstFactorVerification?.externalVerificationRedirectURL;

        if (!externalUrl) {
          throw new Error("No external verification URL returned from Clerk.");
        }

        if (cancelled) return;
        setState({ status: "redirecting", to: externalUrl.toString() });

        // Keep the whole flow in the same browser session so Clerk cookies/state match.
        window.location.assign(externalUrl.toString());
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, signIn, params]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0b0b0c",
        color: "#f5f5f5",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 16,
          padding: "18px 16px",
          lineHeight: 1.4,
        }}
      >
        {state.status === "starting" && (
          <>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Starting Google sign-in…
            </div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              This should only take a moment.
            </div>
          </>
        )}

        {state.status === "redirecting" && (
          <>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Redirecting to Google…
            </div>
            <div style={{ opacity: 0.85, fontSize: 13, wordBreak: "break-all" }}>
              {state.to}
            </div>
          </>
        )}

        {state.status === "error" && (
          <>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Sign-in failed
            </div>
            <div style={{ opacity: 0.9, fontSize: 13, whiteSpace: "pre-wrap" }}>
              {state.message}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

