import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { getAccessToken } from '../services/chatgpt';
import { getClaudeOrgUuid } from '../services/claude';
import { getGeminiRequestParams } from '../services/gemini';
import { isXaiConfigured } from '../services/xai';

/**
 * Check if we're running in server mode (no chrome APIs available).
 */
function isServerMode(): boolean {
  return typeof chrome === 'undefined' || !chrome.storage?.local;
}

export function useAuthStatus() {
  const setAuthStatus = useAppStore((state) => state.setAuthStatus);

  /**
   * Check auth status via HTTP (for server mode).
   */
  const checkAuthViaServer = useCallback(async () => {
    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/auth-status`);
      const data = await response.json();

      if (data.success && data.status) {
        setAuthStatus({
          chatgpt: data.status.chatgpt,
          claude: data.status.claude,
          gemini: data.status.gemini,
          xai: data.status.xai
        });
      } else {
        setAuthStatus({ chatgpt: false, claude: false, gemini: false, xai: false });
      }
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      setAuthStatus({ chatgpt: false, claude: false, gemini: false, xai: false });
    }
  }, [setAuthStatus]);

  /**
   * Check auth status directly (for extension mode).
   */
  const checkAuthDirect = useCallback(async () => {
    try {
      await getAccessToken();
      setAuthStatus({ chatgpt: true });
    } catch {
      setAuthStatus({ chatgpt: false });
    }

    try {
      await getClaudeOrgUuid();
      setAuthStatus({ claude: true });
    } catch {
      setAuthStatus({ claude: false });
    }

    try {
      await getGeminiRequestParams();
      setAuthStatus({ gemini: true });
    } catch {
      setAuthStatus({ gemini: false });
    }

    try {
      const configured = await isXaiConfigured();
      setAuthStatus({ xai: configured });
    } catch {
      setAuthStatus({ xai: false });
    }
  }, [setAuthStatus]);

  useEffect(() => {
    const checkAuth = isServerMode() ? checkAuthViaServer : checkAuthDirect;

    // Initial check
    checkAuth();

    // Poll every 30 seconds in server mode
    if (isServerMode()) {
      const interval = setInterval(checkAuth, 30000);

      // Pause polling when page is hidden
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          checkAuth();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [checkAuthViaServer, checkAuthDirect]);
}
