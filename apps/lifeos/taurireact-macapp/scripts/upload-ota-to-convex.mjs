#!/usr/bin/env node
/**
 * Upload OTA bundle to Convex storage
 *
 * Usage: node scripts/upload-ota-to-convex.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Use production Convex URL
const CONVEX_URL = "https://agreeable-ibex-949.convex.cloud";

async function uploadOTA() {
  const client = new ConvexHttpClient(CONVEX_URL);

  const zipPath = path.join(rootDir, "ota-update.zip");
  const zipData = readFileSync(zipPath);

  console.log(`Uploading ${zipPath} (${(zipData.length / 1024 / 1024).toFixed(2)} MB)...`);

  // Get upload URL (this is a public endpoint in Convex)
  const uploadUrl = await fetch(`${CONVEX_URL}/api/storage/generateUploadUrl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then(r => r.json());

  if (!uploadUrl) {
    throw new Error("Failed to get upload URL");
  }

  console.log("Got upload URL, uploading...");

  // Upload the file
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: zipData,
  });

  const { storageId } = await uploadResponse.json();
  console.log(`Uploaded! Storage ID: ${storageId}`);

  // Get public URL
  const publicUrl = `${CONVEX_URL}/api/storage/${storageId}`;
  console.log(`\nPublic URL: ${publicUrl}`);

  return publicUrl;
}

uploadOTA().catch(console.error);
