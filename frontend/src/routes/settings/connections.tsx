/**
 * Social Connections Page
 *
 * Main page for managing social media OAuth connections.
 */

import { createFileRoute } from '@tanstack/react-router';
import { PLATFORM_CONFIGS, type SocialPlatform } from '@/types/social-connections';
import { useConnections } from '@/hooks/useConnections';
import { ConnectionCard } from '@/components/settings/ConnectionCard';

export const Route = createFileRoute('/settings/connections')({
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const {
    connections,
    loading,
    error,
    connecting,
    disconnecting,
    refreshing,
    connect,
    disconnect,
    refresh,
  } = useConnections();

  const platforms = Object.keys(PLATFORM_CONFIGS) as SocialPlatform[];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Connections</h1>
        <p className="text-sm text-stone-500 mt-1">Connect your social media accounts to receive leads automatically.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && connections.length === 0 && (
        <div className="flex items-center justify-center py-16 text-sm text-stone-400">
          <svg className="w-5 h-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading connections...
        </div>
      )}

      {/* Connection Cards */}
      <div className="space-y-3">
        {platforms.map((platform) => {
          const connection = connections.find((c) => c.platform === platform);
          const config = PLATFORM_CONFIGS[platform];

          return (
            <ConnectionCard
              key={platform}
              platform={platform}
              config={config}
              connection={connection}
              onConnect={connect}
              onDisconnect={disconnect}
              onRefresh={refresh}
              isConnecting={connecting === platform}
              isDisconnecting={disconnecting === platform}
              isRefreshing={refreshing === platform}
            />
          );
        })}
      </div>

      {/* Security footer */}
      <div className="mt-8 flex items-center gap-2 text-stone-400">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-xs">All tokens are encrypted with AES-256-GCM. We never store passwords.</p>
      </div>
    </div>
  );
}
