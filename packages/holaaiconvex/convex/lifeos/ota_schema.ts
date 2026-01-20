import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * OTA (Over-The-Air) Update Tables
 *
 * Stores update bundles for Capacitor apps.
 * Each Convex deployment (dev/staging/prod) has its own updates.
 */

export const otaTables = {
  // Stores metadata about each OTA update bundle
  lifeos_otaUpdates: defineTable({
    // Version string (semver recommended, e.g., "1.0.1")
    version: v.string(),
    // File storage ID for the zip bundle
    bundleStorageId: v.id("_storage"),
    // Bundle URL (generated from storage)
    bundleUrl: v.string(),
    // Whether this update is active/available for download
    isActive: v.boolean(),
    // Optional release notes
    releaseNotes: v.optional(v.string()),
    // File size in bytes
    fileSize: v.optional(v.number()),
    // Who uploaded this update
    uploadedBy: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
  })
    .index("by_version", ["version"])
    .index("by_active", ["isActive", "createdAt"]),
};
