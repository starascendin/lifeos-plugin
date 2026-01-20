#!/usr/bin/env node
/**
 * Upload OTA bundle to Convex storage
 *
 * Usage:
 *   node scripts/upload-ota-to-convex.mjs <env> <version> [--activate]
 *
 * Examples:
 *   node scripts/upload-ota-to-convex.mjs staging 1.0.1 --activate
 *   node scripts/upload-ota-to-convex.mjs prod 1.0.1
 *   node scripts/upload-ota-to-convex.mjs dev 1.0.1-test
 *
 * Environment URLs:
 *   dev:     https://beaming-giraffe-300.convex.cloud
 *   staging: https://adorable-firefly-704.convex.cloud
 *   prod:    https://agreeable-ibex-949.convex.cloud
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@holaai/convex";
import { readFileSync, statSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Convex URLs for each environment
const CONVEX_URLS = {
  dev: "https://beaming-giraffe-300.convex.cloud",
  staging: "https://adorable-firefly-704.convex.cloud",
  prod: "https://agreeable-ibex-949.convex.cloud",
};

async function uploadOTA() {
  // Parse arguments
  const args = process.argv.slice(2);
  const env = args[0];
  const version = args[1];
  const activate = args.includes("--activate");

  if (!env || !version) {
    console.error("Usage: node scripts/upload-ota-to-convex.mjs <env> <version> [--activate]");
    console.error("  env: dev | staging | prod");
    console.error("  version: semver string (e.g., 1.0.1)");
    console.error("  --activate: set this version as active immediately");
    process.exit(1);
  }

  if (!CONVEX_URLS[env]) {
    console.error(`Invalid environment: ${env}`);
    console.error("Valid environments: dev, staging, prod");
    process.exit(1);
  }

  const convexUrl = CONVEX_URLS[env];
  const client = new ConvexHttpClient(convexUrl);

  // Find the zip file
  const bundlesDir = path.join(rootDir, "ota-bundles");
  const zipPath = path.join(bundlesDir, `ota-update-${version}.zip`);

  if (!existsSync(zipPath)) {
    console.error(`Bundle not found: ${zipPath}`);
    console.error(`\nCreate it first with: pnpm ota:bundle:${env} ${version}`);
    process.exit(1);
  }

  const zipData = readFileSync(zipPath);
  const fileSize = statSync(zipPath).size;

  console.log(`\n📦 Uploading OTA Update`);
  console.log(`   Environment: ${env}`);
  console.log(`   Version: ${version}`);
  console.log(`   File: ${zipPath}`);
  console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Activate: ${activate}`);
  console.log(`   Convex: ${convexUrl}`);
  console.log("");

  try {
    // Step 1: Get upload URL from Convex
    console.log("1. Getting upload URL...");
    const uploadUrl = await client.mutation(api.lifeos.ota.generateUploadUrl);

    // Step 2: Upload the file
    console.log("2. Uploading bundle...");
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: zipData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const { storageId } = await uploadResponse.json();
    console.log(`   Storage ID: ${storageId}`);

    // Step 3: Create the update record
    console.log("3. Creating update record...");
    const result = await client.mutation(api.lifeos.ota.createUpdate, {
      version,
      bundleStorageId: storageId,
      fileSize,
      uploadedBy: process.env.USER || "unknown",
      setActive: activate,
    });

    console.log(`\n✅ OTA Update uploaded successfully!`);
    console.log(`   Version: ${version}`);
    console.log(`   Bundle URL: ${result.bundleUrl}`);
    console.log(`   Active: ${activate}`);

    if (!activate) {
      console.log(`\nTo activate this update, run:`);
      console.log(`   node scripts/ota-activate.mjs ${env} ${version}`);
    }

    return result;
  } catch (error) {
    console.error("\n❌ Upload failed:", error.message);
    process.exit(1);
  }
}

uploadOTA();
