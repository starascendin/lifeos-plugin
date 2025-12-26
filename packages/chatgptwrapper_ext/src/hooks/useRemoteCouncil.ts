/**
 * React hook to initialize and manage the remote council WebSocket connection.
 * Call this hook at the app root level to enable remote council execution.
 *
 * IMPORTANT: Only connects if the council server is running.
 * This prevents blocking the main app when server isn't available.
 */

import { useEffect, useState } from 'react';
import { remoteCouncilClient } from '../services/remoteCouncil';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'server_unavailable';

interface RemoteCouncilOptions {
  serverUrl?: string;
  enabled?: boolean;
}

interface RemoteCouncilState {
  status: ConnectionStatus;
  isConnected: boolean;
}

const DEFAULT_SERVER_URL = 'ws://localhost:3456/ws';
const HEALTH_CHECK_URL = 'http://localhost:3456/health';

export function useRemoteCouncil(options: RemoteCouncilOptions = {}): RemoteCouncilState {
  const { serverUrl = DEFAULT_SERVER_URL, enabled = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    // Skip connection entirely if not enabled (e.g., in server/browser mode)
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    let mounted = true;

    // Set up status callback
    remoteCouncilClient.onStatusChange((newStatus) => {
      if (mounted) {
        setStatus(newStatus);
      }
    });

    // Check if server is available before attempting WebSocket connection
    const checkAndConnect = async () => {
      try {
        const response = await fetch(HEALTH_CHECK_URL, {
          method: 'GET',
          // Short timeout to avoid blocking
          signal: AbortSignal.timeout(2000)
        });

        if (response.ok && mounted) {
          console.log('[RemoteCouncil] Server available, connecting...');
          remoteCouncilClient.connect(serverUrl);
        } else if (mounted) {
          console.log('[RemoteCouncil] Server not healthy, skipping connection');
          setStatus('server_unavailable');
        }
      } catch {
        // Server not running - this is normal, just skip silently
        if (mounted) {
          console.log('[RemoteCouncil] Server not available, skipping connection');
          setStatus('server_unavailable');
        }
      }
    };

    checkAndConnect();

    // Cleanup on unmount
    return () => {
      mounted = false;
      remoteCouncilClient.disconnect();
    };
  }, [serverUrl, enabled]);

  return {
    status,
    isConnected: status === 'connected'
  };
}
