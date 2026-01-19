import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Client Projects Tables
 *
 * Project management for consulting/freelance client work.
 * Supports: Clients → Projects → Phases hierarchy with markdown notes.
 * All table names are prefixed with `lifeos_proj` to avoid conflicts.
 */

// ==================== SHARED VALIDATORS ====================

export const clientStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived")
);

export const projectStatusValidator = v.union(
  v.literal("active"),
  v.literal("on_hold"),
  v.literal("completed"),
  v.literal("archived")
);

export const phaseStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed")
);

export const issueStatusValidator = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("closed")
);

export const issuePriorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

// ==================== TABLE DEFINITIONS ====================

export const projectsTables = {
  // ==================== CLIENTS ====================
  lifeos_projClients: defineTable({
    userId: v.id("users"),
    // Client details
    name: v.string(),
    description: v.optional(v.string()), // Markdown supported
    // Status
    status: clientStatusValidator,
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // ==================== PROJECTS ====================
  lifeos_projProjects: defineTable({
    userId: v.id("users"),
    // Optional client link (for personal projects)
    clientId: v.optional(v.id("lifeos_projClients")),
    // Project details
    name: v.string(),
    description: v.optional(v.string()), // Markdown supported
    // Status
    status: projectStatusValidator,
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_client", ["clientId"]),

  // ==================== PHASES ====================
  lifeos_projPhases: defineTable({
    userId: v.id("users"),
    projectId: v.id("lifeos_projProjects"),
    // Phase details
    name: v.string(),
    description: v.optional(v.string()), // Markdown supported
    // Ordering
    order: v.number(),
    // Status
    status: phaseStatusValidator,
    // Dates
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "order"]),

  // ==================== ISSUES ====================
  lifeos_projIssues: defineTable({
    userId: v.id("users"),
    projectId: v.id("lifeos_projProjects"),
    // Optional phase link
    phaseId: v.optional(v.id("lifeos_projPhases")),
    // Issue details
    title: v.string(),
    description: v.optional(v.string()), // Markdown supported
    // Status and priority
    status: issueStatusValidator,
    priority: issuePriorityValidator,
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_phase", ["phaseId"])
    .index("by_project_status", ["projectId", "status"]),

  // ==================== NOTES (Markdown Documents) ====================
  lifeos_projNotes: defineTable({
    userId: v.id("users"),
    // Can be linked to client, project, or phase (at least one should be set)
    clientId: v.optional(v.id("lifeos_projClients")),
    projectId: v.optional(v.id("lifeos_projProjects")),
    phaseId: v.optional(v.id("lifeos_projPhases")),
    // Note details
    title: v.string(),
    content: v.string(), // Markdown content
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_client", ["clientId"])
    .index("by_project", ["projectId"])
    .index("by_phase", ["phaseId"]),
};
