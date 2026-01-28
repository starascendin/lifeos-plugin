import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import {
  CONTROLPLANE_CORS_HEADERS,
  authenticateControlplane,
} from "../_lib/http_utils";

// ==================== CONTROLPLANE HTTP API ====================
// These endpoints are used by the Go controlplane backend and frontend
// Auth: X-API-Key header (for Go backend) or Bearer token (for frontend)

// --- Agent Configs ---

export const configHandlers = {
  /**
   * GET /controlplane/configs - List all agent configs
   */
  listGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const configs = await ctx.runQuery(api.lifeos.controlplane.listAgentConfigs, {});
      return new Response(JSON.stringify(configs), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * POST /controlplane/configs - Create a new agent config
   */
  listPost: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = (await request.json()) as {
        name: string;
        repos?: string;
        taskPrompt?: string;
        systemPrompt?: string;
        maxTurns?: number;
        maxBudgetUsd?: number;
        cpuLimit?: string;
        memoryLimit?: string;
        allowedTools?: string;
        enabledMcps?: string;
        enabledSkills?: string;
      };

      if (!body.name) {
        return new Response(JSON.stringify({ error: "Name is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createAgentConfig, {
        name: body.name,
        repos: body.repos,
        taskPrompt: body.taskPrompt,
        systemPrompt: body.systemPrompt,
        maxTurns: body.maxTurns,
        maxBudgetUsd: body.maxBudgetUsd,
        cpuLimit: body.cpuLimit,
        memoryLimit: body.memoryLimit,
        allowedTools: body.allowedTools,
        enabledMcps: body.enabledMcps,
        enabledSkills: body.enabledSkills,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/config?id=xxx - Get a single agent config
   */
  singleGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneAgentConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const config = await ctx.runQuery(api.lifeos.controlplane.getAgentConfig, { id });
      if (!config) {
        return new Response(JSON.stringify({ error: "Config not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * PUT /controlplane/config?id=xxx - Update an agent config
   */
  singlePut: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneAgentConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = (await request.json()) as {
        name: string;
        repos?: string;
        taskPrompt?: string;
        systemPrompt?: string;
        maxTurns?: number;
        maxBudgetUsd?: number;
        cpuLimit?: string;
        memoryLimit?: string;
        allowedTools?: string;
        enabledMcps?: string;
        enabledSkills?: string;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateAgentConfig, {
        id,
        name: body.name,
        repos: body.repos,
        taskPrompt: body.taskPrompt,
        systemPrompt: body.systemPrompt,
        maxTurns: body.maxTurns,
        maxBudgetUsd: body.maxBudgetUsd,
        cpuLimit: body.cpuLimit,
        memoryLimit: body.memoryLimit,
        allowedTools: body.allowedTools,
        enabledMcps: body.enabledMcps,
        enabledSkills: body.enabledSkills,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * DELETE /controlplane/config?id=xxx - Delete an agent config
   */
  singleDelete: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneAgentConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteAgentConfig, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
};

// --- MCP Configs ---

export const mcpConfigHandlers = {
  /**
   * GET /controlplane/mcp-configs - List all MCP configs
   */
  listGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const enabledOnly = new URL(request.url).searchParams.get("enabled") === "true";
      const configs = enabledOnly
        ? await ctx.runQuery(api.lifeos.controlplane.getEnabledMcpConfigs, {})
        : await ctx.runQuery(api.lifeos.controlplane.listMcpConfigs, {});

      return new Response(JSON.stringify(configs), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * POST /controlplane/mcp-configs - Create a new MCP config
   */
  listPost: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = (await request.json()) as {
        name: string;
        content: string;
        isDefault?: boolean;
        enabled?: boolean;
      };

      if (!body.name || !body.content) {
        return new Response(JSON.stringify({ error: "Name and content are required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createMcpConfig, {
        name: body.name,
        content: body.content,
        isDefault: body.isDefault,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/mcp-config?id=xxx - Get a single MCP config
   */
  singleGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneMcpConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const config = await ctx.runQuery(api.lifeos.controlplane.getMcpConfig, { id });
      if (!config) {
        return new Response(JSON.stringify({ error: "MCP config not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * PUT /controlplane/mcp-config?id=xxx - Update an MCP config
   */
  singlePut: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneMcpConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = (await request.json()) as {
        content?: string;
        enabled?: boolean;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateMcpConfig, {
        id,
        content: body.content,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * DELETE /controlplane/mcp-config?id=xxx - Delete an MCP config
   */
  singleDelete: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneMcpConfigs">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id query parameter is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteMcpConfig, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/mcp-config-by-name?name=xxx - Get an MCP config by name
   */
  byNameGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const config = await ctx.runQuery(api.lifeos.controlplane.getMcpConfigByName, { name });
      if (!config) {
        return new Response(JSON.stringify({ error: "MCP config not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
};

// --- Skills ---

export const skillHandlers = {
  /**
   * GET /controlplane/skills - List all skills
   */
  listGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const enabledOnly = new URL(request.url).searchParams.get("enabled") === "true";
      const skills = enabledOnly
        ? await ctx.runQuery(api.lifeos.controlplane.getEnabledSkills, {})
        : await ctx.runQuery(api.lifeos.controlplane.listSkills, {});

      return new Response(JSON.stringify(skills), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * POST /controlplane/skills - Create a new skill
   */
  listPost: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = (await request.json()) as {
        name: string;
        installCommand: string;
        description?: string;
        category?: string;
        isBuiltin?: boolean;
        enabled?: boolean;
      };

      if (!body.name || !body.installCommand) {
        return new Response(
          JSON.stringify({ error: "Name and installCommand are required" }),
          {
            status: 400,
            headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createSkill, {
        name: body.name,
        installCommand: body.installCommand,
        description: body.description,
        category: body.category,
        isBuiltin: body.isBuiltin,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/skill?id=xxx - Get a single skill
   */
  singleGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneSkills">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const skill = await ctx.runQuery(api.lifeos.controlplane.getSkill, { id });
      if (!skill) {
        return new Response(JSON.stringify({ error: "Skill not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(skill), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * PUT /controlplane/skill?id=xxx - Update a skill
   */
  singlePut: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneSkills">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = (await request.json()) as {
        installCommand?: string;
        description?: string;
        category?: string;
        enabled?: boolean;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateSkill, {
        id,
        installCommand: body.installCommand,
        description: body.description,
        category: body.category,
        enabled: body.enabled,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * DELETE /controlplane/skill?id=xxx - Delete a skill
   */
  singleDelete: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneSkills">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteSkill, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/skill-by-name?name=xxx - Get a skill by name
   */
  byNameGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const skill = await ctx.runQuery(api.lifeos.controlplane.getSkillByName, { name });
      if (!skill) {
        return new Response(JSON.stringify({ error: "Skill not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(skill), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
};

// --- Conversations ---

export const conversationHandlers = {
  /**
   * GET /controlplane/conversations - List conversations
   */
  listGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const includeArchived = url.searchParams.get("includeArchived") === "true";

      const conversations = await ctx.runQuery(api.lifeos.controlplane.listConversations, {
        limit,
        includeArchived,
      });

      return new Response(JSON.stringify(conversations), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * POST /controlplane/conversations - Create a new conversation
   */
  listPost: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = (await request.json()) as {
        agentConfigId?: Id<"lifeos_controlplaneAgentConfigs">;
        podName?: string;
        threadId: string;
        title?: string;
      };

      if (!body.threadId) {
        return new Response(JSON.stringify({ error: "threadId is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.createConversation, {
        agentConfigId: body.agentConfigId,
        podName: body.podName,
        threadId: body.threadId,
        title: body.title,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/conversation?id=xxx - Get a conversation
   */
  singleGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneConversations">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const conversation = await ctx.runQuery(api.lifeos.controlplane.getConversation, { id });
      if (!conversation) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(conversation), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * PUT /controlplane/conversation?id=xxx - Update a conversation
   */
  singlePut: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneConversations">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = (await request.json()) as {
        title?: string;
        isArchived?: boolean;
      };

      await ctx.runMutation(api.lifeos.controlplane.updateConversation, {
        id,
        title: body.title,
        isArchived: body.isArchived,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * DELETE /controlplane/conversation?id=xxx - Delete a conversation
   */
  singleDelete: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const id = url.searchParams.get("id") as Id<"lifeos_controlplaneConversations">;

      if (!id) {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.lifeos.controlplane.deleteConversation, { id });

      return new Response(null, { status: 204, headers: CONTROLPLANE_CORS_HEADERS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * GET /controlplane/conversation-by-thread?threadId=xxx - Get conversation by thread ID
   */
  byThreadGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const threadId = url.searchParams.get("threadId");

      if (!threadId) {
        return new Response(JSON.stringify({ error: "threadId is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const conversation = await ctx.runQuery(
        api.lifeos.controlplane.getConversationByThreadId,
        { threadId }
      );
      if (!conversation) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(conversation), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
};

// --- Messages ---

export const messageHandlers = {
  /**
   * GET /controlplane/messages?conversationId=xxx - Get messages for a conversation
   */
  listGet: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const url = new URL(request.url);
      const conversationId = url.searchParams.get(
        "conversationId"
      ) as Id<"lifeos_controlplaneConversations">;
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);

      if (!conversationId) {
        return new Response(JSON.stringify({ error: "conversationId is required" }), {
          status: 400,
          headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const messages = await ctx.runQuery(api.lifeos.controlplane.getMessages, {
        conversationId,
        limit,
      });

      return new Response(JSON.stringify(messages), {
        status: 200,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),

  /**
   * POST /controlplane/messages - Add a message to a conversation
   */
  listPost: httpAction(async (ctx, request): Promise<Response> => {
    const auth = await authenticateControlplane(ctx, request);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    try {
      const body = (await request.json()) as {
        conversationId: Id<"lifeos_controlplaneConversations">;
        role: "user" | "assistant" | "system";
        content: string;
        metadata?: {
          toolCalls?: Array<{
            name: string;
            input?: string;
            output?: string;
          }>;
          model?: string;
          tokens?: {
            prompt?: number;
            completion?: number;
          };
          error?: string;
        };
      };

      if (!body.conversationId || !body.role || !body.content) {
        return new Response(
          JSON.stringify({ error: "conversationId, role, and content are required" }),
          {
            status: 400,
            headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }

      const id = await ctx.runMutation(api.lifeos.controlplane.addMessage, {
        conversationId: body.conversationId,
        role: body.role,
        content: body.content,
        metadata: body.metadata,
      });

      return new Response(JSON.stringify({ id }), {
        status: 201,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...CONTROLPLANE_CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }),
};
