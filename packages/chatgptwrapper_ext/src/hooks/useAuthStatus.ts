import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { getAccessToken } from '../services/chatgpt';
import { getClaudeOrgUuid } from '../services/claude';
import { getGeminiRequestParams } from '../services/gemini';

export function useAuthStatus() {
  const setAuthStatus = useAppStore((state) => state.setAuthStatus);

  useEffect(() => {
    async function checkAuth() {
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
    }

    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
