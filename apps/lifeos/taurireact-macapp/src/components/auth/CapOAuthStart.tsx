import { useEffect, useRef, useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export function CapOAuthStart() {
  const { isLoaded, signIn } = useSignIn();
  const [searchParams] = useSearchParams();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !signIn) return;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const strategy = searchParams.get("strategy") ?? "oauth_google";
        if (strategy !== "oauth_google") {
          throw new Error(`Unsupported strategy: ${strategy}`);
        }

        const redirectUrlFromEnv = import.meta.env
          .VITE_CLERK_OAUTH_REDIRECT_URL as string | undefined;
        const defaultRedirectUrl = window.location.origin.startsWith("http")
          ? `${window.location.origin}/clerk-callback.html`
          : undefined;

        const redirectUrl = redirectUrlFromEnv ?? defaultRedirectUrl;
        if (!redirectUrl || !/^https?:\/\//.test(redirectUrl)) {
          throw new Error(
            "Invalid OAuth redirect URL. Set VITE_CLERK_OAUTH_REDIRECT_URL to an http(s) URL (e.g. https://www.rjlabs.dev/clerk-callback.html)."
          );
        }

        const result = await (signIn as any).create({
          strategy,
          redirectUrl,
        });

        const externalUrl =
          result.firstFactorVerification?.externalVerificationRedirectURL;
        if (!externalUrl) {
          throw new Error("No external verification URL returned from Clerk");
        }

        window.location.href = externalUrl.toString();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[CapOAuthStart] Failed to start OAuth:", e);
        setError(message);
      }
    })();
  }, [isLoaded, signIn, searchParams]);

  if (error) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, -apple-system" }}>
        <h3>OAuth start failed</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system" }}>
      Redirecting to Google…
    </div>
  );
}

