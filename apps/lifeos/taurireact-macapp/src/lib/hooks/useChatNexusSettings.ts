import { useState, useEffect, useCallback } from "react";
import { WHITELISTED_MODELS } from "../constants/models";

const STORAGE_KEY = "chatnexus-settings";

interface ChatNexusSettings {
  sidebarCollapsed: boolean;
  enabledModelIds: string[];
}

function getDefaultSettings(): ChatNexusSettings {
  return {
    sidebarCollapsed: false,
    enabledModelIds: WHITELISTED_MODELS.map((m) => m.id),
  };
}

function loadSettings(): ChatNexusSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ChatNexusSettings;
      // Ensure enabledModelIds only contains valid model IDs
      const validIds = new Set(WHITELISTED_MODELS.map((m) => m.id));
      const validEnabledIds = parsed.enabledModelIds.filter((id) => validIds.has(id));
      return {
        sidebarCollapsed: parsed.sidebarCollapsed ?? false,
        enabledModelIds: validEnabledIds.length > 0 ? validEnabledIds : getDefaultSettings().enabledModelIds,
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

  return {
    sidebarCollapsed: settings.sidebarCollapsed,
    setSidebarCollapsed,
    enabledModelIds: settings.enabledModelIds,
    toggleModel,
    enableAllModels,
    disableAllModels,
    isModelEnabled,
  };
}
