import { httpRouter } from "convex/server";
import {
  createCorsPreflightHandler,
  CHATNEXUS_CORS_HEADERS,
  GENERIC_CORS_HEADERS,
  VOICE_AGENT_CORS_HEADERS,
  CONTROLPLANE_CORS_HEADERS,
} from "./_lib/http_utils";

// Domain-specific handlers
import {
  chatnexusStreamHandler,
  chatnexusTestApiKeyHandler,
} from "./lifeos/chatnexus_http";
import { llmCouncilDeliberateHandler } from "./lifeos/llmcouncil_http";
import {
  demoAgentCreateThreadHandler,
  demoAgentSendMessageHandler,
} from "./lifeos/demo_agent_http";
import {
  catgirlAgentCreateThreadHandler,
  catgirlAgentSendMessageHandler,
} from "./lifeos/catgirl_agent_http";
import { toolCallHandler } from "./lifeos/tool_call_http";
import { voiceAgentTodaysTasksHandler } from "./lifeos/voice_agent_http";
import {
  configHandlers,
  mcpConfigHandlers,
  skillHandlers,
  conversationHandlers,
  messageHandlers,
} from "./lifeos/controlplane_http";

const http = httpRouter();

// ==================== ChatNexus ====================

http.route({ path: "/chatnexus/stream", method: "POST", handler: chatnexusStreamHandler });
http.route({ path: "/chatnexus/stream", method: "OPTIONS", handler: createCorsPreflightHandler(CHATNEXUS_CORS_HEADERS) });

http.route({ path: "/chatnexus/test-api-key", method: "POST", handler: chatnexusTestApiKeyHandler });
http.route({ path: "/chatnexus/test-api-key", method: "OPTIONS", handler: createCorsPreflightHandler(CHATNEXUS_CORS_HEADERS) });

// ==================== LLM Council ====================

http.route({ path: "/llmcouncil/deliberate", method: "POST", handler: llmCouncilDeliberateHandler });
http.route({ path: "/llmcouncil/deliberate", method: "OPTIONS", handler: createCorsPreflightHandler(GENERIC_CORS_HEADERS) });

// ==================== Demo Agent ====================

http.route({ path: "/demo-agent/create-thread", method: "POST", handler: demoAgentCreateThreadHandler });
http.route({ path: "/demo-agent/create-thread", method: "OPTIONS", handler: createCorsPreflightHandler(GENERIC_CORS_HEADERS) });

http.route({ path: "/demo-agent/send-message", method: "POST", handler: demoAgentSendMessageHandler });
http.route({ path: "/demo-agent/send-message", method: "OPTIONS", handler: createCorsPreflightHandler(GENERIC_CORS_HEADERS) });

// ==================== CatGirl Agent ====================

http.route({ path: "/catgirl-agent/create-thread", method: "POST", handler: catgirlAgentCreateThreadHandler });
http.route({ path: "/catgirl-agent/create-thread", method: "OPTIONS", handler: createCorsPreflightHandler(GENERIC_CORS_HEADERS) });

http.route({ path: "/catgirl-agent/send-message", method: "POST", handler: catgirlAgentSendMessageHandler });
http.route({ path: "/catgirl-agent/send-message", method: "OPTIONS", handler: createCorsPreflightHandler(GENERIC_CORS_HEADERS) });

// ==================== Tool Call ====================

http.route({ path: "/tool-call", method: "POST", handler: toolCallHandler });
http.route({ path: "/tool-call", method: "OPTIONS", handler: createCorsPreflightHandler(GENERIC_CORS_HEADERS) });

// ==================== Voice Agent (Deprecated) ====================

http.route({ path: "/voice-agent/todays-tasks", method: "POST", handler: voiceAgentTodaysTasksHandler });
http.route({ path: "/voice-agent/todays-tasks", method: "OPTIONS", handler: createCorsPreflightHandler(VOICE_AGENT_CORS_HEADERS) });

// ==================== Controlplane: Configs ====================

http.route({ path: "/controlplane/configs", method: "GET", handler: configHandlers.listGet });
http.route({ path: "/controlplane/configs", method: "POST", handler: configHandlers.listPost });
http.route({ path: "/controlplane/configs", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/config", method: "GET", handler: configHandlers.singleGet });
http.route({ path: "/controlplane/config", method: "PUT", handler: configHandlers.singlePut });
http.route({ path: "/controlplane/config", method: "DELETE", handler: configHandlers.singleDelete });
http.route({ path: "/controlplane/config", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

// ==================== Controlplane: MCP Configs ====================

http.route({ path: "/controlplane/mcp-configs", method: "GET", handler: mcpConfigHandlers.listGet });
http.route({ path: "/controlplane/mcp-configs", method: "POST", handler: mcpConfigHandlers.listPost });
http.route({ path: "/controlplane/mcp-configs", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/mcp-config", method: "GET", handler: mcpConfigHandlers.singleGet });
http.route({ path: "/controlplane/mcp-config", method: "PUT", handler: mcpConfigHandlers.singlePut });
http.route({ path: "/controlplane/mcp-config", method: "DELETE", handler: mcpConfigHandlers.singleDelete });
http.route({ path: "/controlplane/mcp-config", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/mcp-config-by-name", method: "GET", handler: mcpConfigHandlers.byNameGet });
http.route({ path: "/controlplane/mcp-config-by-name", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

// ==================== Controlplane: Skills ====================

http.route({ path: "/controlplane/skills", method: "GET", handler: skillHandlers.listGet });
http.route({ path: "/controlplane/skills", method: "POST", handler: skillHandlers.listPost });
http.route({ path: "/controlplane/skills", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/skill", method: "GET", handler: skillHandlers.singleGet });
http.route({ path: "/controlplane/skill", method: "PUT", handler: skillHandlers.singlePut });
http.route({ path: "/controlplane/skill", method: "DELETE", handler: skillHandlers.singleDelete });
http.route({ path: "/controlplane/skill", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/skill-by-name", method: "GET", handler: skillHandlers.byNameGet });
http.route({ path: "/controlplane/skill-by-name", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

// ==================== Controlplane: Conversations ====================

http.route({ path: "/controlplane/conversations", method: "GET", handler: conversationHandlers.listGet });
http.route({ path: "/controlplane/conversations", method: "POST", handler: conversationHandlers.listPost });
http.route({ path: "/controlplane/conversations", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/conversation", method: "GET", handler: conversationHandlers.singleGet });
http.route({ path: "/controlplane/conversation", method: "PUT", handler: conversationHandlers.singlePut });
http.route({ path: "/controlplane/conversation", method: "DELETE", handler: conversationHandlers.singleDelete });
http.route({ path: "/controlplane/conversation", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

http.route({ path: "/controlplane/conversation-by-thread", method: "GET", handler: conversationHandlers.byThreadGet });
http.route({ path: "/controlplane/conversation-by-thread", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

// ==================== Controlplane: Messages ====================

http.route({ path: "/controlplane/messages", method: "GET", handler: messageHandlers.listGet });
http.route({ path: "/controlplane/messages", method: "POST", handler: messageHandlers.listPost });
http.route({ path: "/controlplane/messages", method: "OPTIONS", handler: createCorsPreflightHandler(CONTROLPLANE_CORS_HEADERS) });

export default http;
