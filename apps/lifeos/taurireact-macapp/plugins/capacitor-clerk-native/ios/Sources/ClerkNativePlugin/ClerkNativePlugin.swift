import Capacitor
import Clerk
import Foundation

@objc(ClerkNativePlugin)
public class ClerkNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClerkNativePlugin"
    public let jsName = "ClerkNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithOAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise)
    ]

    private var isConfigured = false
    private var configuredPublishableKey: String?
    private var loadingTask: Task<Void, Error>?

    @MainActor
    private func getSessionInfo(isLoaded: Bool) -> [String: Any] {
        let clerk = Clerk.shared

        let sessionId = clerk.session?.id
        let userId = clerk.user?.id
        let email = clerk.user?.primaryEmailAddress?.emailAddress

        return [
            "isLoaded": isLoaded,
            "isSignedIn": sessionId != nil,
            "sessionId": sessionId as Any,
            "userId": userId as Any,
            "userEmail": email as Any
        ]
    }

    @MainActor
    private func ensureLoaded() async throws {
        let clerk = Clerk.shared

        if loadingTask == nil {
            loadingTask = Task { @MainActor in
                try await clerk.load()
            }
        }
        try await loadingTask?.value
    }

    @objc func initialize(_ call: CAPPluginCall) {
        guard let publishableKey = call.getString("publishableKey"), !publishableKey.isEmpty else {
            call.reject("Missing publishableKey")
            return
        }

        Task { @MainActor in
            do {
                if !self.isConfigured || self.configuredPublishableKey != publishableKey {
                    let clerk = Clerk.shared

                    // Use custom redirect config if provided, otherwise fall back to SDK defaults.
                    let redirectUrl = call.getString("redirectUrl")
                    let callbackUrlScheme = call.getString("callbackUrlScheme")

                    if let redirectUrl, let callbackUrlScheme {
                        let settings = Clerk.Settings(
                            redirectConfig: RedirectConfig(
                                redirectUrl: redirectUrl,
                                callbackUrlScheme: callbackUrlScheme
                            )
                        )
                        clerk.configure(publishableKey: publishableKey, settings: settings)
                    } else {
                        clerk.configure(publishableKey: publishableKey)
                    }

                    self.isConfigured = true
                    self.configuredPublishableKey = publishableKey
                    self.loadingTask = nil
                }

                try await self.ensureLoaded()
                call.resolve(self.getSessionInfo(isLoaded: true))
            } catch {
                if let apiError = error as? ClerkAPIError {
                    call.reject(apiError.longMessage ?? apiError.message ?? "Failed to load Clerk", apiError.code, apiError)
                    return
                }
                call.reject(error.localizedDescription.isEmpty ? "Failed to load Clerk" : error.localizedDescription, nil, error)
            }
        }
    }

    @objc func getSession(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                if !self.isConfigured {
                    call.resolve(self.getSessionInfo(isLoaded: false))
                    return
                }
                try await self.ensureLoaded()
                call.resolve(self.getSessionInfo(isLoaded: true))
            } catch {
                if let apiError = error as? ClerkAPIError {
                    call.reject(apiError.longMessage ?? apiError.message ?? "Failed to get session", apiError.code, apiError)
                    return
                }
                call.reject(error.localizedDescription.isEmpty ? "Failed to get session" : error.localizedDescription, nil, error)
            }
        }
    }

    @objc func getToken(_ call: CAPPluginCall) {
        let template = call.getString("template")
        let skipCache = call.getBool("skipCache") ?? false

        Task { @MainActor in
            do {
                if !self.isConfigured {
                    call.reject("Clerk not initialized (call initialize first)")
                    return
                }
                try await self.ensureLoaded()

                guard let session = Clerk.shared.session else {
                    call.resolve(["jwt": NSNull()])
                    return
                }

                let token = try await session.getToken(.init(template: template, skipCache: skipCache))
                call.resolve(["jwt": token?.jwt as Any])
            } catch {
                if let apiError = error as? ClerkAPIError {
                    call.reject(apiError.longMessage ?? apiError.message ?? "Failed to get token", apiError.code, apiError)
                    return
                }
                call.reject(error.localizedDescription.isEmpty ? "Failed to get token" : error.localizedDescription, nil, error)
            }
        }
    }

    @objc func signInWithOAuth(_ call: CAPPluginCall) {
        guard let provider = call.getString("provider") else {
            call.reject("Missing provider")
            return
        }
        let prefersEphemeral = call.getBool("prefersEphemeralWebBrowserSession") ?? false

        Task { @MainActor in
            do {
                if !self.isConfigured {
                    call.reject("Clerk not initialized (call initialize first)")
                    return
                }

                // Load state first so we can short-circuit if we're already signed in.
                try await self.ensureLoaded()
                if Clerk.shared.session != nil {
                    call.resolve(self.getSessionInfo(isLoaded: true))
                    return
                }

                let oauthProvider: OAuthProvider
                switch provider {
                case "google":
                    oauthProvider = .google
                case "apple":
                    oauthProvider = .apple
                default:
                    call.reject("Unsupported provider: \(provider)")
                    return
                }

                // Clerk iOS SDK handles the ASWebAuthenticationSession + redirect.
                try await SignIn.authenticateWithRedirect(
                    strategy: .oauth(provider: oauthProvider),
                    prefersEphemeralWebBrowserSession: prefersEphemeral
                )

                // Refresh state post-auth.
                try await self.ensureLoaded()
                call.resolve(self.getSessionInfo(isLoaded: true))
            } catch {
                // If the user is already signed in, Clerk may throw `session_exists`.
                // Treat that as success and return the current session.
                if let apiError = error as? ClerkAPIError, apiError.code == "session_exists" {
                    try? await self.ensureLoaded()
                    call.resolve(self.getSessionInfo(isLoaded: true))
                    return
                }
                if let apiError = error as? ClerkAPIError {
                    call.reject(apiError.longMessage ?? apiError.message ?? "OAuth sign-in failed", apiError.code, apiError)
                    return
                }
                call.reject(error.localizedDescription.isEmpty ? "OAuth sign-in failed" : error.localizedDescription, nil, error)
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                if !self.isConfigured {
                    call.resolve()
                    return
                }
                try await self.ensureLoaded()
                try await Clerk.shared.signOut()
                call.resolve()
            } catch {
                if let apiError = error as? ClerkAPIError {
                    call.reject(apiError.longMessage ?? apiError.message ?? "Sign out failed", apiError.code, apiError)
                    return
                }
                call.reject(error.localizedDescription.isEmpty ? "Sign out failed" : error.localizedDescription, nil, error)
            }
        }
    }
}
