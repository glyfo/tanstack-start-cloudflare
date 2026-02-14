/**
 * useConnections Hook
 *
 * React hook for managing social media connection state.
 * Handles fetching connections, initiating OAuth, and managing connection lifecycle.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  SocialConnection,
  SocialPlatform,
  ConnectionsState,
} from '@/types/social-connections';
import { buildBackendUrl } from '@/lib/backend-url';

interface UseConnectionsOptions {
  autoFetch?: boolean;
  pollInterval?: number;
  /** Organization ID for multi-tenant context */
  orgId?: string;
  /** User ID for multi-tenant context */
  userId?: string;
}

interface UseConnectionsReturn extends ConnectionsState {
  fetchConnections: () => Promise<void>;
  connect: (platform: SocialPlatform) => void;
  disconnect: (platform: SocialPlatform) => Promise<void>;
  refresh: (platform: SocialPlatform) => Promise<void>;
  getConnection: (platform: SocialPlatform) => SocialConnection | undefined;
  isConnected: (platform: SocialPlatform) => boolean;
  getExpiryWarning: (platform: SocialPlatform) => { warning: boolean; daysLeft: number } | null;
}

const EXPIRY_WARNING_DAYS = 7;

export function useConnections(options: UseConnectionsOptions = {}): UseConnectionsReturn {
  const { autoFetch = true, pollInterval, orgId, userId } = options;

  /**
   * Build headers with tenant context
   */
  const getTenantHeaders = (): HeadersInit => {
    const headers: HeadersInit = {};
    if (orgId) {
      headers['X-Org-ID'] = orgId;
    }
    if (userId) {
      headers['X-User-ID'] = userId;
    }
    return headers;
  };

  const [state, setState] = useState<ConnectionsState>({
    connections: [],
    loading: false,
    error: undefined,
    connecting: undefined,
    disconnecting: undefined,
    refreshing: undefined,
  });

  /**
   * Fetch all connections from the API
   */
  const fetchConnections = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      const response = await fetch(buildBackendUrl('/api/connections'), {
        headers: getTenantHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }

      const data = (await response.json()) as { connections?: SocialConnection[] };
      setState((prev) => ({
        ...prev,
        connections: data.connections || [],
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [orgId, userId]);

  /**
   * Initiate OAuth flow for a platform
   */
  const connect = useCallback((platform: SocialPlatform) => {
    setState((prev) => ({ ...prev, connecting: platform }));

    // Redirect to OAuth start endpoint
    const currentUrl = window.location.href;
    const redirectUrl = buildBackendUrl(
      `/api/oauth/${platform}/start?redirect=${encodeURIComponent(currentUrl)}`
    );
    window.location.href = redirectUrl;
  }, []);

  /**
   * Disconnect a platform
   */
  const disconnect = useCallback(
    async (platform: SocialPlatform) => {
      setState((prev) => ({ ...prev, disconnecting: platform }));

      try {
        const response = await fetch(buildBackendUrl(`/api/connections/${platform}`), {
          method: 'DELETE',
          headers: getTenantHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to disconnect');
        }

        // Remove from local state
        setState((prev) => ({
          ...prev,
          connections: prev.connections.filter((c) => c.platform !== platform),
          disconnecting: undefined,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          disconnecting: undefined,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },
    [orgId, userId]
  );

  /**
   * Refresh token for a platform
   */
  const refresh = useCallback(
    async (platform: SocialPlatform) => {
      setState((prev) => ({ ...prev, refreshing: platform }));

      try {
        const response = await fetch(buildBackendUrl(`/api/connections/${platform}/refresh`), {
          method: 'POST',
          headers: getTenantHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        const data = (await response.json()) as { expiresAt?: number };

        // Update local state with new expiry
        setState((prev) => ({
          ...prev,
          connections: prev.connections.map((c) =>
            c.platform === platform ? { ...c, expiresAt: data.expiresAt, status: 'active' as const } : c
          ),
          refreshing: undefined,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          refreshing: undefined,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    },
    [orgId, userId]
  );

  /**
   * Get a specific connection
   */
  const getConnection = useCallback(
    (platform: SocialPlatform): SocialConnection | undefined => {
      return state.connections.find((c) => c.platform === platform);
    },
    [state.connections]
  );

  /**
   * Check if a platform is connected
   */
  const isConnected = useCallback(
    (platform: SocialPlatform): boolean => {
      const connection = getConnection(platform);
      return connection?.status === 'active';
    },
    [getConnection]
  );

  /**
   * Get expiry warning for a connection
   */
  const getExpiryWarning = useCallback(
    (platform: SocialPlatform): { warning: boolean; daysLeft: number } | null => {
      const connection = getConnection(platform);
      if (!connection?.expiresAt) return null;

      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = connection.expiresAt - now;
      const daysLeft = Math.ceil(secondsLeft / (24 * 60 * 60));

      return {
        warning: daysLeft <= EXPIRY_WARNING_DAYS,
        daysLeft,
      };
    },
    [getConnection]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchConnections();
    }
  }, [autoFetch, fetchConnections]);

  // Poll for updates if interval is set
  useEffect(() => {
    if (!pollInterval) return;

    const interval = setInterval(fetchConnections, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval, fetchConnections]);

  // Handle OAuth callback (check URL for success/error params)
  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthSuccess = url.searchParams.get('oauth_success');
    const oauthError = url.searchParams.get('oauth_error');
    const oauthPlatform = url.searchParams.get('oauth_platform');

    if (oauthSuccess === 'true' && oauthPlatform) {
      // Clear the URL params and refresh connections
      url.searchParams.delete('oauth_success');
      url.searchParams.delete('oauth_platform');
      window.history.replaceState({}, '', url.toString());
      fetchConnections();
    } else if (oauthError && oauthPlatform) {
      // Clear the URL params and show error
      url.searchParams.delete('oauth_error');
      url.searchParams.delete('oauth_platform');
      window.history.replaceState({}, '', url.toString());
      setState((prev) => ({
        ...prev,
        error: `Failed to connect ${oauthPlatform}: ${oauthError}`,
        connecting: undefined,
      }));
    }
  }, [fetchConnections]);

  return {
    ...state,
    fetchConnections,
    connect,
    disconnect,
    refresh,
    getConnection,
    isConnected,
    getExpiryWarning,
  };
}
