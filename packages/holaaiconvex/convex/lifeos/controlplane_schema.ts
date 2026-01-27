import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Controlplane Tables
 *
 * Tables for the Claude Agent Farm controlplane.
 * These tables are GLOBAL (no userId) - configs are shared across all users.
 * All table names are prefixed with `lifeos_controlplane` to avoid conflicts.
 */

// ==================== VALIDATORS ====================

/** Agent config fields validator */
export const agentConfigFieldsValidator = {
  name: v.string(),
  repos: v.optional(v.string()), // Comma-separated repo URLs
  taskPrompt: v.optional(v.string()), // Default task prompt
  systemPrompt: v.optional(v.string()),
  maxTurns: v.optional(v.number()), // Default: 50
  maxBudgetUsd: v.optional(v.number()), // Default: 10.0
  cpuLimit: v.optional(v.string()), // e.g., "1000m"
  memoryLimit: v.optional(v.string()), // e.g., "2Gi"
  allowedTools: v.optional(v.string()), // Comma-separated tool names
  enabledMcps: v.optional(v.string()), // Comma-separated MCP server names
  enabledSkills: v.optional(v.string()), // Comma-separated Claude skill names
};

/** MCP TOML config fields validator */
export const mcpConfigFieldsValidator = {
  name: v.string(),
  content: v.string(), // TOML content
  isDefault: v.optional(v.boolean()), // Default: false
  enabled: v.optional(v.boolean()), // Default: false
};

/** Skill fields validator */
export const skillFieldsValidator = {
  name: v.string(),
  installCommand: v.string(),
  description: v.optional(v.string()),
  category: v.optional(v.string()), // Default: "other"
  isBuiltin: v.optional(v.boolean()), // Default: false
  enabled: v.optional(v.boolean()), // Default: true
};

/** Message role validator */
export const messageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
);

// ==================== TABLES ====================

export const controlplaneTables = {
  // ==================== AGENT CONFIGS ====================
  /** Agent configuration templates (repos, prompts, limits) */
  lifeos_controlplaneAgentConfigs: defineTable({
    // Unique name for this config
    name: v.string(),
    // Comma-separated repo URLs to clone
    repos: v.string(),
    // Default task prompt for the agent
    taskPrompt: v.string(),
    // System prompt for Claude
    systemPrompt: v.string(),
    // Maximum turns before stopping
    maxTurns: v.number(),
    // Maximum budget in USD
    maxBudgetUsd: v.number(),
    // Kubernetes CPU limit (e.g., "1000m")
    cpuLimit: v.string(),
    // Kubernetes memory limit (e.g., "2Gi")
    memoryLimit: v.string(),
    // Comma-separated allowed tool names
    allowedTools: v.string(),
    // Comma-separated MCP server names to enable
    enabledMcps: v.string(),
    // Comma-separated Claude skill names to install
    enabledSkills: v.string(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_created", ["createdAt"]),

  // ==================== MCP TOML CONFIGS ====================
  /** MCP server TOML configurations */
  lifeos_controlplaneMcpConfigs: defineTable({
    // Unique name for this config (e.g., "defaults", "custom")
    name: v.string(),
    // TOML content defining MCP servers
    content: v.string(),
    // Whether this is the default config (cannot be deleted)
    isDefault: v.boolean(),
    // Whether this config is currently enabled
    enabled: v.boolean(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_enabled", ["enabled"])
    .index("by_default", ["isDefault"]),

  // ==================== SKILLS ====================
  /** Claude skills that can be installed */
  lifeos_controlplaneSkills: defineTable({
    // Unique skill name
    name: v.string(),
    // Command to install the skill
    installCommand: v.string(),
    // Human-readable description
    description: v.string(),
    // Category for organization (e.g., "coding", "devops", "other")
    category: v.string(),
    // Whether this is a builtin skill (cannot be deleted)
    isBuiltin: v.boolean(),
    // Whether this skill is currently enabled
    enabled: v.boolean(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_enabled", ["enabled"])
    .index("by_builtin", ["isBuiltin"]),

  // ==================== CONVERSATIONS ====================
  /** Chat conversation history with agents */
  lifeos_controlplaneConversations: defineTable({
    // Optional link to agent config (null for default chat pod)
    agentConfigId: v.optional(v.id("lifeos_controlplaneAgentConfigs")),
    // Agent config name at time of conversation (denormalized)
    agentConfigName: v.optional(v.string()),
    // Pod name this conversation is associated with
    podName: v.optional(v.string()),
    // Thread ID from the chat session
    threadId: v.string(),
    // Conversation title (auto-generated or user-set)
    title: v.optional(v.string()),
    // Whether this conversation is archived
    isArchived: v.boolean(),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_agent", ["agentConfigId"])
    .index("by_pod", ["podName"])
    .index("by_archived", ["isArchived"])
    .index("by_updated", ["updatedAt"]),

  // ==================== MESSAGES ====================
  /** Individual messages in conversations */
  lifeos_controlplaneMessages: defineTable({
    // Reference to the conversation
    conversationId: v.id("lifeos_controlplaneConversations"),
    // Message role: user, assistant, or system
    role: messageRoleValidator,
    // Message content
    content: v.string(),
    // Optional metadata (tool calls, etc.)
    metadata: v.optional(
      v.object({
        // Tool calls made by assistant
        toolCalls: v.optional(
          v.array(
            v.object({
              name: v.string(),
              input: v.optional(v.string()),
              output: v.optional(v.string()),
            })
          )
        ),
        // Model used for this message
        model: v.optional(v.string()),
        // Token usage
        tokens: v.optional(
          v.object({
            prompt: v.optional(v.number()),
            completion: v.optional(v.number()),
          })
        ),
        // Error if message failed
        error: v.optional(v.string()),
      })
    ),
    // Timestamp
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"]),
};
