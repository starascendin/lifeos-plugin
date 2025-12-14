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
  DEFAULT_PANEL_MODELS,
  LAYOUT_CONFIGS,
  WHITELISTED_MODELS,
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

  // Streaming state
  streamState: StreamState;
  isAnyPanelStreaming: boolean;

  // Actions
  createConversation: () => Promise<Id<"lifeos_chatnexusConversations">>;
  loadConversation: (id: Id<"lifeos_chatnexusConversations">) => void;
  setLayoutType: (type: LayoutType) => void;
  updatePanelModel: (panelId: string, model: ModelOption) => void;
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

function getEnabledDefaultModels(enabledModelIds: string[]): ModelOption[] {
  // Filter DEFAULT_PANEL_MODELS to only include enabled models
  const enabledDefaults = DEFAULT_PANEL_MODELS.filter((m) =>
    enabledModelIds.includes(m.id)
  );

  // If no default models are enabled, use the first enabled model from whitelist
  if (enabledDefaults.length === 0) {
    const firstEnabled = WHITELISTED_MODELS.find((m) =>
      enabledModelIds.includes(m.id)
    );
    return firstEnabled ? [firstEnabled] : [WHITELISTED_MODELS[0]];
  }

  return enabledDefaults;
}

function createDefaultPanelConfigs(
  layoutType: LayoutType,
  existingConfigs?: PanelConfig[],
  enabledModelIds?: string[]
): PanelConfig[] {
  const panelCount = LAYOUT_CONFIGS[layoutType].panels;
  const configs: PanelConfig[] = [];

  // Get enabled default models (or all defaults if no filter provided)
  const defaultModels = enabledModelIds
    ? getEnabledDefaultModels(enabledModelIds)
    : DEFAULT_PANEL_MODELS;

  for (let i = 0; i < panelCount; i++) {
    // Reuse existing config if available and model is still enabled
    const existing = existingConfigs?.find((c) => c.position === i);
    if (existing) {
      // Check if model is still enabled
      const isEnabled = !enabledModelIds || enabledModelIds.includes(existing.modelId);
      if (isEnabled) {
        configs.push({ ...existing, isActive: true });
        continue;
      }
    }

    // Use default model (cycle through enabled defaults)
    const defaultModel = defaultModels[i % defaultModels.length] || defaultModels[0];
    configs.push({
      panelId: existing?.panelId || generatePanelId(),
      modelId: defaultModel.id,
      modelProvider: defaultModel.provider,
      modelDisplayName: defaultModel.name,
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
  const { enabledModelIds } = useChatNexusSettings();

  // Local state
  const [currentConversationId, setCurrentConversationId] =
    useState<Id<"lifeos_chatnexusConversations"> | null>(null);
  const [layoutType, setLayoutTypeState] = useState<LayoutType>("two-column");
  const [panelConfigs, setPanelConfigs] = useState<PanelConfig[]>(() =>
    createDefaultPanelConfigs("two-column")
  );
  const [streamState, setStreamState] = useState<StreamState>({});
  const [initializedWithEnabledModels, setInitializedWithEnabledModels] = useState(false);

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
        // Filter panel configs to only use enabled models
        const filteredConfigs = createDefaultPanelConfigs(
          conversation.layoutType,
          conversation.panelConfigs,
          enabledModelIds
        );
        setPanelConfigs(filteredConfigs);
      }
    }
  }, [currentConversationId, conversations, enabledModelIds]);

  // Update panel configs when enabled models change
  useEffect(() => {
    if (!initializedWithEnabledModels) {
      // Initialize with enabled models on first render
      setPanelConfigs((prev) =>
        createDefaultPanelConfigs(layoutType, prev, enabledModelIds)
      );
      setInitializedWithEnabledModels(true);
      return;
    }

    // Check if any panel uses a disabled model
    const hasDisabledModel = panelConfigs.some(
      (config) => !enabledModelIds.includes(config.modelId)
    );

    if (hasDisabledModel) {
      // Update panels to use only enabled models
      const updatedConfigs = createDefaultPanelConfigs(
        layoutType,
        panelConfigs,
        enabledModelIds
      );
      setPanelConfigs(updatedConfigs);
    }
  }, [enabledModelIds, initializedWithEnabledModels, layoutType, panelConfigs]);

  // ==================== ACTIONS ====================

  const setLayoutType = useCallback(
    (type: LayoutType) => {
      setLayoutTypeState(type);
      const newConfigs = createDefaultPanelConfigs(type, panelConfigs, enabledModelIds);
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
    [currentConversationId, panelConfigs, enabledModelIds, updateConversationMutation]
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

    // Streaming state
    streamState,
    isAnyPanelStreaming,

    // Actions
    createConversation,
    loadConversation,
    setLayoutType,
    updatePanelModel,
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
