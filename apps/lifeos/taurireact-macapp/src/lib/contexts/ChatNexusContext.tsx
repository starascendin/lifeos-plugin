import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "@holaai/convex";
import type { Doc, Id } from "@holaai/convex";
import {
  LayoutType,
  ModelOption,
  ModelTier,
  TierConfiguration,
  Provider,
  LAYOUT_CONFIGS,
  WHITELISTED_MODELS,
  DEFAULT_TIER_CONFIG,
  DEFAULT_PANEL_PROVIDERS,
} from "../constants/models";
import { useChatNexusSettings } from "../hooks/useChatNexusSettings";

// ==================== TYPES ====================

export interface PanelConfig {
  panelId: string;
  modelId: string;
  modelProvider: string;
  modelDisplayName: string;
  position: number;
  isActive: boolean;
}

export interface StreamState {
  [panelId: string]: {
    status: "pending" | "streaming" | "completed" | "error";
    partialContent: string;
    error?: string;
  };
}

type Conversation = Doc<"lifeos_chatnexusConversations">;
type Message = Doc<"lifeos_chatnexusMessages">;
type ModelPreset = Doc<"lifeos_chatnexusModelPresets">;

interface ChatNexusContextValue {
  // Conversation state
  currentConversationId: Id<"lifeos_chatnexusConversations"> | null;
  conversations: Conversation[] | undefined;
  messages: Message[] | undefined;
  isLoadingMessages: boolean;

  // Layout and panels
  layoutType: LayoutType;
  panelConfigs: PanelConfig[];

  // Tier state
  currentTier: ModelTier;

  // Streaming state
  streamState: StreamState;
  isAnyPanelStreaming: boolean;

  // Actions
  createConversation: () => Promise<Id<"lifeos_chatnexusConversations">>;
  loadConversation: (id: Id<"lifeos_chatnexusConversations">) => void;
  setLayoutType: (type: LayoutType) => void;
  updatePanelModel: (panelId: string, model: ModelOption) => void;
  applyTierToAllPanels: (tier: ModelTier) => void;
  sendMessage: (content: string) => Promise<void>;
  archiveConversation: (id: Id<"lifeos_chatnexusConversations">) => Promise<void>;
  deleteConversation: (id: Id<"lifeos_chatnexusConversations">) => Promise<void>;
  updateConversationTitle: (
    id: Id<"lifeos_chatnexusConversations">,
    title: string
  ) => Promise<void>;

  // Presets
  presets: ModelPreset[] | undefined;
  loadPreset: (preset: ModelPreset) => void;
  saveCurrentAsPreset: (name: string, isDefault?: boolean) => Promise<void>;
  deletePreset: (presetId: Id<"lifeos_chatnexusModelPresets">) => Promise<void>;
}

// ==================== HELPERS ====================

function generatePanelId(): string {
  return crypto.randomUUID();
}

// Get model for a provider at a specific tier
function getModelForProviderTier(
  provider: string,
  tier: ModelTier,
  tierConfig: TierConfiguration,
  enabledModelIds: string[]
): ModelOption | null {
  const providerConfig = tierConfig[provider];
  let modelId = providerConfig?.[tier] ?? null;

  // If model is not set or disabled, fall back to first enabled model for provider
  if (!modelId || !enabledModelIds.includes(modelId)) {
    const providerModels = WHITELISTED_MODELS.filter((m) => m.provider === provider);
    const firstEnabled = providerModels.find((m) => enabledModelIds.includes(m.id));
    modelId = firstEnabled?.id ?? null;
  }

  if (!modelId) return null;
  return WHITELISTED_MODELS.find((m) => m.id === modelId) ?? null;
}

// Create panel configs with each panel having a different provider
function createPanelConfigsForTier(
  layoutType: LayoutType,
  tier: ModelTier,
  tierConfig: TierConfiguration,
  enabledModelIds: string[],
  panelProviders: Provider[],
  existingConfigs?: PanelConfig[]
): PanelConfig[] {
  const panelCount = LAYOUT_CONFIGS[layoutType].panels;
  const configs: PanelConfig[] = [];

  for (let i = 0; i < panelCount; i++) {
    // Each panel gets a provider from the configured order (cycling through)
    const provider = panelProviders[i % panelProviders.length] || DEFAULT_PANEL_PROVIDERS[i % DEFAULT_PANEL_PROVIDERS.length];

    // Get the model for this provider at the current tier
    const model = getModelForProviderTier(provider, tier, tierConfig, enabledModelIds);

    if (!model) {
      // Fallback: use first enabled model from any provider
      const fallback = WHITELISTED_MODELS.find((m) => enabledModelIds.includes(m.id));
      if (fallback) {
        configs.push({
          panelId: existingConfigs?.[i]?.panelId || generatePanelId(),
          modelId: fallback.id,
          modelProvider: fallback.provider,
          modelDisplayName: fallback.name,
          position: i,
          isActive: true,
        });
      }
      continue;
    }

    configs.push({
      panelId: existingConfigs?.[i]?.panelId || generatePanelId(),
      modelId: model.id,
      modelProvider: model.provider,
      modelDisplayName: model.name,
      position: i,
      isActive: true,
    });
  }

  return configs;
}

// ==================== CONTEXT ====================

const ChatNexusContext = createContext<ChatNexusContextValue | null>(null);

export function ChatNexusProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { enabledModelIds, currentTier, setCurrentTier, tierConfiguration, panelProviders } =
    useChatNexusSettings();

  // Local state
  const [currentConversationId, setCurrentConversationId] =
    useState<Id<"lifeos_chatnexusConversations"> | null>(null);
  const [layoutType, setLayoutTypeState] = useState<LayoutType>("two-column");
  // Initialize with default tier config - will be updated in useEffect
  const [panelConfigs, setPanelConfigs] = useState<PanelConfig[]>(() =>
    createPanelConfigsForTier(
      "two-column",
      "mini", // Default tier
      DEFAULT_TIER_CONFIG,
      WHITELISTED_MODELS.map((m) => m.id), // All models enabled initially
      DEFAULT_PANEL_PROVIDERS
    )
  );
  const [streamState, setStreamState] = useState<StreamState>({});
  const [initializedWithSettings, setInitializedWithSettings] = useState(false);

  // Convex queries
  const conversations = useQuery(api.lifeos.chatnexus.getConversations, {
    includeArchived: false,
    limit: 50,
  });

  const messages = useQuery(
    api.lifeos.chatnexus.getMessages,
    currentConversationId
      ? { conversationId: currentConversationId, limit: 100 }
      : "skip"
  );

  const presets = useQuery(api.lifeos.chatnexus.getModelPresets);

  // Convex mutations
  const createConversationMutation = useMutation(
    api.lifeos.chatnexus.createConversation
  );
  const updateConversationMutation = useMutation(
    api.lifeos.chatnexus.updateConversation
  );
  const archiveConversationMutation = useMutation(
    api.lifeos.chatnexus.archiveConversation
  );
  const deleteConversationMutation = useMutation(
    api.lifeos.chatnexus.deleteConversation
  );
  const addUserMessageMutation = useMutation(
    api.lifeos.chatnexus.addUserMessage
  );
  const saveModelPresetMutation = useMutation(
    api.lifeos.chatnexus.saveModelPreset
  );
  const deleteModelPresetMutation = useMutation(
    api.lifeos.chatnexus.deleteModelPreset
  );

  // Derived state
  const isAnyPanelStreaming = Object.values(streamState).some(
    (s) => s.status === "pending" || s.status === "streaming"
  );

  const isLoadingMessages = currentConversationId !== null && messages === undefined;

  // Load conversation when selected
  useEffect(() => {
    if (currentConversationId && conversations) {
      const conversation = conversations.find(
        (c) => c._id === currentConversationId
      );
      if (conversation) {
        setLayoutTypeState(conversation.layoutType);
        // Use conversation's saved panel configs, but update disabled models
        const updatedConfigs = conversation.panelConfigs.map((config, i) => {
          if (enabledModelIds.includes(config.modelId)) {
            return { ...config, isActive: true };
          }
          // Model is disabled, get replacement based on provider and tier
          const model = getModelForProviderTier(
            config.modelProvider,
            currentTier,
            tierConfiguration,
            enabledModelIds
          );
          if (model) {
            return {
              ...config,
              modelId: model.id,
              modelProvider: model.provider,
              modelDisplayName: model.name,
              isActive: true,
            };
          }
          return { ...config, isActive: true };
        });
        setPanelConfigs(updatedConfigs);
      }
    }
  }, [currentConversationId, conversations, enabledModelIds, currentTier, tierConfiguration]);

  // Initialize panels with current tier and settings
  useEffect(() => {
    if (!initializedWithSettings) {
      // Initialize with user's settings (tier, enabled models, panel providers)
      const newConfigs = createPanelConfigsForTier(
        layoutType,
        currentTier,
        tierConfiguration,
        enabledModelIds,
        panelProviders,
        panelConfigs
      );
      setPanelConfigs(newConfigs);
      setInitializedWithSettings(true);
      return;
    }

    // Check if any panel uses a disabled model
    const hasDisabledModel = panelConfigs.some(
      (config) => !enabledModelIds.includes(config.modelId)
    );

    if (hasDisabledModel) {
      // Update panels to use only enabled models while keeping providers
      const updatedConfigs = panelConfigs.map((config) => {
        if (enabledModelIds.includes(config.modelId)) {
          return config;
        }
        const model = getModelForProviderTier(
          config.modelProvider,
          currentTier,
          tierConfiguration,
          enabledModelIds
        );
        if (model) {
          return {
            ...config,
            modelId: model.id,
            modelProvider: model.provider,
            modelDisplayName: model.name,
          };
        }
        return config;
      });
      setPanelConfigs(updatedConfigs);
    }
  }, [enabledModelIds, initializedWithSettings, layoutType, panelConfigs, currentTier, tierConfiguration, panelProviders]);

  // ==================== ACTIONS ====================

  const setLayoutType = useCallback(
    (type: LayoutType) => {
      setLayoutTypeState(type);
      const newConfigs = createPanelConfigsForTier(
        type,
        currentTier,
        tierConfiguration,
        enabledModelIds,
        panelProviders,
        panelConfigs
      );
      setPanelConfigs(newConfigs);

      // Update conversation if one is selected
      if (currentConversationId) {
        updateConversationMutation({
          conversationId: currentConversationId,
          layoutType: type,
          panelConfigs: newConfigs,
        });
      }
    },
    [currentConversationId, panelConfigs, enabledModelIds, currentTier, tierConfiguration, panelProviders, updateConversationMutation]
  );

  const updatePanelModel = useCallback(
    (panelId: string, model: ModelOption) => {
      setPanelConfigs((prev) =>
        prev.map((config) =>
          config.panelId === panelId
            ? {
                ...config,
                modelId: model.id,
                modelProvider: model.provider,
                modelDisplayName: model.name,
              }
            : config
        )
      );

      // Update conversation if one is selected
      if (currentConversationId) {
        const updatedConfigs = panelConfigs.map((config) =>
          config.panelId === panelId
            ? {
                ...config,
                modelId: model.id,
                modelProvider: model.provider,
                modelDisplayName: model.name,
              }
            : config
        );
        updateConversationMutation({
          conversationId: currentConversationId,
          panelConfigs: updatedConfigs,
        });
      }
    },
    [currentConversationId, panelConfigs, updateConversationMutation]
  );

  const applyTierToAllPanels = useCallback(
    (tier: ModelTier) => {
      // Update tier setting
      setCurrentTier(tier);

      // Update all panels to use the tier's model for their provider
      const newConfigs = panelConfigs.map((config) => {
        // Look up the model for this provider and tier
        const providerConfig = tierConfiguration[config.modelProvider];
        if (!providerConfig) return config;

        let modelId = providerConfig[tier];

        // If model is not set or disabled, fall back to first enabled model for provider
        if (!modelId || !enabledModelIds.includes(modelId)) {
          const providerModels = WHITELISTED_MODELS.filter(
            (m) => m.provider === config.modelProvider
          );
          const firstEnabled = providerModels.find((m) =>
            enabledModelIds.includes(m.id)
          );
          modelId = firstEnabled?.id ?? null;
        }

        if (!modelId) return config;

        const model = WHITELISTED_MODELS.find((m) => m.id === modelId);
        if (!model) return config;

        return {
          ...config,
          modelId: model.id,
          modelProvider: model.provider,
          modelDisplayName: model.name,
        };
      });

      setPanelConfigs(newConfigs);

      // Update conversation if one is selected
      if (currentConversationId) {
        updateConversationMutation({
          conversationId: currentConversationId,
          panelConfigs: newConfigs,
        });
      }
    },
    [
      setCurrentTier,
      tierConfiguration,
      enabledModelIds,
      panelConfigs,
      currentConversationId,
      updateConversationMutation,
    ]
  );

  const createConversation = useCallback(async () => {
    const conversationId = await createConversationMutation({
      title: "New Chat",
      layoutType,
      panelConfigs,
    });
    setCurrentConversationId(conversationId);
    return conversationId;
  }, [createConversationMutation, layoutType, panelConfigs]);

  const loadConversation = useCallback(
    (id: Id<"lifeos_chatnexusConversations">) => {
      setCurrentConversationId(id);
      setStreamState({});
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isAnyPanelStreaming) return;

      // Create conversation if none exists
      let conversationId = currentConversationId;
      if (!conversationId) {
        conversationId = await createConversation();
      }

      const activePanels = panelConfigs.filter((p) => p.isActive);
      const broadcastId = crypto.randomUUID();

      // Initialize stream state for all panels
      const initialStreamState: StreamState = {};
      for (const panel of activePanels) {
        initialStreamState[panel.panelId] = {
          status: "pending",
          partialContent: "",
        };
      }
      setStreamState(initialStreamState);

      try {
        // Get auth token for HTTP request
        const token = await getToken({ template: "convex" });
        if (!token) {
          throw new Error("Not authenticated");
        }

        // Add user message first
        await addUserMessageMutation({
          conversationId,
          content,
          broadcastId,
        });

        // Call HTTP streaming endpoint
        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        // Extract site URL from Convex URL (e.g., https://example.convex.cloud -> https://example.convex.site)
        const siteUrl = convexUrl.replace(".cloud", ".site");

        const response = await fetch(`${siteUrl}/chatnexus/stream`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            message: content,
            broadcastId,
            panels: activePanels.map((p) => ({
              panelId: p.panelId,
              modelId: p.modelId,
              modelProvider: p.modelProvider,
            })),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Stream request failed");
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

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const { panelId, content: chunk, error, done: isDone } = data;

                setStreamState((prev) => ({
                  ...prev,
                  [panelId]: {
                    status: isDone
                      ? error
                        ? "error"
                        : "completed"
                      : "streaming",
                    partialContent:
                      (prev[panelId]?.partialContent || "") + (chunk || ""),
                    error,
                  },
                }));
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        console.error("[ChatNexus] Send message error:", error);
        // Set all panels to error state
        setStreamState((prev) => {
          const newState = { ...prev };
          for (const panelId of Object.keys(newState)) {
            if (
              newState[panelId].status === "pending" ||
              newState[panelId].status === "streaming"
            ) {
              newState[panelId] = {
                ...newState[panelId],
                status: "error",
                error:
                  error instanceof Error ? error.message : "Unknown error",
              };
            }
          }
          return newState;
        });
      }

      // Clear stream state after a delay (let UI show final state)
      setTimeout(() => {
        setStreamState({});
      }, 500);
    },
    [
      currentConversationId,
      panelConfigs,
      isAnyPanelStreaming,
      getToken,
      createConversation,
      addUserMessageMutation,
    ]
  );

  const archiveConversation = useCallback(
    async (id: Id<"lifeos_chatnexusConversations">) => {
      await archiveConversationMutation({ conversationId: id });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [archiveConversationMutation, currentConversationId]
  );

  const deleteConversation = useCallback(
    async (id: Id<"lifeos_chatnexusConversations">) => {
      await deleteConversationMutation({ conversationId: id });
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    },
    [deleteConversationMutation, currentConversationId]
  );

  const updateConversationTitle = useCallback(
    async (id: Id<"lifeos_chatnexusConversations">, title: string) => {
      await updateConversationMutation({ conversationId: id, title });
    },
    [updateConversationMutation]
  );

  const loadPreset = useCallback(
    (preset: ModelPreset) => {
      setLayoutTypeState(preset.layoutType);
      const newConfigs = preset.panelConfigs.map((pc, index) => ({
        panelId: generatePanelId(),
        modelId: pc.modelId,
        modelProvider: pc.modelProvider,
        modelDisplayName: pc.modelDisplayName,
        position: pc.position,
        isActive: true,
      }));
      setPanelConfigs(newConfigs);

      // Update conversation if one is selected
      if (currentConversationId) {
        updateConversationMutation({
          conversationId: currentConversationId,
          layoutType: preset.layoutType,
          panelConfigs: newConfigs,
        });
      }
    },
    [currentConversationId, updateConversationMutation]
  );

  const saveCurrentAsPreset = useCallback(
    async (name: string, isDefault = false) => {
      await saveModelPresetMutation({
        name,
        layoutType,
        panelConfigs: panelConfigs.map((pc) => ({
          modelId: pc.modelId,
          modelProvider: pc.modelProvider,
          modelDisplayName: pc.modelDisplayName,
          position: pc.position,
        })),
        isDefault,
      });
    },
    [saveModelPresetMutation, layoutType, panelConfigs]
  );

  const deletePreset = useCallback(
    async (presetId: Id<"lifeos_chatnexusModelPresets">) => {
      await deleteModelPresetMutation({ presetId });
    },
    [deleteModelPresetMutation]
  );

  // ==================== CONTEXT VALUE ====================

  const value: ChatNexusContextValue = {
    // Conversation state
    currentConversationId,
    conversations,
    messages,
    isLoadingMessages,

    // Layout and panels
    layoutType,
    panelConfigs,

    // Tier state
    currentTier,

    // Streaming state
    streamState,
    isAnyPanelStreaming,

    // Actions
    createConversation,
    loadConversation,
    setLayoutType,
    updatePanelModel,
    applyTierToAllPanels,
    sendMessage,
    archiveConversation,
    deleteConversation,
    updateConversationTitle,

    // Presets
    presets,
    loadPreset,
    saveCurrentAsPreset,
    deletePreset,
  };

  return (
    <ChatNexusContext.Provider value={value}>
      {children}
    </ChatNexusContext.Provider>
  );
}

export function useChatNexus() {
  const context = useContext(ChatNexusContext);
  if (!context) {
    throw new Error("useChatNexus must be used within a ChatNexusProvider");
  }
  return context;
}
