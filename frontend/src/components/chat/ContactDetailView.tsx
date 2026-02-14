import { useState } from 'react';

interface ContactData {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  status?: string;
  source?: string;
  tags?: string[];
  createdAt?: string;
  lastContact?: string;
  notes?: string;
}

interface Activity {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note';
  description: string;
  date: string;
}

interface Opportunity {
  id: string;
  title: string;
  value: number;
  stage: string;
}

// 360-degree view types
interface ChannelMessage {
  id: string;
  platform: 'whatsapp' | 'facebook' | 'tiktok' | 'instagram' | 'chat';
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface TimelineEvent {
  id: string;
  type: 'activity' | 'message' | 'opportunity' | 'lead';
  action: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface ContactDetailViewProps {
  contact: ContactData;
  activities?: Activity[];
  opportunities?: Opportunity[];
  messages?: ChannelMessage[];      // 360-degree: all channel messages
  timeline?: TimelineEvent[];       // 360-degree: unified timeline
  onClose?: () => void;
  onEdit?: () => void;
  onCreateOpportunity?: () => void;
  onSendMessage?: () => void;
  onLoadMessages?: () => void;      // Load messages on demand
  onLoadTimeline?: () => void;      // Load timeline on demand
}

const activityIcons = {
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  call: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  meeting: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
};

const platformColors: Record<string, { bg: string; text: string; icon: string }> = {
  whatsapp: { bg: 'bg-green-100', text: 'text-green-700', icon: 'WhatsApp' },
  facebook: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'Facebook' },
  tiktok: { bg: 'bg-pink-100', text: 'text-pink-700', icon: 'TikTok' },
  instagram: { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'Instagram' },
  chat: { bg: 'bg-stone-100', text: 'text-stone-700', icon: 'Chat' },
};

const timelineIcons: Record<string, string> = {
  activity: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  message: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  opportunity: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  lead: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function ContactDetailView({
  contact,
  activities = [],
  opportunities = [],
  messages = [],
  timeline = [],
  onClose,
  onEdit,
  onCreateOpportunity,
  onSendMessage,
  onLoadMessages,
  onLoadTimeline,
}: ContactDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'timeline' | 'opportunities'>('overview');

  // Load data when switching to messages or timeline tab
  const handleTabChange = (tab: 'overview' | 'messages' | 'timeline' | 'opportunities') => {
    setActiveTab(tab);
    if (tab === 'messages' && messages.length === 0 && onLoadMessages) {
      onLoadMessages();
    }
    if (tab === 'timeline' && timeline.length === 0 && onLoadTimeline) {
      onLoadTimeline();
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-lg mb-3 max-w-2xl overflow-hidden">
      {/* Header with Back Button */}
      <div className="bg-stone-50 px-4 py-3 border-b border-stone-200">
        <div className="flex items-center justify-between">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to chat
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Contact Header */}
      <div className="p-6 border-b border-stone-100">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
            <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-stone-900 mb-1">{contact.name}</h2>
            {contact.company && (
              <p className="text-base text-stone-600 mb-3">{contact.company}</p>
            )}
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag, idx) => (
                  <span key={idx} className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-700 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Updated with Messages and Timeline for 360-degree view */}
      <div className="flex border-b border-stone-200 bg-stone-50 overflow-x-auto">
        <button
          onClick={() => handleTabChange('overview')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'text-sky-600 border-b-2 border-sky-600 bg-white'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange('messages')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'messages'
              ? 'text-sky-600 border-b-2 border-sky-600 bg-white'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          Messages {messages.length > 0 && `(${messages.length})`}
        </button>
        <button
          onClick={() => handleTabChange('timeline')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'timeline'
              ? 'text-sky-600 border-b-2 border-sky-600 bg-white'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          Timeline {timeline.length > 0 && `(${timeline.length})`}
        </button>
        <button
          onClick={() => handleTabChange('opportunities')}
          className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'opportunities'
              ? 'text-sky-600 border-b-2 border-sky-600 bg-white'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
          }`}
        >
          Deals {opportunities.length > 0 && `(${opportunities.length})`}
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6 max-h-96 overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-stone-700">{contact.email}</span>
              </div>

              {contact.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-stone-700">{contact.phone}</span>
                </div>
              )}

              {contact.status && (
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-stone-700 capitalize">{contact.status}</span>
                </div>
              )}

              {contact.source && (
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-stone-700">Source: {contact.source}</span>
                </div>
              )}
            </div>

            {contact.notes && (
              <div className="pt-4 border-t border-stone-100">
                <h4 className="text-sm font-semibold text-stone-900 mb-2">Notes</h4>
                <p className="text-sm text-stone-700">{contact.notes}</p>
              </div>
            )}

            <div className="pt-4 border-t border-stone-100">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {contact.createdAt && (
                  <div>
                    <span className="text-stone-500">Created</span>
                    <p className="text-stone-900 font-medium">{contact.createdAt}</p>
                  </div>
                )}
                {contact.lastContact && (
                  <div>
                    <span className="text-stone-500">Last Contact</span>
                    <p className="text-stone-900 font-medium">{contact.lastContact}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="pt-4 border-t border-stone-100">
              <h4 className="text-sm font-semibold text-stone-900 mb-3">Activity Summary</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-stone-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-stone-900">{messages.length}</p>
                  <p className="text-xs text-stone-500">Messages</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-stone-900">{opportunities.length}</p>
                  <p className="text-xs text-stone-500">Deals</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-stone-900">{activities.length}</p>
                  <p className="text-xs text-stone-500">Activities</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Tab - 360-degree view of all channel communications */}
        {activeTab === 'messages' && (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-stone-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-stone-500">No messages across channels yet</p>
                <p className="text-xs text-stone-400 mt-1">Messages from WhatsApp, Facebook, TikTok, and Instagram will appear here</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-stone-500 mb-3">All conversations across channels</p>
                {messages.map((msg) => {
                  const platform = platformColors[msg.platform] || platformColors.chat;
                  return (
                    <div key={msg.id} className={`p-3 rounded-lg ${msg.direction === 'inbound' ? 'bg-stone-50' : 'bg-sky-50'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`px-2 py-0.5 rounded text-xs font-medium ${platform.bg} ${platform.text}`}>
                          {platform.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-900">{msg.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-stone-400">{formatTimestamp(msg.timestamp)}</span>
                            <span className="text-xs text-stone-400">
                              {msg.direction === 'inbound' ? 'Received' : 'Sent'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Timeline Tab - Unified activity timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-stone-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-stone-500">No activity timeline yet</p>
                <p className="text-xs text-stone-400 mt-1">All interactions will be shown chronologically</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-stone-200" />

                {timeline.map((event, idx) => {
                  const iconPath = timelineIcons[event.type] || timelineIcons.activity;
                  const typeColors: Record<string, string> = {
                    activity: 'bg-sky-100 text-sky-600',
                    message: 'bg-green-100 text-green-600',
                    opportunity: 'bg-amber-100 text-amber-600',
                    lead: 'bg-purple-100 text-purple-600',
                  };
                  const colorClass = typeColors[event.type] || typeColors.activity;

                  return (
                    <div key={event.id} className="relative flex gap-4 pb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${colorClass}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                        </svg>
                      </div>
                      <div className="flex-1 bg-stone-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-stone-500 uppercase">{event.type}</span>
                          <span className="text-xs text-stone-400">{formatTimestamp(event.timestamp)}</span>
                        </div>
                        <p className="text-sm text-stone-900">{event.description}</p>
                        {event.action && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-white rounded text-stone-600">{event.action}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <div className="space-y-3">
            {opportunities.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-stone-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-stone-500 mb-3">No opportunities yet</p>
                {onCreateOpportunity && (
                  <button
                    onClick={onCreateOpportunity}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Create Opportunity
                  </button>
                )}
              </div>
            ) : (
              <>
                {opportunities.map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-stone-900">{opp.title}</p>
                      <p className="text-xs text-stone-500 capitalize">{opp.stage}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-900">${opp.value.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {onCreateOpportunity && (
                  <button
                    onClick={onCreateOpportunity}
                    className="w-full px-4 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg transition-colors mt-2"
                  >
                    + Add Another Opportunity
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="bg-stone-50 px-6 py-4 border-t border-stone-200">
        <div className="flex gap-2">
          {onSendMessage && (
            <button
              onClick={onSendMessage}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Email
            </button>
          )}
          {onCreateOpportunity && (
            <button
              onClick={onCreateOpportunity}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              New Deal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
