import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import {
  agentConfigFieldsValidator,
  mcpConfigFieldsValidator,
  skillFieldsValidator,
  messageRoleValidator,
} from "./controlplane_schema";

// ==================== AGENT CONFIGS ====================

/**
 * List all agent configs
 */
export const listAgentConfigs = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db
      .query("lifeos_controlplaneAgentConfigs")
      .withIndex("by_name")
      .collect();
    return configs;
  },
});

/**
 * Get a single agent config by ID
 */
export const getAgentConfig = query({
  args: { id: v.id("lifeos_controlplaneAgentConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get agent config by name
 */
export const getAgentConfigByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_controlplaneAgentConfigs")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Create a new agent config
 */
export const createAgentConfig = mutation({
  args: agentConfigFieldsValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("lifeos_controlplaneAgentConfigs", {
      name: args.name,
      repos: args.repos ?? "",
      taskPrompt: args.taskPrompt ?? "",
      systemPrompt: args.systemPrompt ?? "",
      maxTurns: args.maxTurns ?? 50,
      maxBudgetUsd: args.maxBudgetUsd ?? 10.0,
      cpuLimit: args.cpuLimit ?? "1000m",
      memoryLimit: args.memoryLimit ?? "2Gi",
      allowedTools: args.allowedTools ?? "Read,Write,Edit,Bash,Glob,Grep",
      enabledMcps: args.enabledMcps ?? "",
      enabledSkills: args.enabledSkills ?? "",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Update an agent config
 */
export const updateAgentConfig = mutation({
  args: {
    id: v.id("lifeos_controlplaneAgentConfigs"),
    ...agentConfigFieldsValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Agent config not found");
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      repos: args.repos ?? existing.repos,
      taskPrompt: args.taskPrompt ?? existing.taskPrompt,
      systemPrompt: args.systemPrompt ?? existing.systemPrompt,
      maxTurns: args.maxTurns ?? existing.maxTurns,
      maxBudgetUsd: args.maxBudgetUsd ?? existing.maxBudgetUsd,
      cpuLimit: args.cpuLimit ?? existing.cpuLimit,
      memoryLimit: args.memoryLimit ?? existing.memoryLimit,
      allowedTools: args.allowedTools ?? existing.allowedTools,
      enabledMcps: args.enabledMcps ?? existing.enabledMcps,
      enabledSkills: args.enabledSkills ?? existing.enabledSkills,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete an agent config
 */
export const deleteAgentConfig = mutation({
  args: { id: v.id("lifeos_controlplaneAgentConfigs") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ==================== MCP CONFIGS ====================

/**
 * List all MCP TOML configs
 */
export const listMcpConfigs = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db
      .query("lifeos_controlplaneMcpConfigs")
      .withIndex("by_name")
      .collect();
    return configs;
  },
});

/**
 * Get enabled MCP configs
 */
export const getEnabledMcpConfigs = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db
      .query("lifeos_controlplaneMcpConfigs")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    return configs;
  },
});

/**
 * Get MCP config by ID
 */
export const getMcpConfig = query({
  args: { id: v.id("lifeos_controlplaneMcpConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get MCP config by name
 */
export const getMcpConfigByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_controlplaneMcpConfigs")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Create a new MCP config
 */
export const createMcpConfig = mutation({
  args: mcpConfigFieldsValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("lifeos_controlplaneMcpConfigs", {
      name: args.name,
      content: args.content,
      isDefault: args.isDefault ?? false,
      enabled: args.enabled ?? false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Update an MCP config
 */
export const updateMcpConfig = mutation({
  args: {
    id: v.id("lifeos_controlplaneMcpConfigs"),
    content: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("MCP config not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.content !== undefined) updates.content = args.content;
    if (args.enabled !== undefined) updates.enabled = args.enabled;

    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Toggle MCP config enabled status
 */
export const toggleMcpConfig = mutation({
  args: {
    id: v.id("lifeos_controlplaneMcpConfigs"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete an MCP config (cannot delete default configs)
 */
export const deleteMcpConfig = mutation({
  args: { id: v.id("lifeos_controlplaneMcpConfigs") },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.id);
    if (!config) {
      throw new Error("MCP config not found");
    }
    if (config.isDefault) {
      throw new Error("Cannot delete default MCP config");
    }
    await ctx.db.delete(args.id);
  },
});

// ==================== SKILLS ====================

/**
 * List all skills
 */
export const listSkills = query({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db
      .query("lifeos_controlplaneSkills")
      .withIndex("by_category")
      .collect();
    return skills;
  },
});

/**
 * Get enabled skills
 */
export const getEnabledSkills = query({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db
      .query("lifeos_controlplaneSkills")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    return skills;
  },
});

/**
 * Get skill by ID
 */
export const getSkill = query({
  args: { id: v.id("lifeos_controlplaneSkills") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get skill by name
 */
export const getSkillByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_controlplaneSkills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Create a new skill
 */
export const createSkill = mutation({
  args: skillFieldsValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("lifeos_controlplaneSkills", {
      name: args.name,
      installCommand: args.installCommand,
      description: args.description ?? "",
      category: args.category ?? "other",
      isBuiltin: args.isBuiltin ?? false,
      enabled: args.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Update a skill
 */
export const updateSkill = mutation({
  args: {
    id: v.id("lifeos_controlplaneSkills"),
    installCommand: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Skill not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.installCommand !== undefined) updates.installCommand = args.installCommand;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.enabled !== undefined) updates.enabled = args.enabled;

    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Toggle skill enabled status
 */
export const toggleSkill = mutation({
  args: {
    id: v.id("lifeos_controlplaneSkills"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a skill (cannot delete builtin skills)
 */
export const deleteSkill = mutation({
  args: { id: v.id("lifeos_controlplaneSkills") },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.id);
    if (!skill) {
      throw new Error("Skill not found");
    }
    if (skill.isBuiltin) {
      throw new Error("Cannot delete builtin skill");
    }
    await ctx.db.delete(args.id);
  },
});

// ==================== CONVERSATIONS ====================

/**
 * List conversations (most recent first)
 */
export const listConversations = query({
  args: {
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.includeArchived) {
      // Include all conversations
      const conversations = await ctx.db
        .query("lifeos_controlplaneConversations")
        .order("desc")
        .take(limit);
      return conversations;
    }

    // Filter to only non-archived conversations
    const conversations = await ctx.db
      .query("lifeos_controlplaneConversations")
      .withIndex("by_archived", (q) => q.eq("isArchived", false))
      .order("desc")
      .take(limit);
    return conversations;
  },
});

/**
 * Get conversation by ID
 */
export const getConversation = query({
  args: { id: v.id("lifeos_controlplaneConversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get conversation by thread ID
 */
export const getConversationByThreadId = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lifeos_controlplaneConversations")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
  },
});

/**
 * Create a new conversation
 */
export const createConversation = mutation({
  args: {
    agentConfigId: v.optional(v.id("lifeos_controlplaneAgentConfigs")),
    podName: v.optional(v.string()),
    threadId: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get agent config name if provided
    let agentConfigName: string | undefined;
    if (args.agentConfigId) {
      const config = await ctx.db.get(args.agentConfigId);
      agentConfigName = config?.name;
    }

    const id = await ctx.db.insert("lifeos_controlplaneConversations", {
      agentConfigId: args.agentConfigId,
      agentConfigName,
      podName: args.podName,
      threadId: args.threadId,
      title: args.title,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Update conversation
 */
export const updateConversation = mutation({
  args: {
    id: v.id("lifeos_controlplaneConversations"),
    title: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.isArchived !== undefined) updates.isArchived = args.isArchived;

    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Delete a conversation and all its messages
 */
export const deleteConversation = mutation({
  args: { id: v.id("lifeos_controlplaneConversations") },
  handler: async (ctx, args) => {
    // Delete all messages first
    const messages = await ctx.db
      .query("lifeos_controlplaneMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete conversation
    await ctx.db.delete(args.id);
  },
});

// ==================== MESSAGES ====================

/**
 * Get messages for a conversation
 */
export const getMessages = query({
  args: {
    conversationId: v.id("lifeos_controlplaneConversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const messages = await ctx.db
      .query("lifeos_controlplaneMessages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(limit);
    return messages;
  },
});

/**
 * Add a message to a conversation
 */
export const addMessage = mutation({
  args: {
    conversationId: v.id("lifeos_controlplaneConversations"),
    role: messageRoleValidator,
    content: v.string(),
    metadata: v.optional(
      v.object({
        toolCalls: v.optional(
          v.array(
            v.object({
              name: v.string(),
              input: v.optional(v.string()),
              output: v.optional(v.string()),
            })
          )
        ),
        model: v.optional(v.string()),
        tokens: v.optional(
          v.object({
            prompt: v.optional(v.number()),
            completion: v.optional(v.number()),
          })
        ),
        error: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Add message
    const id = await ctx.db.insert("lifeos_controlplaneMessages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: now,
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    return id;
  },
});

// ==================== INTERNAL QUERIES/MUTATIONS ====================

/**
 * Internal: Get agent config by ID
 */
export const getAgentConfigInternal = internalQuery({
  args: { id: v.id("lifeos_controlplaneAgentConfigs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal: List all agent configs
 */
export const listAgentConfigsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lifeos_controlplaneAgentConfigs")
      .withIndex("by_name")
      .collect();
  },
});

/**
 * Internal: Get enabled MCP configs
 */
export const getEnabledMcpConfigsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lifeos_controlplaneMcpConfigs")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

/**
 * Internal: Get enabled skills
 */
export const getEnabledSkillsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lifeos_controlplaneSkills")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

/**
 * Internal: Create or get conversation by thread ID
 */
export const getOrCreateConversationInternal = internalMutation({
  args: {
    threadId: v.string(),
    agentConfigId: v.optional(v.id("lifeos_controlplaneAgentConfigs")),
    podName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if conversation exists
    const existing = await ctx.db
      .query("lifeos_controlplaneConversations")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new conversation
    const now = Date.now();
    let agentConfigName: string | undefined;
    if (args.agentConfigId) {
      const config = await ctx.db.get(args.agentConfigId);
      agentConfigName = config?.name;
    }

    const id = await ctx.db.insert("lifeos_controlplaneConversations", {
      agentConfigId: args.agentConfigId,
      agentConfigName,
      podName: args.podName,
      threadId: args.threadId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Internal: Add message to conversation
 */
export const addMessageInternal = internalMutation({
  args: {
    conversationId: v.id("lifeos_controlplaneConversations"),
    role: messageRoleValidator,
    content: v.string(),
    metadata: v.optional(
      v.object({
        toolCalls: v.optional(
          v.array(
            v.object({
              name: v.string(),
              input: v.optional(v.string()),
              output: v.optional(v.string()),
            })
          )
        ),
        model: v.optional(v.string()),
        tokens: v.optional(
          v.object({
            prompt: v.optional(v.number()),
            completion: v.optional(v.number()),
          })
        ),
        error: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const id = await ctx.db.insert("lifeos_controlplaneMessages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, { updatedAt: now });

    return id;
  },
});
