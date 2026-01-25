#!/usr/bin/env node
/**
 * OTA Release Script
 *
 * Bumps version, builds, and deploys OTA bundle in one command.
 *
 * Usage:
 *   node scripts/ota-release.mjs <env> [bump-type]
 *
 * Arguments:
 *   env:       dev | staging | prod
 *   bump-type: patch (default) | minor | major
 *
 * Examples:
 *   node scripts/ota-release.mjs staging         # 1.0.3 -> 1.0.4
 *   node scripts/ota-release.mjs staging patch   # 1.0.3 -> 1.0.4
 *   node scripts/ota-release.mjs staging minor   # 1.0.3 -> 1.1.0
 *   node scripts/ota-release.mjs staging major   # 1.0.3 -> 2.0.0
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const CONVEX_URLS = {
  dev: "https://keen-nightingale-310.convex.cloud",
  prod: "https://agreeable-ibex-949.convex.cloud",
};

const BUILD_COMMANDS = {
  dev: "pnpm build",
  prod: "pnpm build:production",
};

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

async function callMutation(convexUrl, functionPath, args = {}) {
  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: functionPath, args }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Convex mutation failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (data.status === "error") {
    throw new Error(`Convex error: ${data.errorMessage}`);
  }
  return data.value;
}

async function main() {
  const args = process.argv.slice(2);
  const env = args[0];
  const bumpType = args[1] || "patch";

  if (!env || !CONVEX_URLS[env]) {
    console.error("Usage: node scripts/ota-release.mjs <env> [bump-type]");
    console.error("  env: dev | staging | prod");
    console.error("  bump-type: patch (default) | minor | major");
    process.exit(1);
  }

  const convexUrl = CONVEX_URLS[env];
  const pkgPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);

  console.log(`\n🚀 OTA Release Pipeline`);
  console.log(`   Environment: ${env}`);
  console.log(`   Version: ${oldVersion} -> ${newVersion}`);
  console.log(`   Convex: ${convexUrl}\n`);

  // Step 1: Bump version
  console.log(`1. Bumping version to ${newVersion}...`);
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  // Step 2: Build
  console.log(`2. Building for ${env}...`);
  try {
    execSync(BUILD_COMMANDS[env], { cwd: rootDir, stdio: "inherit" });
  } catch (error) {
    console.error("❌ Build failed");
    // Revert version on failure
    pkg.version = oldVersion;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    process.exit(1);
  }

  // Step 3: Create bundle
  console.log(`3. Creating OTA bundle...`);
  const outputDir = path.join(rootDir, "ota-bundles");
  const outputFile = `ota-update-${newVersion}.zip`;
  const outputPath = path.join(outputDir, outputFile);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  execSync(`cd ${path.join(rootDir, "dist")} && zip -r "${outputPath}" .`, {
    stdio: "inherit",
  });

  const { statSync } = await import("fs");
  const fileSize = statSync(outputPath).size;
  console.log(`   Bundle: ${outputFile} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

  // Step 4: Upload to Convex
  console.log(`4. Uploading to Convex ${env}...`);
  try {
    const uploadUrl = await callMutation(convexUrl, "lifeos/ota:generateUploadUrl");

    const zipData = readFileSync(outputPath);
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: zipData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const { storageId } = await uploadResponse.json();

    const result = await callMutation(convexUrl, "lifeos/ota:createUpdate", {
      version: newVersion,
      bundleStorageId: storageId,
      fileSize,
      uploadedBy: process.env.USER || "ota-release",
      setActive: true,
    });

    console.log(`\n✅ OTA Release Complete!`);
    console.log(`   Version: ${newVersion}`);
    console.log(`   Bundle URL: ${result.bundleUrl}`);
    console.log(`   Status: Active\n`);
  } catch (error) {
    console.error(`\n❌ Upload failed: ${error.message}`);
    process.exit(1);
  }
}

main();
