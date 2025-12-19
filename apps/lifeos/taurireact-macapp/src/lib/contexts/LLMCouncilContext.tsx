import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";
import {
  ModelTier,
  TierConfiguration,
  DEFAULT_TIER_CONFIG,
  TIER_INFO,
  MODEL_TIERS,
  ALL_PROVIDERS,
  WHITELISTED_MODELS,
} from "../constants/models";

// ==================== TYPES ====================

export interface ModelConfig {
  modelId: string;
  modelName: string;
}

export interface Stage1Response {
  modelId: string;
  modelName: string;
  response: string;
  isComplete: boolean;
  error?: string;
}

export interface Stage2Evaluation {
  evaluatorModelId: string;
  evaluatorModelName: string;
  evaluation: string;
  parsedRanking?: string[];
  isComplete: boolean;
  error?: string;
}

export interface Stage3Response {
  modelId: string;
  modelName: string;
  response: string;
  isComplete: boolean;
  error?: string;
}

export interface AggregateRanking {
  modelId: string;
  modelName: string;
  averageRank: number;
  rankingsCount: number;
}

export interface DeliberationState {
  status: "idle" | "stage1" | "stage2" | "stage3" | "complete" | "error";
  stage1Responses: Stage1Response[];
  stage2Evaluations: Stage2Evaluation[];
  stage3Response?: Stage3Response;
  aggregateRankings?: AggregateRanking[];
  labelToModel?: Record<string, string>;
  error?: string;
}

type Conversation = Doc<"lifeos_llmcouncilConversations">;
type Message = Doc<"lifeos_llmcouncilMessages">;

interface LLMCouncilContextValue {
  // Conversation state
  currentConversationId: Id<"lifeos_llmcouncilConversations"> | null;
  conversations: Conversation[] | undefined;
  messages: Message[] | undefined;
  isLoadingMessages: boolean;

  // Tier-based council configuration
  currentTier: ModelTier;
  councilModels: ModelConfig[];
  chairmanModel: ModelConfig;
  tierConfig: TierConfiguration;
  chairmanModelId: string | null;

  // Deliberation state
  deliberationState: DeliberationState;
  isDeliberating: boolean;

  // Sidebar state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Actions
  createConversation: () => Promise<Id<"lifeos_llmcouncilConversations">>;
  loadConversation: (id: Id<"lifeos_llmcouncilConversations">) => void;
  sendQuery: (query: string) => Promise<void>;
  setTier: (tier: ModelTier) => void;
  archiveConversation: (id: Id<"lifeos_llmcouncilConversations">) => Promise<void>;
  deleteConversation: (id: Id<"lifeos_llmcouncilConversations">) => Promise<void>;
  updateConversationTitle: (
    id: Id<"lifeos_llmcouncilConversations">,
    title: string
  ) => Promise<void>;
  updateTierSettings: (
    newTierConfig: TierConfiguration,
    newChairmanModelId: string
  ) => Promise<void>;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get council models for a specific tier (one model from each provider)
 */
function getCouncilModelsForTier(
  tier: ModelTier,
  tierConfig: TierConfiguration = DEFAULT_TIER_CONFIG
): ModelConfig[] {
  const models: ModelConfig[] = [];

  for (const provider of ALL_PROVIDERS) {
    const providerConfig = tierConfig[provider];
    const modelId = providerConfig?.[tier];

    if (modelId) {
      const model = WHITELISTED_MODELS.find((m) => m.id === modelId);
      if (model) {
        models.push({
          modelId: model.id,
          modelName: model.name,
        });
      }
    }
  }

  return models;
}

/**
 * Get chairman model for a tier (use Google's model as default chairman)
 */
function getChairmanForTier(
  tier: ModelTier,
  tierConfig: TierConfiguration = DEFAULT_TIER_CONFIG
): ModelConfig {
  // Use Google's model at the current tier as chairman
  const modelId = tierConfig.google?.[tier] ?? "google/gemini-2.5-pro";
  const model = WHITELISTED_MODELS.find((m) => m.id === modelId);

  return {
    modelId: model?.id ?? modelId,
    modelName: model?.name ?? "Gemini",
  };
}

// Re-export for use in other components
export { MODEL_TIERS, TIER_INFO };
export type { ModelTier };

// ==================== CONTEXT ====================

const LLMCouncilContext = createContext<LLMCouncilContextValue | null>(null);

export function LLMCouncilProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  // Local state
  const [currentConversationId, setCurrentConversationId] =
    useState<Id<"lifeos_llmcouncilConversations"> | null>(null);
  const [currentTier, setCurrentTier] = useState<ModelTier>("normal");
  const [deliberationState, setDeliberationState] = useState<DeliberationState>({
    status: "idle",
    stage1Responses: [],
    stage2Evaluations: [],
  });

  // Sidebar collapse state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("llmcouncil-sidebar-collapsed");
      return stored === "true";
    }
    return false;
  });

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    if (typeof window !== "undefined") {
      localStorage.setItem("llmcouncil-sidebar-collapsed", String(collapsed));
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  // Convex queries
  const conversations = useQuery(api.lifeos.llmcouncil.getConversations, {
    includeArchived: false,
    limit: 50,
  });

  const messages = useQuery(
    api.lifeos.llmcouncil.getMessages,
    currentConversationId
      ? { conversationId: currentConversationId, limit: 100 }
      : "skip"
  );

  const settings = useQuery(api.lifeos.llmcouncil.getSettings, {});

  // Convex mutations
  const createConversationMutation = useMutation(
    api.lifeos.llmcouncil.createConversation
  );
  const updateConversationMutation = useMutation(
    api.lifeos.llmcouncil.updateConversation
  );
  const archiveConversationMutation = useMutation(
    api.lifeos.llmcouncil.archiveConversation
  );
  const deleteConversationMutation = useMutation(
    api.lifeos.llmcouncil.deleteConversation
  );
  const updateSettingsMutation = useMutation(
    api.lifeos.llmcouncil.updateSettings
  );

  // Compute tier config from settings or use defaults
  const tierConfig = useMemo<TierConfiguration>(() => {
    if (settings?.tierConfig) {
      // Merge with defaults to ensure all providers have values
      const merged: TierConfiguration = { ...DEFAULT_TIER_CONFIG };
      for (const provider of ALL_PROVIDERS) {
        if (settings.tierConfig[provider]) {
          merged[provider] = {
            mini: settings.tierConfig[provider].mini ?? DEFAULT_TIER_CONFIG[provider]?.mini ?? null,
            normal: settings.tierConfig[provider].normal ?? DEFAULT_TIER_CONFIG[provider]?.normal ?? null,
            pro: settings.tierConfig[provider].pro ?? DEFAULT_TIER_CONFIG[provider]?.pro ?? null,
          };
        }
      }
      return merged;
    }
    return DEFAULT_TIER_CONFIG;
  }, [settings?.tierConfig]);

  // Get chairman model ID from settings
  const chairmanModelId = useMemo<string | null>(() => {
    return settings?.chairmanModelId ?? null;
  }, [settings?.chairmanModelId]);

  // Compute council models based on current tier and config
  const councilModels = useMemo<ModelConfig[]>(() => {
    return getCouncilModelsForTier(currentTier, tierConfig);
  }, [currentTier, tierConfig]);

  // Compute chairman model based on chairmanModelId or fall back to tier-based selection
  const chairmanModel = useMemo<ModelConfig>(() => {
    // If a specific chairman model is set, use it
    if (chairmanModelId) {
      const model = WHITELISTED_MODELS.find((m) => m.id === chairmanModelId);
      if (model) {
        return { modelId: model.id, modelName: model.name };
      }
    }
    // Fallback to Google's model at current tier
    return getChairmanForTier(currentTier, tierConfig);
  }, [currentTier, tierConfig, chairmanModelId]);

  // Derived state
  const isDeliberating =
    deliberationState.status !== "idle" &&
    deliberationState.status !== "complete" &&
    deliberationState.status !== "error";

  const isLoadingMessages = currentConversationId !== null && messages === undefined;

  // ==================== ACTIONS ====================

  const setTier = useCallback(
    (tier: ModelTier) => {
      setCurrentTier(tier);
      // Council models and chairman are now computed via useMemo
      // so no need to manually set them

      // Update conversation if one is selected
      if (currentConversationId) {
        const newCouncilModels = getCouncilModelsForTier(tier, tierConfig);
        // Chairman stays the same (specific model, not tier-dependent)
        const currentChairman = chairmanModelId
          ? WHITELISTED_MODELS.find((m) => m.id === chairmanModelId)
          : null;
        const newChairman = currentChairman
          ? { modelId: currentChairman.id, modelName: currentChairman.name }
          : getChairmanForTier(tier, tierConfig);

        updateConversationMutation({
          conversationId: currentConversationId,
          councilModels: newCouncilModels,
          chairmanModel: newChairman,
        });
      }
    },
    [currentConversationId, updateConversationMutation, tierConfig, chairmanModelId]
  );

  const updateTierSettings = useCallback(
    async (newTierConfig: TierConfiguration, newChairmanModelId: string) => {
      await updateSettingsMutation({
        tierConfig: newTierConfig,
        chairmanModelId: newChairmanModelId,
      });
      // Local state will be updated via the settings query subscription
    },
    [updateSettingsMutation]
  );

  const createConversation = useCallback(async () => {
    const conversationId = await createConversationMutation({
      title: "New Council",
      councilModels,
      chairmanModel,
    });
    setCurrentConversationId(conversationId);
    setDeliberationState({
      status: "idle",
      stage1Responses: [],
      stage2Evaluations: [],
    });
    return conversationId;
  }, [createConversationMutation, councilModels, chairmanModel]);

  const loadConversation = useCallback(
    (id: Id<"lifeos_llmcouncilConversations">) => {
      setCurrentConversationId(id);
      setDeliberationState({
        status: "idle",
        stage1Responses: [],
        stage2Evaluations: [],
      });
      // Note: councilModels and chairmanModel are now computed from tierConfig
      // The conversation stores its own model snapshot for historical display
    },
    []
  );

  const sendQuery = useCallback(
    async (query: string) => {
      if (!query.trim() || isDeliberating) return;

      // Create conversation if none exists
      let conversationId = currentConversationId;
      if (!conversationId) {
        conversationId = await createConversation();
      }

      const queryId = crypto.randomUUID();

      // Reset deliberation state
      setDeliberationState({
        status: "stage1",
        stage1Responses: [],
        stage2Evaluations: [],
      });

      try {
        // Get auth token for HTTP request
        const token = await getToken({ template: "convex" });
        if (!token) {
          throw new Error("Not authenticated");
        }

        // Call HTTP streaming endpoint
        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        const siteUrl = convexUrl.replace(".cloud", ".site");

        const response = await fetch(`${siteUrl}/llmcouncil/deliberate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            query,
            queryId,
            councilModels,
            chairmanModel,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Deliberation request failed");
        }

        // Process SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ") && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(currentEvent, data);
              } catch {
                // Ignore parse errors
              }
              currentEvent = "";
            }
          }
        }
      } catch (error) {
        console.error("[LLMCouncil] Deliberation error:", error);
        setDeliberationState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    },
    [
      currentConversationId,
      councilModels,
      chairmanModel,
      isDeliberating,
      getToken,
      createConversation,
    ]
  );

  const handleSSEEvent = useCallback(
    (event: string, data: Record<string, unknown>) => {
      switch (event) {
        case "stage1_start":
          setDeliberationState((prev) => ({
            ...prev,
            status: "stage1",
          }));
          break;

        case "stage1_model_complete":
          setDeliberationState((prev) => ({
            ...prev,
            stage1Responses: [
              ...prev.stage1Responses,
              {
                modelId: data.modelId as string,
                modelName: data.modelName as string,
                response: data.response as string,
                isComplete: true,
              },
            ],
          }));
          break;

        case "stage1_model_error":
          setDeliberationState((prev) => ({
            ...prev,
            stage1Responses: [
              ...prev.stage1Responses,
              {
                modelId: data.modelId as string,
                modelName: data.modelName as string,
                response: "",
                isComplete: true,
                error: data.error as string,
              },
            ],
          }));
          break;

        case "stage1_complete":
          setDeliberationState((prev) => ({
            ...prev,
            status: "stage2",
          }));
          break;

        case "stage2_start":
          setDeliberationState((prev) => ({
            ...prev,
            status: "stage2",
          }));
          break;

        case "stage2_model_complete":
          setDeliberationState((prev) => ({
            ...prev,
            stage2Evaluations: [
              ...prev.stage2Evaluations,
              {
                evaluatorModelId: data.evaluatorModelId as string,
                evaluatorModelName: data.evaluatorModelName as string,
                evaluation: data.evaluation as string,
                parsedRanking: data.parsedRanking as string[] | undefined,
                isComplete: true,
              },
            ],
          }));
          break;

        case "stage2_model_error":
          setDeliberationState((prev) => ({
            ...prev,
            stage2Evaluations: [
              ...prev.stage2Evaluations,
              {
                evaluatorModelId: data.evaluatorModelId as string,
                evaluatorModelName: data.evaluatorModelName as string,
                evaluation: "",
                isComplete: true,
                error: data.error as string,
              },
            ],
          }));
          break;

        case "stage2_complete":
          setDeliberationState((prev) => ({
            ...prev,
            status: "stage3",
            aggregateRankings: data.aggregateRankings as AggregateRanking[] | undefined,
            labelToModel: data.labelToModel as Record<string, string> | undefined,
          }));
          break;

        case "stage3_start":
          setDeliberationState((prev) => ({
            ...prev,
            status: "stage3",
          }));
          break;

        case "stage3_complete":
          setDeliberationState((prev) => ({
            ...prev,
            stage3Response: {
              modelId: data.modelId as string,
              modelName: data.modelName as string,
              response: data.response as string,
              isComplete: true,
            },
          }));
          break;

        case "stage3_error":
          setDeliberationState((prev) => ({
            ...prev,
            stage3Response: {
              modelId: data.modelId as string,
              modelName: data.modelName as string,
              response: "",
              isComplete: true,
              error: data.error as string,
            },
          }));
          break;

        case "complete":
          setDeliberationState((prev) => ({
            ...prev,
            status: "complete",
          }));
          break;

        case "error":
          setDeliberationState((prev) => ({
            ...prev,
            status: "error",
            error: data.error as string,
          }));
          break;
      }
    },
    []
  );

  const archiveConversation = useCallback(
    async (id: Id<"lifeos_llmcouncilConversations">) => {
      await archiveConversationMutation({ conversationId: id });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [archiveConversationMutation, currentConversationId]
  );

  const deleteConversation = useCallback(
    async (id: Id<"lifeos_llmcouncilConversations">) => {
      await deleteConversationMutation({ conversationId: id });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [deleteConversationMutation, currentConversationId]
  );

  const updateConversationTitle = useCallback(
    async (id: Id<"lifeos_llmcouncilConversations">, title: string) => {
      await updateConversationMutation({ conversationId: id, title });
    },
    [updateConversationMutation]
  );

  // ==================== CONTEXT VALUE ====================

  const value: LLMCouncilContextValue = {
    // Conversation state
    currentConversationId,
    conversations,
    messages,
    isLoadingMessages,

    // Tier-based council configuration
    currentTier,
    councilModels,
    chairmanModel,
    tierConfig,
    chairmanModelId,

    // Deliberation state
    deliberationState,
    isDeliberating,

    // Sidebar state
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,

    // Actions
    createConversation,
    loadConversation,
    sendQuery,
    setTier,
    archiveConversation,
    deleteConversation,
    updateConversationTitle,
    updateTierSettings,
  };

  return (
    <LLMCouncilContext.Provider value={value}>
      {children}
    </LLMCouncilContext.Provider>
  );
}

export function useLLMCouncil() {
  const context = useContext(LLMCouncilContext);
  if (!context) {
    throw new Error("useLLMCouncil must be used within a LLMCouncilProvider");
  }
  return context;
}
