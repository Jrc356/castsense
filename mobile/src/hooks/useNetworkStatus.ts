/**
 * useNetworkStatus Hook
 * 
 * Monitors network connectivity status using @react-native-community/netinfo
 * Provides callbacks for network state changes
 */

import {useState, useEffect, useCallback, useRef} from 'react';
import NetInfo, {
  type NetInfoState,
  type NetInfoSubscription,
} from '@react-native-community/netinfo';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkStatus {
  /** Whether the device has an active network connection */
  isConnected: boolean;
  /** Whether the internet is reachable (network may be connected but offline) */
  isInternetReachable: boolean | null;
  /** The type of connection (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Whether we're currently checking network status */
  isChecking: boolean;
}

export interface UseNetworkStatusOptions {
  /** Callback fired when network is restored (goes from offline to online) */
  onNetworkRestored?: () => void;
  /** Callback fired when network is lost */
  onNetworkLost?: () => void;
  /** Whether to automatically refresh on mount */
  refreshOnMount?: boolean;
}

export interface UseNetworkStatusResult extends NetworkStatus {
  /** Manually refresh the network status */
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): UseNetworkStatusResult {
  const {
    onNetworkRestored,
    onNetworkLost,
    refreshOnMount = true,
  } = options;

  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true, // Assume connected initially
    isInternetReachable: null,
    connectionType: null,
    isChecking: true,
  });

  // Track previous state for detecting transitions
  const wasConnectedRef = useRef<boolean | null>(null);
  const callbacksRef = useRef({ onNetworkRestored, onNetworkLost });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onNetworkRestored, onNetworkLost };
  }, [onNetworkRestored, onNetworkLost]);

  // Handle network state update
  const handleNetworkState = useCallback((state: NetInfoState) => {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable;

    // Determine if truly online (connected AND internet reachable)
    // isInternetReachable can be null when unknown, so treat as connected
    const isOnline = isConnected && (isInternetReachable !== false);
    const wasOnline = wasConnectedRef.current;

    setStatus({
      isConnected,
      isInternetReachable,
      connectionType: state.type,
      isChecking: false,
    });

    // Fire callbacks on state transitions
    if (wasOnline !== null) {
      if (!wasOnline && isOnline) {
        // Network restored
        callbacksRef.current.onNetworkRestored?.();
      } else if (wasOnline && !isOnline) {
        // Network lost
        callbacksRef.current.onNetworkLost?.();
      }
    }

    wasConnectedRef.current = isOnline;
  }, []);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setStatus(prev => ({ ...prev, isChecking: true }));
    try {
      const state = await NetInfo.fetch();
      handleNetworkState(state);
    } catch {
      setStatus(prev => ({
        ...prev,
        isChecking: false,
      }));
    }
  }, [handleNetworkState]);

  // Subscribe to network state changes
  useEffect(() => {
    let subscription: NetInfoSubscription | null = null;

    // Initial fetch
    if (refreshOnMount) {
      NetInfo.fetch().then(handleNetworkState);
    }

    // Subscribe to changes
    subscription = NetInfo.addEventListener(handleNetworkState);

    return () => {
      subscription?.();
    };
  }, [handleNetworkState, refreshOnMount]);

  return {
    ...status,
    refresh,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-shot check if network is available
 */
export async function checkNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return (state.isConnected ?? false) && (state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Wait for network to become available
 * @param timeoutMs Maximum time to wait (default 30s)
 * @returns Promise that resolves when network is available, or rejects on timeout
 */
export function waitForNetwork(timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    let subscription: NetInfoSubscription | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      subscription?.();
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Check current state first
    NetInfo.fetch().then(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        cleanup();
        resolve();
        return;
      }

      // Set up listener for network restoration
      subscription = NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable !== false) {
          cleanup();
          resolve();
        }
      });

      // Set timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Network wait timeout'));
      }, timeoutMs);
    });
  });
}

export default useNetworkStatus;
