import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

// ==================== TYPES ====================

export type LLMType = "chatgpt" | "claude" | "gemini" | "xai";
export type Tier = "mini" | "normal" | "pro";
export type ViewMode = "council" | "multichat";
export type LayoutType = 1 | 2 | 3 | 4;

export interface AuthStatus {
  chatgpt: boolean;
  claude: boolean;
  gemini: boolean;
  xai: boolean;
}

// Model tiers configuration
export const MODEL_TIERS: Record<Tier, Record<LLMType, string>> = {
  mini: {
    chatgpt: "gpt-4o",
    claude: "claude-haiku-4-5-20251001",
    gemini: "gemini-3-flash",
    xai: "xai/grok-4.1-fast-non-reasoning",
  },
  normal: {
    chatgpt: "gpt-5-2-instant",
    claude: "claude-sonnet-4-5-20250929",
    gemini: "gemini-3-fast",
    xai: "xai/grok-4-fast-reasoning",
  },
  pro: {
    chatgpt: "gpt-5-2-thinking",
    claude: "claude-opus-4-5-20251101",
    gemini: "gemini-3-pro",
    xai: "xai/grok-4.1-fast-reasoning",
  },
};

// LLM display info
export const LLM_INFO: Record<
  LLMType,
  { name: string; color: string; bgColor: string }
> = {
  chatgpt: { name: "ChatGPT", color: "text-green-600", bgColor: "bg-green-100" },
  claude: { name: "Claude", color: "text-orange-600", bgColor: "bg-orange-100" },
  gemini: { name: "Gemini", color: "text-purple-600", bgColor: "bg-purple-100" },
  xai: { name: "Grok", color: "text-blue-600", bgColor: "bg-blue-100" },
};

// Council types
export interface Stage1Result {
  model: string;
  llmType: string;
  response: string;
}

export interface Stage2Result {
  model: string;
  llmType: string;
  ranking: string;
  parsedRanking?: string[];
}

export interface Stage3Result {
  model: string;
  llmType: string;
  response: string;
}

export interface AggregateRanking {
  model: string;
  llmType: string;
  averageRank: number;
  rankingsCount: number;
}

export interface CouncilMetadata {
  aggregateRankings?: AggregateRanking[];
  labelToModel?: Record<string, { model: string; llmType: string }>;
}

// Conversation history types
export interface ConversationListItem {
  id: string;
  query: string;
  createdAt: string;
  tier?: string;
  selectedLLMs?: string[];
}

export interface CouncilMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  stage1?: Stage1Result[];
  stage2?: Stage2Result[];
  stage3?: Stage3Result[];
  metadata?: CouncilMetadata;
  isLoading?: boolean;
  error?: string;
  duration?: number;
}

// Multi-chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface PanelState {
  id: string;
  llmType: LLMType;
  model: string;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  context?: Record<string, unknown>; // For multi-turn conversations
}

// ==================== CONTEXT ====================

const STORAGE_KEY = "llm-council-api-settings";

interface LLMCouncilAPIContextValue {
  // Settings (from localStorage)
  baseUrl: string;
  apiKey: string;
  isConfigured: boolean;
  saveSettings: (baseUrl: string, apiKey: string) => void;

  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Layout state (for multi-chat)
  currentLayout: LayoutType;
  setCurrentLayout: (layout: LayoutType) => void;

  // Tier state
  currentTier: Tier;
  setCurrentTier: (tier: Tier) => void;

  // Auth status
  authStatus: AuthStatus;
  isCheckingAuth: boolean;
  checkAuthStatus: () => Promise<void>;

  // Council mode state
  selectedLLMs: LLMType[];
  toggleLLM: (llm: LLMType) => void;
  councilMessages: CouncilMessage[];
  isCouncilLoading: boolean;
  sendCouncilQuery: (query: string) => Promise<void>;
  clearCouncilMessages: () => void;

  // Conversation history
  conversations: ConversationListItem[];
  isLoadingConversations: boolean;
  fetchConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  currentConversationId: string | null;

  // Multi-chat state
  panels: PanelState[];
  setPanelLLM: (panelId: string, llmType: LLMType) => void;
  clearPanel: (panelId: string) => void;
  sendChatMessage: (message: string) => Promise<void>;

  // Health
  isHealthy: boolean;
  checkHealth: () => Promise<void>;
}

const LLMCouncilAPIContext = createContext<LLMCouncilAPIContextValue | null>(
  null
);

// ==================== HELPERS ====================

function generateId(): string {
  return crypto.randomUUID();
}

function createInitialPanels(layout: LayoutType, tier: Tier): PanelState[] {
  const llmTypes: LLMType[] = ["chatgpt", "claude", "gemini", "xai"];
  const panels: PanelState[] = [];

  for (let i = 0; i < layout; i++) {
    const llmType = llmTypes[i % llmTypes.length];
    panels.push({
      id: generateId(),
      llmType,
      model: MODEL_TIERS[tier][llmType],
      messages: [],
      isLoading: false,
      error: null,
    });
  }

  return panels;
}

// ==================== PROVIDER ====================

export function LLMCouncilAPIProvider({ children }: { children: ReactNode }) {
  // Load settings from localStorage
  const [baseUrl, setBaseUrl] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.baseUrl || "";
      }
    } catch {}
    return "";
  });

  const [apiKey, setApiKey] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.apiKey || "";
      }
    } catch {}
    return "";
  });

  const isConfigured = Boolean(baseUrl && apiKey);

  // Save settings to localStorage and refresh status
  const saveSettings = useCallback(
    async (newBaseUrl: string, newApiKey: string) => {
      setBaseUrl(newBaseUrl);
      setApiKey(newApiKey);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ baseUrl: newBaseUrl, apiKey: newApiKey })
        );
      } catch {}

      // Immediately check health with new settings
      if (newBaseUrl && newApiKey) {
        try {
          const res = await fetch(`${newBaseUrl}health`, {
            headers: { "X-API-Key": newApiKey },
          });
          if (res.ok) {
            const data = await res.json();
            setIsHealthy(data.extensionConnected === true);
          } else {
            setIsHealthy(false);
          }
        } catch {
          setIsHealthy(false);
        }

        // Check auth status
        try {
          const res = await fetch(`${newBaseUrl}auth-status`, {
            headers: { "X-API-Key": newApiKey },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.status) {
              setAuthStatus({
                chatgpt: data.status.chatgpt ?? false,
                claude: data.status.claude ?? false,
                gemini: data.status.gemini ?? false,
                xai: data.status.xai ?? false,
              });
            }
          }
        } catch {}
      }
    },
    []
  );

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("council");
  const [currentLayout, setCurrentLayoutState] = useState<LayoutType>(2);
  const [currentTier, setCurrentTierState] = useState<Tier>("normal");

  // Auth status
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    chatgpt: false,
    claude: false,
    gemini: false,
    xai: false,
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Council state
  const [selectedLLMs, setSelectedLLMs] = useState<LLMType[]>([
    "chatgpt",
    "claude",
    "gemini",
  ]);
  const [councilMessages, setCouncilMessages] = useState<CouncilMessage[]>([]);
  const [isCouncilLoading, setIsCouncilLoading] = useState(false);

  // Conversation history state
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Multi-chat state
  const [panels, setPanels] = useState<PanelState[]>(() =>
    createInitialPanels(2, "normal")
  );

  // Health state
  const [isHealthy, setIsHealthy] = useState(false);

  // Check health on mount
  const checkHealth = useCallback(async () => {
    if (!baseUrl || !apiKey) return;

    try {
      const res = await fetch(`${baseUrl}health`, {
        headers: { "X-API-Key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setIsHealthy(data.extensionConnected === true);
      } else {
        setIsHealthy(false);
      }
    } catch {
      setIsHealthy(false);
    }
  }, [baseUrl, apiKey]);

  // Check auth status
  const checkAuthStatus = useCallback(async () => {
    if (!baseUrl || !apiKey) return;

    setIsCheckingAuth(true);
    try {
      const res = await fetch(`${baseUrl}auth-status`, {
        headers: { "X-API-Key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status) {
          setAuthStatus({
            chatgpt: data.status.chatgpt ?? false,
            claude: data.status.claude ?? false,
            gemini: data.status.gemini ?? false,
            xai: data.status.xai ?? false,
          });
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsCheckingAuth(false);
    }
  }, [baseUrl, apiKey]);

  // Initial checks
  useEffect(() => {
    if (isConfigured) {
      checkHealth();
      checkAuthStatus();
    }
  }, [isConfigured, checkHealth, checkAuthStatus]);

  // Update panels when layout changes
  const setCurrentLayout = useCallback(
    (layout: LayoutType) => {
      setCurrentLayoutState(layout);

      setPanels((prev) => {
        if (layout > prev.length) {
          // Add panels
          const llmTypes: LLMType[] = ["chatgpt", "claude", "gemini", "xai"];
          const newPanels = [...prev];
          for (let i = prev.length; i < layout; i++) {
            const llmType = llmTypes[i % llmTypes.length];
            newPanels.push({
              id: generateId(),
              llmType,
              model: MODEL_TIERS[currentTier][llmType],
              messages: [],
              isLoading: false,
              error: null,
            });
          }
          return newPanels;
        } else if (layout < prev.length) {
          // Remove panels from end
          return prev.slice(0, layout);
        }
        return prev;
      });
    },
    [currentTier]
  );

  // Update panel models when tier changes
  const setCurrentTier = useCallback((tier: Tier) => {
    setCurrentTierState(tier);
    setPanels((prev) =>
      prev.map((panel) => ({
        ...panel,
        model: MODEL_TIERS[tier][panel.llmType],
      }))
    );
  }, []);

  // Toggle LLM selection (minimum 2)
  const toggleLLM = useCallback((llm: LLMType) => {
    setSelectedLLMs((prev) => {
      if (prev.includes(llm)) {
        // Don't remove if only 2 selected
        if (prev.length <= 2) return prev;
        return prev.filter((l) => l !== llm);
      } else {
        return [...prev, llm];
      }
    });
  }, []);

  // Send council query
  const sendCouncilQuery = useCallback(
    async (query: string) => {
      if (!query.trim() || !isConfigured || isCouncilLoading) return;

      const userMessageId = generateId();
      const assistantMessageId = generateId();

      // Add user message
      setCouncilMessages((prev) => [
        ...prev,
        { id: userMessageId, role: "user", content: query },
      ]);

      // Add loading assistant message
      setCouncilMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", isLoading: true },
      ]);

      setIsCouncilLoading(true);

      try {
        const res = await fetch(`${baseUrl}prompt`, {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: query.trim(),
            tier: currentTier,
            selectedLLMs,
            timeout: 120000,
          }),
        });

        const data = await res.json();

        // Update assistant message with results
        setCouncilMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  isLoading: false,
                  stage1: data.stage1,
                  stage2: data.stage2,
                  stage3: data.stage3,
                  metadata: data.metadata,
                  error: data.success ? undefined : data.error,
                  duration: data.duration,
                }
              : msg
          )
        );
      } catch (err) {
        // Update with error
        setCouncilMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  isLoading: false,
                  error: err instanceof Error ? err.message : "Request failed",
                }
              : msg
          )
        );
      } finally {
        setIsCouncilLoading(false);
      }
    },
    [baseUrl, apiKey, currentTier, selectedLLMs, isConfigured, isCouncilLoading]
  );

  // Clear council messages
  const clearCouncilMessages = useCallback(() => {
    setCouncilMessages([]);
    setCurrentConversationId(null);
  }, []);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    if (!baseUrl || !apiKey) return;

    setIsLoadingConversations(true);
    try {
      const res = await fetch(`${baseUrl}conversations`, {
        headers: { "X-API-Key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        // API returns array of conversations
        if (Array.isArray(data)) {
          setConversations(data);
        } else if (data.conversations && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingConversations(false);
    }
  }, [baseUrl, apiKey]);

  // Load specific conversation
  const loadConversation = useCallback(
    async (id: string) => {
      if (!baseUrl || !apiKey) return;

      setIsCouncilLoading(true);
      try {
        const res = await fetch(`${baseUrl}conversations/${id}`, {
          headers: { "X-API-Key": apiKey },
        });
        if (res.ok) {
          const data = await res.json();

          // Convert conversation data to our message format
          const messages: CouncilMessage[] = [];

          // Add user message
          if (data.query) {
            messages.push({
              id: `${id}-user`,
              role: "user",
              content: data.query,
            });
          }

          // Add assistant message with stages
          messages.push({
            id: `${id}-assistant`,
            role: "assistant",
            stage1: data.stage1,
            stage2: data.stage2,
            stage3: data.stage3,
            metadata: data.metadata,
            duration: data.duration,
          });

          setCouncilMessages(messages);
          setCurrentConversationId(id);
        }
      } catch {
        // Silently fail
      } finally {
        setIsCouncilLoading(false);
      }
    },
    [baseUrl, apiKey]
  );

  // Set panel LLM
  const setPanelLLM = useCallback(
    (panelId: string, llmType: LLMType) => {
      setPanels((prev) =>
        prev.map((panel) =>
          panel.id === panelId
            ? {
                ...panel,
                llmType,
                model: MODEL_TIERS[currentTier][llmType],
                messages: [], // Clear messages when changing LLM
                context: undefined,
              }
            : panel
        )
      );
    },
    [currentTier]
  );

  // Clear panel messages
  const clearPanel = useCallback((panelId: string) => {
    setPanels((prev) =>
      prev.map((panel) =>
        panel.id === panelId
          ? { ...panel, messages: [], error: null, context: undefined }
          : panel
      )
    );
  }, []);

  // Send chat message to all panels
  const sendChatMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !isConfigured) return;

      const userMessageId = generateId();

      // Add user message to all panels
      setPanels((prev) =>
        prev.map((panel) => ({
          ...panel,
          messages: [
            ...panel.messages,
            { id: userMessageId, role: "user" as const, content: message },
          ],
          isLoading: true,
          error: null,
        }))
      );

      // Send to each panel in parallel
      const promises = panels.map(async (panel) => {
        const assistantMessageId = generateId();

        try {
          const res = await fetch(`${baseUrl}api/chat/${panel.llmType}`, {
            method: "POST",
            headers: {
              "X-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: message.trim(),
              model: panel.model,
              context: panel.context,
            }),
          });

          const data = await res.json();

          return {
            panelId: panel.id,
            success: data.success !== false,
            response: data.response || data.error || "No response",
            context: data.context,
            assistantMessageId,
          };
        } catch (err) {
          return {
            panelId: panel.id,
            success: false,
            response: err instanceof Error ? err.message : "Request failed",
            assistantMessageId,
          };
        }
      });

      const results = await Promise.allSettled(promises);

      // Update panels with responses
      setPanels((prev) =>
        prev.map((panel) => {
          const result = results.find(
            (r) =>
              r.status === "fulfilled" && r.value.panelId === panel.id
          );

          if (result?.status === "fulfilled") {
            const { success, response, context, assistantMessageId } =
              result.value;
            return {
              ...panel,
              messages: [
                ...panel.messages,
                {
                  id: assistantMessageId,
                  role: "assistant" as const,
                  content: response,
                },
              ],
              isLoading: false,
              error: success ? null : response,
              context: context ?? panel.context,
            };
          }

          return { ...panel, isLoading: false };
        })
      );
    },
    [baseUrl, apiKey, panels, isConfigured]
  );

  // ==================== CONTEXT VALUE ====================

  const value: LLMCouncilAPIContextValue = {
    // Settings
    baseUrl,
    apiKey,
    isConfigured,
    saveSettings,

    // View state
    viewMode,
    setViewMode,

    // Layout
    currentLayout,
    setCurrentLayout,

    // Tier
    currentTier,
    setCurrentTier,

    // Auth
    authStatus,
    isCheckingAuth,
    checkAuthStatus,

    // Council
    selectedLLMs,
    toggleLLM,
    councilMessages,
    isCouncilLoading,
    sendCouncilQuery,
    clearCouncilMessages,

    // Conversation history
    conversations,
    isLoadingConversations,
    fetchConversations,
    loadConversation,
    currentConversationId,

    // Multi-chat
    panels,
    setPanelLLM,
    clearPanel,
    sendChatMessage,

    // Health
    isHealthy,
    checkHealth,
  };

  return (
    <LLMCouncilAPIContext.Provider value={value}>
      {children}
    </LLMCouncilAPIContext.Provider>
  );
}

export function useLLMCouncilAPI() {
  const context = useContext(LLMCouncilAPIContext);
  if (!context) {
    throw new Error(
      "useLLMCouncilAPI must be used within a LLMCouncilAPIProvider"
    );
  }
  return context;
}
