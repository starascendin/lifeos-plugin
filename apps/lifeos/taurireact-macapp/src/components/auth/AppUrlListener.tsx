import { useCallback, useEffect, useRef } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { useSignIn, useSignUp, useClerk } from "@clerk/clerk-react";
import { isCapacitor } from "@/lib/platform";

/**
 * AppUrlListener - Handles deep link OAuth callbacks for Capacitor
 *
 * This component listens for app URL open events (deep links) and processes
 * OAuth callbacks from Clerk authentication. It handles both existing user
 * sign-ins and new user sign-ups (transfer flow).
 */
export function AppUrlListener() {
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();
  const clerk = useClerk();
  const pendingUrlRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  const handleUrlString = useCallback(
    async (urlString: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      console.log("[AppUrlListener] Processing URL:", urlString);

      try {
        // Close the in-app browser if this deep link came from an OAuth flow.
        try {
          const { Browser } = await import("@capacitor/browser");
          await Browser.close();
        } catch {
          // Ignore (plugin may be unavailable on some platforms).
        }

        const url = new URL(urlString);

        // Handle OAuth callback - check for both path formats
        if (url.pathname === "/callback" || url.host === "callback") {
          console.log("[AppUrlListener] OAuth callback detected");

          // Check if user is already signed in (might have succeeded already)
          if (clerk.session) {
            console.log(
              "[AppUrlListener] User already has active session, navigating to app"
            );
            window.location.hash = "#/lifeos";
            return;
          }

          // Extract the rotating token nonce from URL
          let rotatingTokenNonce =
            url.searchParams.get("rotating_token_nonce") ??
            url.searchParams.get("rotatingTokenNonce");

          // If not in query string, check hash fragment
          if (!rotatingTokenNonce && url.hash) {
            const hashParams = new URLSearchParams(url.hash.slice(1));
            rotatingTokenNonce = hashParams.get("rotating_token_nonce");
          }

          console.log(
            "[AppUrlListener] rotatingTokenNonce:",
            rotatingTokenNonce ? "found" : "not found"
          );

          if (rotatingTokenNonce && signIn) {
            try {
              const reloadedSignIn = await signIn.reload({ rotatingTokenNonce });
              console.log(
                "[AppUrlListener] Reloaded signIn status:",
                reloadedSignIn.status
              );

              // Check if this is a transfer scenario (new user needs to sign up)
              if (
                reloadedSignIn.firstFactorVerification?.status === "transferable"
              ) {
                console.log(
                  "[AppUrlListener] Transfer scenario - user needs to sign up"
                );

                if (!signUp) {
                  throw new Error("signUp not available for transfer");
                }

                const newSignUp = await signUp.create({ transfer: true });
                const reloadedSignUp = await newSignUp.reload({
                  rotatingTokenNonce,
                });

                if (reloadedSignUp.createdSessionId) {
                  await clerk.setActive({
                    session: reloadedSignUp.createdSessionId,
                  });
                  console.log(
                    "[AppUrlListener] Session activated from signUp"
                  );
                  // Navigate to LifeOS
                  window.location.hash = "#/lifeos";
                } else {
                  throw new Error("No session ID after signUp reload");
                }
              } else if (reloadedSignIn.createdSessionId) {
                // Normal sign-in flow - existing user
                await clerk.setActive({
                  session: reloadedSignIn.createdSessionId,
                });
                console.log("[AppUrlListener] Session activated from signIn");
                // Navigate to LifeOS
                window.location.hash = "#/lifeos";
              } else {
                throw new Error("No session ID after signIn reload");
              }
            } catch (error) {
              console.error(
                "[AppUrlListener] Error processing OAuth callback:",
                error
              );
            }
          } else if (!rotatingTokenNonce) {
            // No nonce - try polling (production mode)
            console.log(
              "[AppUrlListener] No nonce in callback, polling signIn status..."
            );

            // First check if there's already an active session (OAuth might have auto-completed)
            if (clerk.session) {
              console.log(
                "[AppUrlListener] Active session found, navigating to app"
              );
              window.location.hash = "#/lifeos";
              return;
            }

            if (!signIn) return;

            let attempts = 0;
            const maxAttempts = 10;
            const pollInterval = 1000;

            while (attempts < maxAttempts) {
              attempts++;
              console.log(
                `[AppUrlListener] Polling attempt ${attempts}/${maxAttempts}...`
              );

              try {
                const reloadedSignIn = await signIn.reload();

                if (
                  reloadedSignIn.status === "complete" &&
                  reloadedSignIn.createdSessionId
                ) {
                  await clerk.setActive({
                    session: reloadedSignIn.createdSessionId,
                  });
                  console.log(
                    "[AppUrlListener] Session activated via polling"
                  );
                  window.location.hash = "#/lifeos";
                  return;
                }

                if (
                  reloadedSignIn.firstFactorVerification?.status === "transferable"
                ) {
                  console.log(
                    "[AppUrlListener] Transfer scenario detected via polling"
                  );
                  if (!signUp)
                    throw new Error("signUp not available for transfer");

                  const newSignUp = await signUp.create({ transfer: true });
                  const reloadedSignUp = await newSignUp.reload();

                  if (reloadedSignUp.createdSessionId) {
                    await clerk.setActive({
                      session: reloadedSignUp.createdSessionId,
                    });
                    console.log(
                      "[AppUrlListener] Session activated from signUp via polling"
                    );
                    window.location.hash = "#/lifeos";
                    return;
                  }
                }
              } catch (pollError) {
                console.error(
                  "[AppUrlListener] Polling error:",
                  pollError,
                  "Message:",
                  pollError instanceof Error
                    ? pollError.message
                    : String(pollError),
                  "Stack:",
                  pollError instanceof Error ? pollError.stack : "N/A"
                );
                // If polling fails, check if there's now an active session
                if (clerk.session) {
                  console.log(
                    "[AppUrlListener] Session found after polling error, navigating to app"
                  );
                  window.location.hash = "#/lifeos";
                  return;
                }
              }

              // Wait before next poll
              await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }

            console.error(
              "[AppUrlListener] OAuth completed but session not created after polling"
            );
          }
        }
      } catch (error) {
        console.error(
          "[AppUrlListener] Error handling URL:",
          error,
          "Message:",
          error instanceof Error ? error.message : String(error),
          "Stack:",
          error instanceof Error ? error.stack : "N/A"
        );
      } finally {
        processingRef.current = false;
      }
    },
    [clerk, signIn, signUp]
  );

  useEffect(() => {
    // Only run on Capacitor
    if (!isCapacitor) return;

    const handleUrlOpen = async (event: URLOpenListenerEvent) => {
      console.log("[AppUrlListener] URL opened:", event.url);

      // On cold start, the deep link can arrive before Clerk finishes loading.
      if (!isSignInLoaded || !isSignUpLoaded) {
        pendingUrlRef.current = event.url;
        console.log(
          "[AppUrlListener] Clerk not loaded yet; queued URL for later processing"
        );
        return;
      }

      try {
        await handleUrlString(event.url);
      } catch (error) {
        console.error(
          "[AppUrlListener] Error handling URL:",
          error,
          "Message:",
          error instanceof Error ? error.message : String(error),
          "Stack:",
          error instanceof Error ? error.stack : "N/A"
        );
      }
    };

    // Add listener for app URL open events
    const listenerPromise = App.addListener("appUrlOpen", handleUrlOpen);

    // Also handle initial launch URL (cold start from deep link).
    App.getLaunchUrl()
      .then((res) => {
        if (!res?.url) return;
        console.log("[AppUrlListener] Launch URL:", res.url);

        if (!isSignInLoaded || !isSignUpLoaded) {
          pendingUrlRef.current = res.url;
          console.log(
            "[AppUrlListener] Clerk not loaded yet; queued launch URL for later processing"
          );
          return;
        }

        void handleUrlString(res.url);
      })
      .catch(() => {});

    // Cleanup on unmount
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [handleUrlString, isSignInLoaded, isSignUpLoaded]);

  useEffect(() => {
    if (!isCapacitor) return;
    if (!isSignInLoaded || !isSignUpLoaded) return;

    const pending = pendingUrlRef.current;
    if (!pending) return;

    pendingUrlRef.current = null;
    void handleUrlString(pending);
  }, [handleUrlString, isSignInLoaded, isSignUpLoaded]);

  // This component doesn't render anything
  return null;
}
