"use node";

/**
 * Coder.com Integration for LIFEos - Actions
 *
 * Actions that make external API calls to the Coder REST API.
 * Requires Node.js runtime for fetch.
 *
 * Queries and mutations are in pm_coder.ts.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ==================== TYPES ====================

interface CoderTemplate {
  name: string;
  display_name: string;
}

interface CoderPreset {
  name: string;
}

interface CreateTaskResult {
  success: boolean;
  taskId?: string;
  taskUrl?: string;
  error?: string;
}

// ==================== ACTIONS ====================

/**
 * List available Coder templates
 */
export const listTemplates = action({
  args: {},
  handler: async (ctx): Promise<CoderTemplate[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier }
    );
    if (!user) {
      throw new Error("User not found");
    }

    // Get integration with full token
    const integration = await ctx.runQuery(
      internal.lifeos.pm_coder.getIntegrationInternal,
      { userId: user._id as Id<"users"> }
    );

    if (!integration) {
      throw new Error(
        "Coder not connected. Please connect your Coder account first."
      );
    }

    const response = await fetch(`${integration.coderUrl}/api/v2/templates`, {
      headers: { "Coder-Session-Token": integration.coderApiToken },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Coder token invalid or expired. Please reconnect.");
      }
      throw new Error(`Coder API error: ${response.status}`);
    }

    const templates = (await response.json()) as Array<{
      name: string;
      display_name?: string;
    }>;

    return templates.map((t) => ({
      name: t.name,
      display_name: t.display_name || t.name,
    }));
  },
});

/**
 * List presets for a template
 * Fetches presets from the Coder API via template version
 */
export const listPresets = action({
  args: { template: v.string() },
  handler: async (ctx, args): Promise<CoderPreset[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier }
    );
    if (!user) {
      throw new Error("User not found");
    }

    // Get integration with full token
    const integration = await ctx.runQuery(
      internal.lifeos.pm_coder.getIntegrationInternal,
      { userId: user._id as Id<"users"> }
    );

    if (!integration) {
      throw new Error("Coder not connected");
    }

    // First get the template to find its active version ID
    const templatesResponse = await fetch(
      `${integration.coderUrl}/api/v2/templates`,
      {
        headers: { "Coder-Session-Token": integration.coderApiToken },
      }
    );

    if (!templatesResponse.ok) {
      throw new Error(`Failed to fetch templates: ${templatesResponse.status}`);
    }

    const templates = (await templatesResponse.json()) as Array<{
      name: string;
      active_version_id: string;
    }>;

    const selectedTemplate = templates.find((t) => t.name === args.template);
    if (!selectedTemplate) {
      return [{ name: "default" }];
    }

    // Now fetch presets for this template version
    const presetsResponse = await fetch(
      `${integration.coderUrl}/api/v2/templateversions/${selectedTemplate.active_version_id}/presets`,
      {
        headers: { "Coder-Session-Token": integration.coderApiToken },
      }
    );

    if (!presetsResponse.ok) {
      // Fallback to default if presets endpoint fails
      return [{ name: "default" }];
    }

    const presets = (await presetsResponse.json()) as Array<{
      id: string;
      name: string;
    }>;

    if (presets.length === 0) {
      return [{ name: "default" }];
    }

    return presets.map((p) => ({ name: p.name }));
  },
});

/**
 * Create a Coder task
 *
 * API endpoint: POST /api/v2/tasks/{user}
 * See: https://coder.com/docs/reference/api/tasks
 */
export const createTask = action({
  args: {
    template: v.string(),
    preset: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<CreateTaskResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user from database
    const user = await ctx.runQuery(
      internal.common.users.getUserByTokenIdentifier,
      { tokenIdentifier: identity.tokenIdentifier }
    );
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get integration with full token
    const integration = await ctx.runQuery(
      internal.lifeos.pm_coder.getIntegrationInternal,
      { userId: user._id as Id<"users"> }
    );

    if (!integration) {
      return { success: false, error: "Coder not connected" };
    }

    try {
      // First, we need to get the template version ID from the template name
      const templatesResponse = await fetch(
        `${integration.coderUrl}/api/v2/templates`,
        {
          headers: { "Coder-Session-Token": integration.coderApiToken },
        }
      );

      if (!templatesResponse.ok) {
        return {
          success: false,
          error: `Failed to fetch templates: ${templatesResponse.status}`,
        };
      }

      const templates = (await templatesResponse.json()) as Array<{
        name: string;
        active_version_id: string;
      }>;

      const selectedTemplate = templates.find((t) => t.name === args.template);
      if (!selectedTemplate) {
        return {
          success: false,
          error: `Template '${args.template}' not found`,
        };
      }

      // Get presets for the template version
      const presetsResponse = await fetch(
        `${integration.coderUrl}/api/v2/templateversions/${selectedTemplate.active_version_id}/presets`,
        {
          headers: { "Coder-Session-Token": integration.coderApiToken },
        }
      );

      let presetId: string | undefined;
      if (presetsResponse.ok) {
        const presets = (await presetsResponse.json()) as Array<{
          id: string;
          name: string;
        }>;
        const selectedPreset = presets.find((p) => p.name === args.preset);
        presetId = selectedPreset?.id;
      }

      // Create the task using POST /api/v2/tasks/me
      const response = await fetch(`${integration.coderUrl}/api/v2/tasks/me`, {
        method: "POST",
        headers: {
          "Coder-Session-Token": integration.coderApiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_version_id: selectedTemplate.active_version_id,
          template_version_preset_id: presetId,
          input: args.prompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} - ${errorText}`,
        };
      }

      const task = (await response.json()) as {
        id: string;
        workspace_name?: string;
      };

      // Update last used timestamp
      await ctx.runMutation(internal.lifeos.pm_coder.updateLastUsed, {
        userId: user._id as Id<"users">,
      });

      return {
        success: true,
        taskId: task.id,
        taskUrl: task.workspace_name
          ? `${integration.coderUrl}/@me/${task.workspace_name}`
          : `${integration.coderUrl}/tasks`,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
});
