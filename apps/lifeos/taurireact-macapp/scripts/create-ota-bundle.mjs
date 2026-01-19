#!/usr/bin/env node
/**
 * Create OTA Update Bundle
 *
 * Creates a versioned zip bundle for Capacitor OTA updates.
 * Usage: node scripts/create-ota-bundle.mjs [version]
 *
 * If no version is provided, uses package.json version + timestamp.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Get version from argument or generate one
const argVersion = process.argv[2];
let version;

if (argVersion) {
  version = argVersion;
} else {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  version = `${pkg.version}-${timestamp}`;
}

const outputDir = path.join(rootDir, "ota-bundles");
const outputFile = `ota-update-${version}.zip`;
const outputPath = path.join(outputDir, outputFile);

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log(`Creating OTA bundle v${version}...`);

// Create zip from dist folder
try {
  execSync(`cd ${path.join(rootDir, "dist")} && zip -r "${outputPath}" .`, {
    stdio: "inherit",
  });

  console.log(`\n✅ OTA bundle created successfully!`);
  console.log(`   Version: ${version}`);
  console.log(`   File: ${outputPath}`);
  console.log(`\nTo apply this update in your app, use:`);
  console.log(`   downloadAndApplyUpdate("<YOUR_SERVER_URL>/${outputFile}", "${version}")`);
} catch (error) {
  console.error("Failed to create OTA bundle:", error.message);
  process.exit(1);
}
