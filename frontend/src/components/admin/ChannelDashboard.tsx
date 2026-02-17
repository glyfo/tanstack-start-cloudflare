/**
 * Channel Dashboard - Overview of all communication channels
 *
 * Shows health status, message counts, active sessions for all 7 channels:
 * WebSocket, WhatsApp, SMS, Slack, Discord, Telegram, Email
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare, Mail, Send, Slack, MessageCircle,
  Phone, Wifi, WifiOff, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ChannelStats {
  channelType: string;
  enabled: boolean;
  messagesInbound: number;
  messagesOutbound: number;
  activeSessions: number;
  totalSessions: number;
  errorCount: number;
  lastError?: string;
  lastActivity?: number;
}

interface ChannelHealth {
  channelType: string;
  status: 'healthy' | 'degraded' | 'down' | 'unconfigured';
  responseTime?: number;
  uptime?: number;
}

// ============================================================================
// Channel Dashboard Component
// ============================================================================

export function ChannelDashboard() {
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([]);
  const [channelHealth, setChannelHealth] = useState<ChannelHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  useEffect(() => {
    loadChannelData();
    const interval = setInterval(loadChannelData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadChannelData = async () => {
    try {
      // Load stats for all channels
      const stats = await fetchChannelStats();
      setChannelStats(stats);

      // Load health status
      const health = await fetchChannelHealth();
      setChannelHealth(health);
    } catch (error) {
      console.error('Error loading channel data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channelType: string) => {
    const icons: Record<string, any> = {
      websocket: Wifi,
      whatsapp: MessageCircle,
      sms: Send,
      slack: Slack,
      discord: MessageSquare,
      telegram: MessageSquare,
      email: Mail,
    };
    return icons[channelType] || MessageSquare;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: 'text-emerald-500 bg-emerald-50',
      degraded: 'text-amber-500 bg-amber-50',
      down: 'text-red-500 bg-red-50',
      unconfigured: 'text-stone-400 bg-stone-50',
    };
    return colors[status] || colors.unconfigured;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      healthy: CheckCircle2,
      degraded: AlertCircle,
      down: WifiOff,
      unconfigured: Clock,
    };
    return icons[status] || Clock;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const totalMessages = channelStats.reduce((sum, ch) =>
    sum + ch.messagesInbound + ch.messagesOutbound, 0
  );
  const totalSessions = channelStats.reduce((sum, ch) => sum + ch.activeSessions, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Channel Dashboard</h1>
          <p className="text-sm text-stone-500 mt-1">
            Monitor all communication channels in real-time
          </p>
        </div>

        {/* Summary Stats */}
        <div className="flex gap-4">
          <div className="bg-white rounded-lg border border-stone-200 px-4 py-3">
            <div className="text-2xl font-bold text-stone-900">{totalMessages.toLocaleString()}</div>
            <div className="text-xs text-stone-500">Total Messages</div>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 px-4 py-3">
            <div className="text-2xl font-bold text-stone-900">{totalSessions}</div>
            <div className="text-xs text-stone-500">Active Sessions</div>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 px-4 py-3">
            <div className="text-2xl font-bold text-emerald-600">
              {channelHealth.filter(h => h.status === 'healthy').length}
            </div>
            <div className="text-xs text-stone-500">Healthy Channels</div>
          </div>
        </div>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {channelStats.map((channel) => {
          const health = channelHealth.find(h => h.channelType === channel.channelType);
          const Icon = getChannelIcon(channel.channelType);
          const StatusIcon = getStatusIcon(health?.status || 'unconfigured');

          return (
            <div
              key={channel.channelType}
              onClick={() => setSelectedChannel(channel.channelType)}
              className={`
                bg-white rounded-xl border-2 shadow-sm cursor-pointer transition-all
                hover:shadow-md hover:-translate-y-0.5
                ${selectedChannel === channel.channelType
                  ? 'border-sky-500 shadow-lg'
                  : 'border-stone-200'
                }
              `}
            >
              {/* Header */}
              <div className="p-4 border-b border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-sky-500" />
                    <span className="font-semibold text-stone-900 capitalize">
                      {channel.channelType}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className={`
                    flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                    ${getStatusColor(health?.status || 'unconfigured')}
                  `}>
                    <StatusIcon className="w-3 h-3" />
                    <span className="capitalize">{health?.status || 'N/A'}</span>
                  </div>
                </div>

                {/* Enabled/Disabled */}
                {!channel.enabled && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    ⚠️ Disabled
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="p-4 space-y-3">
                {/* Message Counts */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-stone-500">Inbound</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {channel.messagesInbound.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500">Outbound</div>
                    <div className="text-lg font-bold text-sky-600">
                      {channel.messagesOutbound.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Sessions */}
                <div className="pt-2 border-t border-stone-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Active Sessions</span>
                    <span className="font-semibold text-stone-900">
                      {channel.activeSessions}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-stone-500">Total Sessions</span>
                    <span className="font-semibold text-stone-900">
                      {channel.totalSessions}
                    </span>
                  </div>
                </div>

                {/* Errors */}
                {channel.errorCount > 0 && (
                  <div className="pt-2 border-t border-stone-100">
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>{channel.errorCount} errors</span>
                    </div>
                    {channel.lastError && (
                      <div className="text-xs text-stone-500 mt-1 truncate">
                        {channel.lastError}
                      </div>
                    )}
                  </div>
                )}

                {/* Last Activity */}
                {channel.lastActivity && (
                  <div className="text-xs text-stone-400">
                    Last activity: {formatRelativeTime(channel.lastActivity)}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-3 bg-stone-50 border-t border-stone-100 rounded-b-xl">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/admin/channels/${channel.channelType}`;
                  }}
                  className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                >
                  View Details →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Channel Details */}
      {selectedChannel && (
        <ChannelDetailsPanel
          channelType={selectedChannel}
          onClose={() => setSelectedChannel(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Channel Details Panel
// ============================================================================

function ChannelDetailsPanel({
  channelType,
  onClose
}: {
  channelType: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-900 capitalize">
              {channelType} Channel Details
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-stone-500">
            Detailed analytics and configuration for {channelType} channel.
          </p>
          {/* TODO: Add detailed stats, configuration, recent messages, etc. */}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchChannelStats(): Promise<ChannelStats[]> {
  try {
    const response = await fetch('/api/channel-stats');
    if (!response.ok) {
      throw new Error('Failed to fetch channel stats');
    }
    const data = await response.json();
    return data.channels || [];
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    return [];
  }
}

async function fetchChannelHealth(): Promise<ChannelHealth[]> {
  try {
    const response = await fetch('/api/channel-health');
    if (!response.ok) {
      throw new Error('Failed to fetch channel health');
    }
    const data = await response.json();
    return data.health || [];
  } catch (error) {
    console.error('Error fetching channel health:', error);
    return [];
  }
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
