/**
 * Analytics Card Component
 *
 * Simple analytics display for chat interface
 * Shows key metrics in a clean, readable format
 */

import { StatusBadge } from './shared';

type LeadSource = 'tiktok' | 'facebook' | 'whatsapp' | 'instagram';

export interface AnalyticsData {
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  bySource?: {
    tiktok: { total: number; qualified: number };
    facebook: { total: number; qualified: number };
    whatsapp: { total: number; qualified: number };
  };
  topCampaigns?: Array<{
    name: string;
    source: LeadSource;
    leadCount: number;
    conversionRate: number;
  }>;
}

interface AnalyticsCardProps {
  data: AnalyticsData;
  title?: string;
  period?: string;
}

export function AnalyticsCard({
  data,
  title = 'Lead Analytics',
  period = 'Last 7 days',
}: AnalyticsCardProps) {
  const getSourceIcon = (source: LeadSource): string => {
    const icons: Record<LeadSource, string> = {
      tiktok: '▶',
      facebook: 'f',
      whatsapp: '💬',
      instagram: '📷',
    };
    return icons[source];
  };

  const getSourceColor = (source: LeadSource): string => {
    const colors: Record<LeadSource, string> = {
      tiktok: 'bg-black text-white',
      facebook: 'bg-blue-600 text-white',
      whatsapp: 'bg-green-600 text-white',
      instagram: 'bg-gradient-to-r from-purple-600 to-pink-500 text-white',
    };
    return colors[source];
  };

  return (
    <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-stone-50 px-4 py-3 border-b border-stone-200">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        <p className="text-xs text-stone-500 mt-0.5">{period}</p>
      </div>

      {/* Main Stats */}
      <div className="p-4 space-y-4">
        {/* Primary Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900">
              {data.totalLeads}
            </div>
            <div className="text-xs text-stone-500 mt-1">Total Leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {data.qualifiedLeads}
            </div>
            <div className="text-xs text-stone-500 mt-1">Qualified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.conversionRate}%
            </div>
            <div className="text-xs text-stone-500 mt-1">Conv. Rate</div>
          </div>
        </div>

        {/* By Source */}
        {data.bySource && (
          <div>
            <div className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-2">
              By Platform
            </div>
            <div className="space-y-2">
              {Object.entries(data.bySource).map(([source, stats]) => {
                const conversionRate =
                  stats.total > 0
                    ? Math.round((stats.qualified / stats.total) * 100)
                    : 0;

                return (
                  <div
                    key={source}
                    className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs ${getSourceColor(source as LeadSource)}`}
                      >
                        {getSourceIcon(source as LeadSource)}
                      </div>
                      <span className="text-sm text-stone-700 capitalize">
                        {source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-stone-900 font-semibold">
                        {stats.total}
                      </span>
                      <span className="text-stone-500">
                        {stats.qualified} qualified
                      </span>
                      <span
                        className={`font-semibold ${
                          conversionRate >= 50
                            ? 'text-green-600'
                            : conversionRate >= 30
                            ? 'text-orange-600'
                            : 'text-stone-600'
                        }`}
                      >
                        {conversionRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Campaigns */}
        {data.topCampaigns && data.topCampaigns.length > 0 && (
          <div>
            <div className="text-xs font-medium text-stone-700 uppercase tracking-wider mb-2">
              Top Campaigns
            </div>
            <div className="space-y-2">
              {data.topCampaigns.slice(0, 3).map((campaign, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${getSourceColor(campaign.source)}`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-sm text-stone-700 truncate">
                      {campaign.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    <span className="text-stone-900 font-semibold">
                      {campaign.leadCount}
                    </span>
                    <span className="text-green-600 font-semibold">
                      {campaign.conversionRate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mini Analytics Badge - Compact version for inline display
 */
interface MiniAnalyticsBadgeProps {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'red' | 'gray';
}

export function MiniAnalyticsBadge({
  label,
  value,
  trend,
  color = 'gray',
}: MiniAnalyticsBadgeProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-stone-50 text-stone-700 border-stone-200',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${colorStyles[color]}`}
    >
      <span className="text-xs font-medium uppercase tracking-wider opacity-75">
        {label}
      </span>
      <span className="text-sm font-bold">{value}</span>
      {trend && (
        <span className="text-xs opacity-75">{trendIcons[trend]}</span>
      )}
    </div>
  );
}
