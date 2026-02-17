/**
 * Analytics Dashboard Component
 *
 * Displays comprehensive analytics for the multi-channel CRM:
 * - Channel message volume
 * - Customer engagement metrics
 * - Conversation statistics
 * - Response time analytics
 */

import { useEffect, useState } from 'react';
import { TrendingUp, MessageSquare, Users, Clock, BarChart3 } from 'lucide-react';
import { buildBackendUrl } from '@/lib/backend-url';

interface ChannelStats {
  channel: string;
  messageCount: number;
  activeConversations: number;
  avgResponseTime?: number;
}

interface AnalyticsData {
  totalMessages: number;
  totalCustomers: number;
  activeConversations: number;
  avgResponseTime: number;
  channelStats: ChannelStats[];
  messagesByHour: Array<{ hour: number; count: number }>;
  topCustomers: Array<{ id: string; name: string; messageCount: number }>;
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildBackendUrl(`/api/analytics?range=${timeRange}`)
      );
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">No analytics data available</p>
      </div>
    );
  }

  const channelColors: Record<string, string> = {
    websocket: 'bg-sky-500',
    whatsapp: 'bg-green-500',
    sms: 'bg-blue-500',
    slack: 'bg-purple-500',
    discord: 'bg-indigo-500',
    telegram: 'bg-cyan-500',
    email: 'bg-red-500',
  };

  const maxMessages = Math.max(...analytics.channelStats.map(c => c.messageCount), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Analytics Dashboard</h1>
          <p className="text-sm text-stone-500 mt-1">Multi-channel conversation metrics</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-stone-200">
          {(['24h', '7d', '30d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-sky-500 text-white'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {range === '24h' ? 'Last 24h' : range === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="w-5 h-5 text-sky-500" />
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-stone-900">
            {analytics.totalMessages.toLocaleString()}
          </div>
          <div className="text-sm text-stone-500 mt-1">Total Messages</div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-stone-900">
            {analytics.totalCustomers.toLocaleString()}
          </div>
          <div className="text-sm text-stone-500 mt-1">Total Customers</div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-stone-900">
            {analytics.activeConversations}
          </div>
          <div className="text-sm text-stone-500 mt-1">Active Conversations</div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-stone-900">
            {analytics.avgResponseTime.toFixed(1)}s
          </div>
          <div className="text-sm text-stone-500 mt-1">Avg Response Time</div>
        </div>
      </div>

      {/* Channel Breakdown */}
      <div className="bg-white rounded-xl p-6 border border-stone-200">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          Messages by Channel
        </h2>
        <div className="space-y-4">
          {analytics.channelStats.map(stat => {
            const percentage = (stat.messageCount / maxMessages) * 100;
            return (
              <div key={stat.channel}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${channelColors[stat.channel] || 'bg-stone-400'}`} />
                    <span className="text-sm font-medium text-stone-900 capitalize">
                      {stat.channel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-stone-500">
                      {stat.activeConversations} active
                    </span>
                    <span className="font-semibold text-stone-900">
                      {stat.messageCount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${channelColors[stat.channel] || 'bg-stone-400'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Activity Timeline */}
      {analytics.messagesByHour && analytics.messagesByHour.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Message Activity (Last 24h)
          </h2>
          <div className="flex items-end justify-between h-40 gap-2">
            {analytics.messagesByHour.map(({ hour, count }) => {
              const maxCount = Math.max(...analytics.messagesByHour.map(h => h.count), 1);
              const height = (count / maxCount) * 100;
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center" style={{ height: '8rem' }}>
                    <div
                      className="w-full bg-sky-500 rounded-t hover:bg-sky-600 transition-colors cursor-pointer relative group"
                      style={{ height: `${height}%` }}
                      title={`${hour}:00 - ${count} messages`}
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {count} msgs
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-stone-400">{hour}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Customers */}
      {analytics.topCustomers && analytics.topCustomers.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Top Customers by Activity
          </h2>
          <div className="space-y-3">
            {analytics.topCustomers.slice(0, 5).map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium text-stone-900">
                    {customer.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-stone-500">
                  {customer.messageCount} messages
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
