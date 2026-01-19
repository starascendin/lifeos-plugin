// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v17)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.0"),
        .package(name: "CapacitorApp", path: "../../../../../../node_modules/.pnpm/@capacitor+app@8.0.0_@capacitor+core@8.0.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorBrowser", path: "../../../../../../node_modules/.pnpm/@capacitor+browser@8.0.0_@capacitor+core@8.0.0/node_modules/@capacitor/browser"),
        .package(name: "CapacitorPreferences", path: "../../../../../../node_modules/.pnpm/@capacitor+preferences@8.0.0_@capacitor+core@8.0.0/node_modules/@capacitor/preferences"),
        .package(name: "CapgoCapacitorUpdater", path: "../../../../../../node_modules/.pnpm/@capgo+capacitor-updater@8.41.13_@capacitor+core@8.0.0/node_modules/@capgo/capacitor-updater"),
        .package(name: "PlebxaiCapacitorClerkNative", path: "../../../../../../node_modules/.pnpm/@plebxai+capacitor-clerk-native@file+apps+lifeos+taurireact-macapp+plugins+capacitor-clerk-native/node_modules/@plebxai/capacitor-clerk-native")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapgoCapacitorUpdater", package: "CapgoCapacitorUpdater"),
                .product(name: "PlebxaiCapacitorClerkNative", package: "PlebxaiCapacitorClerkNative")
            ]
        )
    ]
)
