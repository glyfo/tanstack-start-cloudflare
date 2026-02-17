/**
 * Customer Profile View - 360° Customer View
 *
 * Shows unified customer profile with all channel identities,
 * activity timeline, and cross-channel conversation history.
 */

import { useState, useEffect } from 'react';
import {
  User, Mail, Phone, MessageCircle, Slack, MessageSquare,
  Send, Wifi, Calendar, Tag, Link2, TrendingUp, Activity
} from 'lucide-react';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';

// ============================================================================
// Types
// ============================================================================

interface ChannelIdentity {
  id: string;
  channelType: string;
  identifier: string;
  displayName?: string;
  verified: boolean;
  isPrimary: boolean;
  messageCount: number;
  lastSeenAt: number;
  firstSeenAt: number;
}

interface CustomerProfile {
  customerId: string;
  orgId: string;
  primaryEmail?: string;
  primaryPhone?: string;
  displayName?: string;
  contactId?: string;

  identities: ChannelIdentity[];

  tags?: string[];
  customFields?: Record<string, any>;

  totalMessages: number;
  firstContactAt: number;
  lastActivityAt: number;
  channelActivity: Record<string, number>;

  merged: boolean;
  mergedInto?: string;
}

// ============================================================================
// Customer Profile View Component
// ============================================================================

export function CustomerProfileView({ customerId }: { customerId: string }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'identities'>('overview');

  useEffect(() => {
    loadCustomerProfile();
  }, [customerId]);

  const loadCustomerProfile = async () => {
    try {
      const response = await fetch(`/api/customer-identity/customer?customerId=${customerId}`);
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error loading customer profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Customer not found</p>
      </div>
    );
  }

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          {/* Customer Info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              {profile.displayName?.[0]?.toUpperCase() || '?'}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-stone-900">
                {profile.displayName || 'Unknown Customer'}
              </h1>

              <div className="flex items-center gap-4 mt-2 text-sm text-stone-600">
                {profile.primaryEmail && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {profile.primaryEmail}
                  </div>
                )}
                {profile.primaryPhone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {profile.primaryPhone}
                  </div>
                )}
              </div>

              {/* Tags */}
              {profile.tags && profile.tags.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {profile.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-sky-50 text-sky-700 text-xs rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-900">
                {profile.identities.length}
              </div>
              <div className="text-xs text-stone-500">Channels</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-900">
                {profile.totalMessages}
              </div>
              <div className="text-xs text-stone-500">Messages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-900">
                {getDaysSinceFirstContact(profile.firstContactAt)}d
              </div>
              <div className="text-xs text-stone-500">Customer</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="border-b border-stone-200 px-6">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'timeline', label: 'Activity Timeline', icon: Activity },
              { id: 'identities', label: 'Channel Identities', icon: Link2 },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm
                    transition-colors
                    ${activeTab === tab.id
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab profile={profile} getChannelIcon={getChannelIcon} />
          )}

          {activeTab === 'timeline' && (
            <UnifiedActivityTimeline customerId={profile.customerId} />
          )}

          {activeTab === 'identities' && (
            <IdentitiesTab profile={profile} getChannelIcon={getChannelIcon} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({
  profile,
  getChannelIcon
}: {
  profile: CustomerProfile;
  getChannelIcon: (type: string) => any;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Channel Activity */}
      <div className="space-y-3">
        <h3 className="font-semibold text-stone-900">Channel Activity</h3>

        {Object.entries(profile.channelActivity)
          .sort(([, a], [, b]) => b - a)
          .map(([channel, count]) => {
            const Icon = getChannelIcon(channel);
            const percentage = (count / profile.totalMessages) * 100;

            return (
              <div key={channel} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-sky-500" />
                    <span className="text-stone-700 capitalize">{channel}</span>
                  </div>
                  <span className="font-semibold text-stone-900">{count} messages</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Custom Fields */}
      {profile.customFields && Object.keys(profile.customFields).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-stone-900">Custom Fields</h3>

          <div className="space-y-2">
            {Object.entries(profile.customFields).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-stone-500">{key}:</span>
                <span className="font-medium text-stone-900">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Stats */}
      <div className="lg:col-span-2 grid grid-cols-3 gap-4 pt-4 border-t border-stone-200">
        <div className="text-center p-4 bg-stone-50 rounded-lg">
          <Calendar className="w-5 h-5 text-stone-400 mx-auto mb-2" />
          <div className="text-sm text-stone-500">First Contact</div>
          <div className="text-lg font-semibold text-stone-900 mt-1">
            {new Date(profile.firstContactAt).toLocaleDateString()}
          </div>
        </div>

        <div className="text-center p-4 bg-stone-50 rounded-lg">
          <Activity className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm text-stone-500">Last Activity</div>
          <div className="text-lg font-semibold text-stone-900 mt-1">
            {formatRelativeTime(profile.lastActivityAt)}
          </div>
        </div>

        <div className="text-center p-4 bg-stone-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-sky-500 mx-auto mb-2" />
          <div className="text-sm text-stone-500">Total Messages</div>
          <div className="text-lg font-semibold text-stone-900 mt-1">
            {profile.totalMessages}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Identities Tab
// ============================================================================

function IdentitiesTab({
  profile,
  getChannelIcon
}: {
  profile: CustomerProfile;
  getChannelIcon: (type: string) => any;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">
          Linked Identities ({profile.identities.length})
        </h3>
        <button className="text-sm text-sky-600 hover:text-sky-700 font-medium">
          + Link New Identity
        </button>
      </div>

      <div className="space-y-2">
        {profile.identities.map(identity => {
          const Icon = getChannelIcon(identity.channelType);

          return (
            <div
              key={identity.id}
              className="flex items-center justify-between p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-sky-500" />

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900 capitalize">
                      {identity.channelType}
                    </span>

                    {identity.isPrimary && (
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded font-medium">
                        Primary
                      </span>
                    )}

                    {identity.verified && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-medium">
                        Verified
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-stone-600 mt-0.5">
                    {identity.identifier}
                    {identity.displayName && ` • ${identity.displayName}`}
                  </div>
                </div>
              </div>

              <div className="text-right text-sm">
                <div className="font-semibold text-stone-900">
                  {identity.messageCount} messages
                </div>
                <div className="text-xs text-stone-500">
                  Last seen {formatRelativeTime(identity.lastSeenAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDaysSinceFirstContact(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
