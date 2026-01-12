export type ClerkOAuthProvider = "google" | "apple";

export interface ClerkNativeInitializeOptions {
  publishableKey: string;
}

export interface ClerkNativeSessionInfo {
  isLoaded: boolean;
  isSignedIn: boolean;
  sessionId: string | null;
  userId: string | null;
  userEmail: string | null;
}

export interface ClerkNativeSignInOptions {
  provider: ClerkOAuthProvider;
  /**
   * If true, uses an ephemeral ASWebAuthenticationSession so provider cookies
   * aren't reused. This is the most reliable way to show the Google account
   * picker after signing out.
   */
  prefersEphemeralWebBrowserSession?: boolean;
}

export interface ClerkNativePlugin {
  initialize(options: ClerkNativeInitializeOptions): Promise<ClerkNativeSessionInfo>;
  getSession(): Promise<ClerkNativeSessionInfo>;
  getToken(options?: { template?: string; skipCache?: boolean }): Promise<{ jwt: string | null }>;
  signInWithOAuth(options: ClerkNativeSignInOptions): Promise<ClerkNativeSessionInfo>;
  signOut(): Promise<void>;
}
