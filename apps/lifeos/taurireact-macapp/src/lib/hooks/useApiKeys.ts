import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ApiKeysState {
  groqApiKey: string | null;
  isLoading: boolean;
  error: string | null;
}

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export function useApiKeys() {
  const [state, setState] = useState<ApiKeysState>({
    groqApiKey: null,
    isLoading: true,
    error: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load API key on mount
  const loadApiKey = useCallback(async () => {
    if (!isTauri) {
      setState({
        groqApiKey: null,
        isLoading: false,
        error: "Not running in Tauri",
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const apiKey = await invoke<string | null>("get_groq_api_key");
      setState({
        groqApiKey: apiKey,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState({
        groqApiKey: null,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load API key",
      });
    }
  }, []);

  useEffect(() => {
    loadApiKey();
  }, [loadApiKey]);

  // Save API key
  const saveGroqApiKey = useCallback(
    async (apiKey: string): Promise<boolean> => {
      if (!isTauri) return false;

      setIsSaving(true);

      try {
        await invoke("save_groq_api_key", { apiKey });
        setState((prev) => ({ ...prev, groqApiKey: apiKey, error: null }));
        return true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Failed to save API key",
        }));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  // Delete API key
  const deleteGroqApiKey = useCallback(async (): Promise<boolean> => {
    if (!isTauri) return false;

    setIsSaving(true);

    try {
      await invoke("delete_groq_api_key");
      setState((prev) => ({ ...prev, groqApiKey: null, error: null }));
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to delete API key",
      }));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Check if API key is configured
  const hasGroqApiKey = Boolean(state.groqApiKey);

  return {
    groqApiKey: state.groqApiKey,
    hasGroqApiKey,
    isLoading: state.isLoading,
    isSaving,
    error: state.error,
    saveGroqApiKey,
    deleteGroqApiKey,
    refreshApiKey: loadApiKey,
  };
}
