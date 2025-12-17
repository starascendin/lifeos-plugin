import { useState, useEffect, useCallback } from "react";
import {
  WHITELISTED_MODELS,
  DEFAULT_TIER_CONFIG,
  DEFAULT_PANEL_PROVIDERS,
  ModelTier,
  TierConfiguration,
  Provider,
} from "../constants/models";

const STORAGE_KEY = "chatnexus-settings";

interface ChatNexusSettings {
  sidebarCollapsed: boolean;
  enabledModelIds: string[];
  currentTier: ModelTier;
  tierConfiguration: TierConfiguration;
  panelProviders: Provider[]; // Which provider each panel position uses
}

function getDefaultSettings(): ChatNexusSettings {
  return {
    sidebarCollapsed: false,
    enabledModelIds: WHITELISTED_MODELS.map((m) => m.id),
    currentTier: "mini",
    tierConfiguration: { ...DEFAULT_TIER_CONFIG },
    panelProviders: [...DEFAULT_PANEL_PROVIDERS],
  };
}

function loadSettings(): ChatNexusSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ChatNexusSettings>;
      // Ensure enabledModelIds only contains valid model IDs
      const validIds = new Set(WHITELISTED_MODELS.map((m) => m.id));
      const validEnabledIds = (parsed.enabledModelIds || []).filter((id) => validIds.has(id));

      // Migration: use defaults for missing tier settings
      const defaults = getDefaultSettings();

      // Merge tier configuration with defaults to ensure all providers have config
      const mergedTierConfig = { ...defaults.tierConfiguration };
      if (parsed.tierConfiguration) {
        for (const provider of Object.keys(parsed.tierConfiguration)) {
          if (parsed.tierConfiguration[provider]) {
            mergedTierConfig[provider] = {
              ...defaults.tierConfiguration[provider],
              ...parsed.tierConfiguration[provider],
            };
          }
        }
      }

      return {
        sidebarCollapsed: parsed.sidebarCollapsed ?? false,
        enabledModelIds: validEnabledIds.length > 0 ? validEnabledIds : defaults.enabledModelIds,
        currentTier: parsed.currentTier ?? defaults.currentTier,
        tierConfiguration: mergedTierConfig,
        panelProviders: parsed.panelProviders ?? defaults.panelProviders,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return getDefaultSettings();
}

export function useChatNexusSettings() {
  const [settings, setSettings] = useState<ChatNexusSettings>(loadSettings);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSettings((prev) => ({ ...prev, sidebarCollapsed: collapsed }));
  }, []);

  const toggleModel = useCallback((modelId: string) => {
    setSettings((prev) => {
      const isEnabled = prev.enabledModelIds.includes(modelId);
      const newEnabledIds = isEnabled
        ? prev.enabledModelIds.filter((id) => id !== modelId)
        : [...prev.enabledModelIds, modelId];
      // Ensure at least one model is enabled
      if (newEnabledIds.length === 0) {
        return prev;
      }
      return { ...prev, enabledModelIds: newEnabledIds };
    });
  }, []);

  const enableAllModels = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      enabledModelIds: WHITELISTED_MODELS.map((m) => m.id),
    }));
  }, []);

  const disableAllModels = useCallback(() => {
    // Keep at least the first model enabled
    setSettings((prev) => ({
      ...prev,
      enabledModelIds: [WHITELISTED_MODELS[0].id],
    }));
  }, []);

  const isModelEnabled = useCallback(
    (modelId: string) => {
      return settings.enabledModelIds.includes(modelId);
    },
    [settings.enabledModelIds]
  );

  // Tier-related methods
  const setCurrentTier = useCallback((tier: ModelTier) => {
    setSettings((prev) => ({ ...prev, currentTier: tier }));
  }, []);

  const updateTierModel = useCallback(
    (provider: string, tier: ModelTier, modelId: string | null) => {
      setSettings((prev) => ({
        ...prev,
        tierConfiguration: {
          ...prev.tierConfiguration,
          [provider]: {
            ...prev.tierConfiguration[provider],
            [tier]: modelId,
          },
        },
      }));
    },
    []
  );

  const getModelIdForTier = useCallback(
    (provider: string, tier: ModelTier): string | null => {
      const providerConfig = settings.tierConfiguration[provider];
      if (!providerConfig) return null;

      const modelId = providerConfig[tier];
      if (!modelId) return null;

      // Check if the model is enabled, if not fall back to first enabled model for provider
      if (settings.enabledModelIds.includes(modelId)) {
        return modelId;
      }

      // Fall back to first enabled model from this provider
      const providerModels = WHITELISTED_MODELS.filter((m) => m.provider === provider);
      const firstEnabled = providerModels.find((m) => settings.enabledModelIds.includes(m.id));
      return firstEnabled?.id ?? null;
    },
    [settings.tierConfiguration, settings.enabledModelIds]
  );

  // Panel provider methods
  const setPanelProvider = useCallback(
    (panelIndex: number, provider: Provider) => {
      setSettings((prev) => {
        const newProviders = [...prev.panelProviders];
        // Ensure array is long enough
        while (newProviders.length <= panelIndex) {
          newProviders.push(DEFAULT_PANEL_PROVIDERS[newProviders.length % DEFAULT_PANEL_PROVIDERS.length]);
        }
        newProviders[panelIndex] = provider;
        return { ...prev, panelProviders: newProviders };
      });
    },
    []
  );

  return {
    sidebarCollapsed: settings.sidebarCollapsed,
    setSidebarCollapsed,
    enabledModelIds: settings.enabledModelIds,
    toggleModel,
    enableAllModels,
    disableAllModels,
    isModelEnabled,
    // Tier-related
    currentTier: settings.currentTier,
    tierConfiguration: settings.tierConfiguration,
    setCurrentTier,
    updateTierModel,
    getModelIdForTier,
    // Panel providers
    panelProviders: settings.panelProviders,
    setPanelProvider,
  };
}
