// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PlebxaiCapacitorClerkNative",
    platforms: [.iOS(.v17)],
    products: [
        .library(
            name: "PlebxaiCapacitorClerkNative",
            targets: ["ClerkNativePlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/clerk/clerk-ios.git", from: "0.71.4")
    ],
    targets: [
        .target(
            name: "ClerkNativePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Clerk", package: "clerk-ios")
            ],
            path: "ios/Sources/ClerkNativePlugin"
        )
    ]
)
