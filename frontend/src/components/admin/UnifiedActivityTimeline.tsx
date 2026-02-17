/**
 * Unified Activity Timeline
 *
 * Shows chronological conversation history across ALL channels
 * for a specific customer, enabling true 360° view.
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare, Mail, Send, Slack, MessageCircle,
  Phone, Wifi, Filter, Search, Calendar
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface UnifiedMessage {
  messageId: string;
  customerId: string;
  channelType: string;
  sessionKey: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Unified Activity Timeline Component
// ============================================================================

export function UnifiedActivityTimeline({ customerId }: { customerId: string }) {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all'); // 'all' or specific channel
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadMessages();
  }, [customerId, filter, dateRange]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/customer-identity/messages?customerId=${customerId}&limit=100`
      );
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
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

  const getChannelColor = (channelType: string): string => {
    const colors: Record<string, string> = {
      websocket: 'bg-sky-500',
      whatsapp: 'bg-emerald-500',
      sms: 'bg-purple-500',
      slack: 'bg-violet-500',
      discord: 'bg-indigo-500',
      telegram: 'bg-blue-500',
      email: 'bg-amber-500',
    };
    return colors[channelType] || 'bg-stone-500';
  };

  // Filter and search messages
  const filteredMessages = messages.filter(msg => {
    // Channel filter
    if (filter !== 'all' && msg.channelType !== filter) {
      return false;
    }

    // Search filter
    if (searchQuery && !msg.content.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Date range filter
    const daysAgo = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': Infinity
    }[dateRange];

    const cutoffDate = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
    if (msg.timestamp < cutoffDate) {
      return false;
    }

    return true;
  });

  // Group messages by date
  const messagesByDate: Record<string, UnifiedMessage[]> = {};
  filteredMessages.forEach(msg => {
    const date = new Date(msg.timestamp).toLocaleDateString();
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(msg);
  });

  // Get unique channels from messages
  const activeChannels = [...new Set(messages.map(m => m.channelType))];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Channel Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Channels</option>
            {activeChannels.map(channel => (
              <option key={channel} value={channel} className="capitalize">
                {channel}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Results Count */}
        <div className="text-sm text-stone-500">
          {filteredMessages.length} messages
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">No messages found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(messagesByDate)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, dateMessages]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-stone-200"></div>
                  <div className="text-sm font-semibold text-stone-600">{date}</div>
                  <div className="flex-1 h-px bg-stone-200"></div>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {dateMessages
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map(message => {
                      const Icon = getChannelIcon(message.channelType);
                      const channelColor = getChannelColor(message.channelType);

                      return (
                        <div
                          key={message.messageId}
                          className="flex gap-3 items-start hover:bg-stone-50 p-3 rounded-lg transition-colors"
                        >
                          {/* Timeline Dot */}
                          <div className="flex flex-col items-center pt-1">
                            <div className={`w-8 h-8 rounded-full ${channelColor} flex items-center justify-center`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="w-px h-full bg-stone-200 mt-2"></div>
                          </div>

                          {/* Message Content */}
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-stone-900 uppercase">
                                {message.channelType}
                              </span>
                              <span className="text-xs text-stone-400">•</span>
                              <span className={`text-xs font-medium ${
                                message.role === 'user' ? 'text-sky-600' : 'text-purple-600'
                              }`}>
                                {message.role === 'user' ? 'Customer' : 'Assistant'}
                              </span>
                              <span className="text-xs text-stone-400">•</span>
                              <span className="text-xs text-stone-500">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                            </div>

                            {/* Message Text */}
                            <div className={`text-sm ${
                              message.role === 'user'
                                ? 'text-stone-900'
                                : 'text-stone-700'
                            }`}>
                              {message.content}
                            </div>

                            {/* Metadata */}
                            {message.metadata && Object.keys(message.metadata).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {message.metadata.sentiment && (
                                  <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded">
                                    Sentiment: {message.metadata.sentiment}
                                  </span>
                                )}
                                {message.metadata.intent && (
                                  <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded">
                                    Intent: {message.metadata.intent}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Load More */}
      {!loading && filteredMessages.length > 0 && (
        <div className="text-center pt-4">
          <button
            onClick={loadMessages}
            className="text-sm text-sky-600 hover:text-sky-700 font-medium"
          >
            Load More Messages
          </button>
        </div>
      )}
    </div>
  );
}
