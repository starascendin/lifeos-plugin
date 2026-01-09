import { useSignIn, useSignUp, useClerk } from "@clerk/clerk-react";
import { useState, useRef } from "react";
import { isTauri, isCapacitor } from "@/lib/platform";

export function SignIn() {
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();
  const clerk = useClerk();
  const [loadingMode, setLoadingMode] = useState<
    null | "google" | "password" | "2fa" | "signup" | "email_code"
  >(null);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<number | null>(null);

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const [signUpStep, setSignUpStep] = useState<"form" | "verify_email">("form");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");
  const [signUpEmailCode, setSignUpEmailCode] = useState("");

  const isDevOrStaging = import.meta.env.MODE === "development" || import.meta.env.MODE === "staging";
  const testUserLoginEnabled =
    isDevOrStaging &&
    import.meta.env.VITE_ENABLE_TEST_USER_LOGIN === "true" &&
    !!import.meta.env.E2E_TEST_USER_EMAIL &&
    !!import.meta.env.E2E_TEST_USER_PASSWORD;

  const goToLifeOS = () => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash === "#/lifeos" || hash.startsWith("#/lifeos/")) return;
    window.location.hash = "#/lifeos";
  };

  const handleGoogleSignIn = async () => {
    console.log("[SignIn] handleGoogleSignIn called, isLoaded:", isSignInLoaded, "signIn:", !!signIn);
    if (!isSignInLoaded || !signIn) {
      console.log("[SignIn] Not ready - isLoaded:", isSignInLoaded, "signIn:", !!signIn);
      return;
    }

    setLoadingMode("google");
    setError(null);

    try {
      // If there's already a session, sign out first to avoid "You're already signed in" error
      if (clerk.session) {
        console.log("[SignIn] Active session detected, signing out before OAuth...");
        await clerk.signOut();
        // Wait a bit for sign out to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (isTauri) {
        // For Tauri: Use localhost server for OAuth callback
        console.log("[SignIn] Using external browser OAuth flow with localhost callback...");

        // Import Tauri APIs
        const { open } = await import("@tauri-apps/plugin-shell");
        const { start, onUrl, cancel } = await import("@fabianlars/tauri-plugin-oauth");

        // Start the localhost OAuth server on a fixed port for consistent redirect URL
        const port = await start({ ports: [3847] });
        portRef.current = port;
        console.log("[SignIn] OAuth server started on port:", port);

        // Create the OAuth sign-in with localhost redirect
        const redirectUrl = `http://localhost:${port}/callback`;
        console.log("[SignIn] Creating OAuth flow with redirect:", redirectUrl);

        const result = await signIn.create({
          strategy: "oauth_google",
          redirectUrl,
        });

        console.log("[SignIn] signIn.create result:", result);

        // Get the external verification URL
        const externalUrl = result.firstFactorVerification?.externalVerificationRedirectURL;

        if (!externalUrl) {
          await cancel(port);
          throw new Error("No external verification URL returned from Clerk");
        }

        console.log("[SignIn] Opening external browser:", externalUrl);

        // Listen for OAuth callback on localhost
        await onUrl(async (url) => {
          console.log("[SignIn] Localhost callback received:", url);
          try {
            // Parse the callback URL to get the rotating token nonce
            // Check both query string and hash fragment (production may use different format)
            const callbackUrl = new URL(url);
            let rotatingTokenNonce = callbackUrl.searchParams.get("rotating_token_nonce");

            // If not in query string, check hash fragment
            if (!rotatingTokenNonce && callbackUrl.hash) {
              const hashParams = new URLSearchParams(callbackUrl.hash.slice(1));
              rotatingTokenNonce = hashParams.get("rotating_token_nonce");
            }

            console.log("[SignIn] Callback URL parsed - query:", callbackUrl.search, "hash:", callbackUrl.hash);

            if (rotatingTokenNonce) {
              // Dev mode: Use the nonce to complete authentication
              console.log("[SignIn] Got rotatingTokenNonce, reloading signIn...");

              const reloadedSignIn = await signIn.reload({ rotatingTokenNonce });
              console.log("[SignIn] Reloaded signIn status:", reloadedSignIn.status);
              console.log("[SignIn] firstFactorVerification.status:", reloadedSignIn.firstFactorVerification?.status);

              // Check if this is a "transfer" scenario (new user needs to sign up)
              if (reloadedSignIn.firstFactorVerification?.status === "transferable") {
                console.log("[SignIn] Transfer scenario - user needs to sign up");

                if (!signUp) {
                  throw new Error("signUp not available for transfer");
                }

                const newSignUp = await signUp.create({ transfer: true });
                console.log("[SignIn] SignUp created with transfer, status:", newSignUp.status);

                const reloadedSignUp = await newSignUp.reload({ rotatingTokenNonce });
                console.log("[SignIn] SignUp reloaded, createdSessionId:", reloadedSignUp.createdSessionId);

                if (reloadedSignUp.createdSessionId) {
                  await clerk.setActive({ session: reloadedSignUp.createdSessionId });
                  console.log("[SignIn] Session activated from signUp");
                  goToLifeOS();
                } else {
                  throw new Error("No session ID after signUp reload");
                }
              } else {
                // Normal sign-in flow - existing user
                console.log("[SignIn] Normal sign-in flow, createdSessionId:", reloadedSignIn.createdSessionId);

                if (reloadedSignIn.createdSessionId) {
                  await clerk.setActive({ session: reloadedSignIn.createdSessionId });
                  console.log("[SignIn] Session activated from signIn");
                  goToLifeOS();
                } else {
                  throw new Error("No session ID after signIn reload");
                }
              }
            } else {
              // Production mode: No nonce in callback, try polling signIn status
              console.log("[SignIn] No nonce in callback (production mode), polling signIn status...");

              // Poll the signIn status - Clerk may have updated it server-side
              let attempts = 0;
              const maxAttempts = 10;
              const pollInterval = 1000;

              while (attempts < maxAttempts) {
                attempts++;
                console.log(`[SignIn] Polling attempt ${attempts}/${maxAttempts}...`);

                // Reload without nonce to check current status
                const reloadedSignIn = await signIn.reload();
                console.log("[SignIn] Polled status:", reloadedSignIn.status, "firstFactor:", reloadedSignIn.firstFactorVerification?.status);

                if (reloadedSignIn.status === "complete" && reloadedSignIn.createdSessionId) {
                  await clerk.setActive({ session: reloadedSignIn.createdSessionId });
                  console.log("[SignIn] Session activated via polling");
                  goToLifeOS();
                  return;
                }

                if (reloadedSignIn.firstFactorVerification?.status === "transferable") {
                  console.log("[SignIn] Transfer scenario detected via polling");
                  if (!signUp) throw new Error("signUp not available for transfer");

                  const newSignUp = await signUp.create({ transfer: true });
                  const reloadedSignUp = await newSignUp.reload();

                  if (reloadedSignUp.createdSessionId) {
                    await clerk.setActive({ session: reloadedSignUp.createdSessionId });
                    console.log("[SignIn] Session activated from signUp via polling");
                    goToLifeOS();
                    return;
                  }
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval));
              }

              throw new Error("OAuth completed but session not created after polling. Check Clerk production configuration.");
            }
          } catch (err) {
            console.error("[SignIn] Error processing callback:", err);
            setError(err instanceof Error ? err.message : "OAuth callback failed");
          } finally {
            // Clean up the OAuth server
            if (portRef.current) {
              await cancel(portRef.current);
              portRef.current = null;
            }
            setLoadingMode(null);
          }
        });

        // Open the OAuth URL in external browser
        await open(externalUrl.toString());

      } else if (isCapacitor) {
        // For Capacitor (iOS/Android): Use URL scheme callback
        console.log("[SignIn] Using Capacitor OAuth flow with URL scheme callback...");

        // Import Capacitor Browser plugin
        const { Browser } = await import("@capacitor/browser");

        // Clerk OAuth must be started from the same browser session that will follow the
        // `externalVerificationRedirectURL` (cookies/state are not shared between the
        // WKWebView and the system browser on iOS).
        //
        // So: open a hosted "/#/cap-oauth-start" route in the system browser, which
        // performs `signIn.create({ redirectUrl })` and then redirects to Google.
        //
        // After Google consent, Clerk must redirect back into the app with a
        // `rotating_token_nonce` query param so the app can reload the sign-in attempt.
        //
        // With Clerk Native API enabled, this can be a custom scheme redirect:
        //   lifeos://callback?rotating_token_nonce=...
        //
        // We still start OAuth in the system browser via a hosted "/#/cap-oauth-start" page
        // to keep the flow in a single browser session.
        const redirectUrlForClerk = "lifeos://callback";

        const envRedirectUrl = import.meta.env
          .VITE_CLERK_OAUTH_REDIRECT_URL as string | undefined;

        const startOrigin = window.location.origin.startsWith("http")
          ? window.location.origin
          : envRedirectUrl && /^https?:\/\//.test(envRedirectUrl)
            ? new URL(envRedirectUrl).origin
            : undefined;

        if (!startOrigin) {
          throw new Error(
            "Cannot determine OAuth start origin for Capacitor. Ensure the app is served from an http(s) origin (e.g. CAP_SERVER_URL in dev or CAP_SERVER_URL_PROD in prod), or set VITE_CLERK_OAUTH_REDIRECT_URL to an http(s) URL so its origin can be used."
          );
        }

        const startUrl = new URL(`${startOrigin}/#/cap-oauth-start`);
        startUrl.searchParams.set("strategy", "oauth_google");
        startUrl.searchParams.set("redirect_url", redirectUrlForClerk);

        console.log("[SignIn] Opening OAuth start page:", startUrl.toString());

        // Open in system browser (SFSafariViewController/Custom Tabs).
        // AppUrlListener will handle the deep-link callback back into the app.
        await Browser.open({ url: startUrl.toString() });

        // Note: The AppUrlListener component handles the OAuth callback
        // and completes the authentication flow

      } else {
        // For web: Use standard redirect flow
        console.log("[SignIn] Using web redirect OAuth flow...");
        await signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          // HashRouter: the callback route must live in the hash.
          redirectUrl: "/#/sso-callback",
          redirectUrlComplete: "/#/lifeos",
          // @ts-expect-error - Clerk types may not include additionalScopes but it works
          additionalScopes: ["https://www.googleapis.com/auth/youtube.readonly"],
          oidcPrompt: "consent",
        });
      }
    } catch (err) {
      console.error("[SignIn] Sign in error:", err);
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoadingMode(null);
      // Clean up on error
      if (portRef.current) {
        const { cancel } = await import("@fabianlars/tauri-plugin-oauth");
        await cancel(portRef.current);
        portRef.current = null;
      }
    }
  };

  const handlePasswordSignIn = async (opts?: {
    identifier?: string;
    password?: string;
    autoSecondFactorCode?: string;
  }) => {
    console.log("[SignIn] handlePasswordSignIn called, isLoaded:", isSignInLoaded, "signIn:", !!signIn);
    if (!isSignInLoaded || !signIn) return;

    const emailOrUsername = (opts?.identifier ?? identifier).trim();
    const passwordToUse = opts?.password ?? password;
    if (!emailOrUsername || !passwordToUse) {
      setError("Please enter your email and password.");
      return;
    }

    setLoadingMode("password");
    setError(null);
    setNeedsSecondFactor(false);
    setTwoFactorCode("");

    try {
      // Clerk custom flow: create the sign-in attempt, then attempt first factor.
      // Casting to `any` avoids coupling to Clerk internal TS types.
      const signInResource: any = signIn;

      await signInResource.create({ identifier: emailOrUsername });
      const firstFactorResult = await signInResource.attemptFirstFactor({
        strategy: "password",
        password: passwordToUse,
      });

      console.log("[SignIn] First factor result:", firstFactorResult);
      console.log("[SignIn] First factor status:", firstFactorResult?.status);
      console.log("[SignIn] supportedSecondFactors:", firstFactorResult?.supportedSecondFactors);

      if (firstFactorResult?.status === "complete" && firstFactorResult.createdSessionId) {
        await clerk.setActive({ session: firstFactorResult.createdSessionId });
        goToLifeOS();
        setLoadingMode(null);
        return;
      }

      if (firstFactorResult?.status === "needs_second_factor") {
        // Detect available 2FA strategy from the result
        const supportedFactors = firstFactorResult.supportedSecondFactors || signInResource.supportedSecondFactors || [];
        console.log("[SignIn] First factor needs 2FA. Supported factors:", supportedFactors);

        const phoneCodeFactor = supportedFactors.find((f: any) => f.strategy === "phone_code");
        const totpFactor = supportedFactors.find((f: any) => f.strategy === "totp");

        // If no 2FA strategies are available, something is misconfigured
        if (!phoneCodeFactor && !totpFactor) {
          console.error("[SignIn] needs_second_factor but no strategies available!");
          throw new Error("Sign-in requires 2FA but no 2FA methods are configured for this account. Please configure TOTP or SMS in Clerk dashboard.");
        }

        const detectedStrategy = phoneCodeFactor ? "phone_code" : "totp";
        console.log("[SignIn] Detected 2FA strategy:", detectedStrategy);
        setSecondFactorStrategy(detectedStrategy);

        // For phone_code, we need to call prepareSecondFactor first
        if (detectedStrategy === "phone_code" && phoneCodeFactor) {
          console.log("[SignIn] Preparing phone_code 2FA with phoneNumberId:", phoneCodeFactor.phoneNumberId);
          await signInResource.prepareSecondFactor({
            strategy: "phone_code",
            phoneNumberId: phoneCodeFactor.phoneNumberId,
          });
        }

        const autoCode = opts?.autoSecondFactorCode?.trim();
        setNeedsSecondFactor(true);
        if (autoCode) {
          setTwoFactorCode(autoCode);
          setLoadingMode(null);
          await handleSecondFactor({ code: autoCode, strategy: detectedStrategy });
          return;
        }
        setLoadingMode(null);
        return;
      }

      throw new Error(`Sign-in not complete (status: ${firstFactorResult?.status ?? "unknown"})`);
    } catch (err) {
      console.error("[SignIn] Password sign in error:", err);
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoadingMode(null);
    }
  };

  const [secondFactorStrategy, setSecondFactorStrategy] = useState<string | null>(null);

  const handleSecondFactor = async (opts?: { code?: string; strategy?: string }) => {
    console.log("[SignIn] handleSecondFactor called, isLoaded:", isSignInLoaded, "signIn:", !!signIn);
    if (!isSignInLoaded || !signIn) return;

    const code = (opts?.code ?? twoFactorCode).trim();
    if (!code) {
      setError("Enter your 2FA code.");
      return;
    }

    setLoadingMode("2fa");
    setError(null);

    try {
      const signInResource: any = signIn;

      // Use passed strategy, stored strategy, or detect from signIn object
      let strategy = opts?.strategy || secondFactorStrategy;

      if (!strategy) {
        const supportedFactors = signInResource.supportedSecondFactors || [];
        console.log("[SignIn] Available 2FA strategies:", supportedFactors.map((f: any) => f.strategy));

        const phoneCodeFactor = supportedFactors.find((f: any) => f.strategy === "phone_code");
        const totpFactor = supportedFactors.find((f: any) => f.strategy === "totp");
        strategy = phoneCodeFactor ? "phone_code" : totpFactor ? "totp" : "phone_code";
      }

      console.log("[SignIn] Using 2FA strategy:", strategy);

      const result = await signInResource.attemptSecondFactor({
        strategy,
        code,
      });

      if (result?.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        goToLifeOS();
        setLoadingMode(null);
        return;
      }

      throw new Error(`2FA not complete (status: ${result?.status ?? "unknown"})`);
    } catch (err) {
      console.error("[SignIn] 2FA error:", err);
      setError(err instanceof Error ? err.message : "2FA failed");
      setLoadingMode(null);
    }
  };

  const handlePasswordSignUp = async () => {
    console.log("[SignIn] handlePasswordSignUp called, isLoaded:", isSignUpLoaded, "signUp:", !!signUp);
    if (!isSignUpLoaded || !signUp) return;

    const email = signUpEmail.trim();
    if (!email || !signUpPassword) {
      setError("Please enter your email and password.");
      return;
    }
    if (signUpPassword !== signUpPasswordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoadingMode("signup");
    setError(null);

    try {
      const signUpResource: any = signUp;

      await signUpResource.create({
        emailAddress: email,
        password: signUpPassword,
      });

      if (signUpResource.status === "complete" && signUpResource.createdSessionId) {
        await clerk.setActive({ session: signUpResource.createdSessionId });
        goToLifeOS();
        setLoadingMode(null);
        return;
      }

      await signUpResource.prepareEmailAddressVerification({ strategy: "email_code" });
      setSignUpStep("verify_email");
      setLoadingMode(null);
    } catch (err) {
      console.error("[SignIn] Sign up error:", err);
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoadingMode(null);
    }
  };

  const handleVerifyEmailCode = async () => {
    console.log("[SignIn] handleVerifyEmailCode called, isLoaded:", isSignUpLoaded, "signUp:", !!signUp);
    if (!isSignUpLoaded || !signUp) return;

    const code = signUpEmailCode.trim();
    if (!code) {
      setError("Enter the email verification code.");
      return;
    }

    setLoadingMode("email_code");
    setError(null);

    try {
      const signUpResource: any = signUp;
      const result = await signUpResource.attemptEmailAddressVerification({ code });

      if (result?.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        goToLifeOS();
        setLoadingMode(null);
        return;
      }

      throw new Error(`Email verification not complete (status: ${result?.status ?? "unknown"})`);
    } catch (err) {
      console.error("[SignIn] Email verification error:", err);
      setError(err instanceof Error ? err.message : "Email verification failed");
      setLoadingMode(null);
    }
  };

  const isLoading = loadingMode !== null;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-2xl flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">LifeOS Nexus</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Your personal life operating system
        </p>
      </div>
      <div className="flex w-full max-w-sm gap-2">
        <button
          onClick={() => {
            setAuthMode("signin");
            setError(null);
            setSignUpStep("form");
          }}
          disabled={isLoading}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            authMode === "signin"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Sign in
        </button>
        <button
          onClick={() => {
            setAuthMode("signup");
            setError(null);
            setShowEmailPassword(false);
            setNeedsSecondFactor(false);
          }}
          disabled={isLoading}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            authMode === "signup"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Sign up
        </button>
      </div>

      {authMode === "signin" ? (
        <>
          <button
            onClick={handleGoogleSignIn}
            disabled={!isSignInLoaded || isLoading}
            className="mt-4 flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loadingMode === "google" ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Opening browser...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="mt-6 w-full max-w-sm">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-[var(--text-secondary)]">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {testUserLoginEnabled && (
              <button
                onClick={() => {
                  const email = import.meta.env.E2E_TEST_USER_EMAIL as string | undefined;
                  const pw = import.meta.env.E2E_TEST_USER_PASSWORD as string | undefined;
                  const code = import.meta.env.E2E_TEST_USER_2FA_CODE as string | undefined;
                  setError(null);
                  setShowEmailPassword(true);
                  setIdentifier(email ?? "");
                  setPassword(pw ?? "");
                  void handlePasswordSignIn({
                    identifier: email,
                    password: pw,
                    autoSecondFactorCode: code,
                  });
                }}
                disabled={!isSignInLoaded || isLoading}
                className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                Sign in with Test User
              </button>
            )}

            {!showEmailPassword ? (
              <button
                onClick={() => {
                  setError(null);
                  setShowEmailPassword(true);
                }}
                disabled={isLoading}
                className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Sign in with email & password
              </button>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (needsSecondFactor) {
                    void handleSecondFactor();
                  } else {
                    void handlePasswordSignIn();
                  }
                }}
              >
                {!needsSecondFactor ? (
                  <>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">Email</label>
                      <input
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        disabled={isLoading}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={isLoading}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!isSignInLoaded || isLoading}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loadingMode === "password" ? "Signing in..." : "Sign in"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">2FA code</label>
                      <input
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value)}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        disabled={isLoading}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!isSignInLoaded || isLoading}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loadingMode === "2fa" ? "Verifying..." : "Verify"}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setNeedsSecondFactor(false);
                        setTwoFactorCode("");
                        setError(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      Back
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 w-full max-w-sm">
          {signUpStep === "form" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handlePasswordSignUp();
              }}
            >
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Email</label>
                <input
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Password</label>
                <input
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Confirm password</label>
                <input
                  type="password"
                  value={signUpPasswordConfirm}
                  onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!isSignUpLoaded || isLoading}
                className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingMode === "signup" ? "Creating account..." : "Create account"}
              </button>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleVerifyEmailCode();
              }}
            >
              <p className="text-xs text-[var(--text-secondary)]">
                Enter the verification code sent to <span className="font-medium">{signUpEmail}</span>.
              </p>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Email verification code</label>
                <input
                  value={signUpEmailCode}
                  onChange={(e) => setSignUpEmailCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!isSignUpLoaded || isLoading}
                className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingMode === "email_code" ? "Verifying..." : "Verify email"}
              </button>
              <button
                type="button"
                disabled={!isSignUpLoaded || isLoading}
                onClick={async () => {
                  setError(null);
                  setLoadingMode("email_code");
                  try {
                    const signUpResource: any = signUp;
                    await signUpResource.prepareEmailAddressVerification({ strategy: "email_code" });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to resend code");
                  } finally {
                    setLoadingMode(null);
                  }
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setSignUpStep("form");
                  setSignUpEmailCode("");
                  setError(null);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
      )}

      {loadingMode === "google" && (
        <p className="mt-4 text-sm text-[var(--text-secondary)] text-center">
          Complete sign-in in your browser, then return here.
        </p>
      )}
    </div>
  );
}
