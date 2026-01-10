import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isLoading: boolean;
}

/**
 * Hook to monitor network connectivity status
 * Uses a simple fetch-based approach to detect online/offline state
 * This avoids requiring native modules like expo-network
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true); // Assume online initially
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkNetwork = async () => {
      try {
        // Try to fetch a small resource to check connectivity
        // Using Google's generate_204 endpoint which returns empty 204 response
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (mounted) {
          setIsOnline(response.ok || response.status === 204);
          setIsLoading(false);
        }
      } catch (error) {
        // Network error means offline
        if (mounted) {
          setIsOnline(false);
          setIsLoading(false);
        }
      }
    };

    // Initial check
    checkNetwork();

    // Set up polling interval (every 30 seconds - less frequent to avoid battery drain)
    const interval = setInterval(checkNetwork, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { isOnline, isLoading };
}
