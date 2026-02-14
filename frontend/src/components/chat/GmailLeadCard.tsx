/**
 * GmailLeadCard - Display email lead information in chat
 *
 * Black and white design following the SuperHuman aesthetic.
 */

import { Mail, ArrowRight, User, Clock, Tag, Archive, Reply } from 'lucide-react';
import { CardActions } from './shared';

export interface GmailLeadData {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: {
    name?: string;
    email: string;
  };
  date: string;
  labels: string[];
  isUnread?: boolean;
}

interface GmailLeadCardProps {
  lead: GmailLeadData;
  onViewThread?: (threadId: string) => void;
  onReply?: (leadId: string) => void;
  onArchive?: (leadId: string) => void;
  onCreateContact?: (email: string, name?: string) => void;
}

export function GmailLeadCard({
  lead,
  onViewThread,
  onReply,
  onArchive,
  onCreateContact,
}: GmailLeadCardProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch {
      return dateString;
    }
  };

  const displayName = lead.from.name || lead.from.email.split('@')[0];

  // Build action buttons
  const actions = [
    onViewThread && {
      label: 'View',
      onClick: () => onViewThread(lead.threadId),
      variant: 'secondary' as const,
      icon: <ArrowRight className="w-4 h-4" />,
    },
    onReply && {
      label: 'Reply',
      onClick: () => onReply(lead.id),
      variant: 'secondary' as const,
      icon: <Reply className="w-4 h-4" />,
    },
    onCreateContact && {
      label: 'Add Contact',
      onClick: () => onCreateContact(lead.from.email, lead.from.name),
      variant: 'secondary' as const,
      icon: <User className="w-4 h-4" />,
    },
    onArchive && {
      label: 'Archive',
      onClick: () => onArchive(lead.id),
      variant: 'secondary' as const,
      icon: <Archive className="w-4 h-4" />,
    },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void; variant: 'primary' | 'secondary'; icon?: React.ReactNode }>;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-stone-100">
        <div className="w-10 h-10 rounded-lg bg-stone-900 flex items-center justify-center flex-shrink-0">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-stone-900 truncate">
              {displayName}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {lead.isUnread && (
                <span className="w-2 h-2 rounded-full bg-stone-900" />
              )}
              <span className="text-sm text-stone-500">
                {formatDate(lead.date)}
              </span>
            </div>
          </div>
          <p className="text-sm text-stone-500 truncate">{lead.from.email}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <p className="font-medium text-stone-900 line-clamp-1">
            {lead.subject || '(no subject)'}
          </p>
          <p className="text-sm text-stone-600 mt-1 line-clamp-2">
            {lead.snippet}
          </p>
        </div>

        {/* Labels */}
        {lead.labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-stone-400" />
            {lead.labels
              .filter((l) => !['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'].includes(l))
              .slice(0, 3)
              .map((label) => (
                <span
                  key={label}
                  className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded"
                >
                  {label.toLowerCase().replace(/_/g, ' ')}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Actions - using CardActions */}
      {actions.length > 0 && (
        <div className="p-3 bg-stone-50 border-t border-stone-100">
          <CardActions actions={actions} />
        </div>
      )}
    </div>
  );
}

/**
 * GmailEmailList - List of email leads
 */
export interface GmailEmailListProps {
  emails: GmailLeadData[];
  onViewThread?: (threadId: string) => void;
  onReply?: (leadId: string) => void;
  emptyMessage?: string;
}

export function GmailEmailList({
  emails,
  onViewThread,
  onReply,
  emptyMessage = 'No emails found',
}: GmailEmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
        <Mail className="w-10 h-10 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {emails.map((email) => (
        <GmailLeadCard
          key={email.id}
          lead={email}
          onViewThread={onViewThread}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

/**
 * GmailThreadCard - Display a full email thread
 */
export interface GmailThreadMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isFromMe?: boolean;
}

export interface GmailThreadCardProps {
  threadId: string;
  subject: string;
  messages: GmailThreadMessage[];
  onReply?: () => void;
}

export function GmailThreadCard({
  subject,
  messages,
  onReply,
}: GmailThreadCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-stone-100">
        <div className="w-10 h-10 rounded-lg bg-stone-900 flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 truncate">{subject}</h3>
          <p className="text-sm text-stone-500">{messages.length} messages</p>
        </div>
      </div>

      {/* Messages */}
      <div className="divide-y divide-stone-100">
        {messages.map((message, index) => (
          <div key={message.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.isFromMe ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  <User className="w-4 h-4" />
                </div>
                <span className="font-medium text-stone-900 text-sm">
                  {message.isFromMe ? 'You' : message.from.split('<')[0].trim()}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-stone-500">
                <Clock className="w-3 h-3" />
                {new Date(message.date).toLocaleString()}
              </div>
            </div>
            <div className="text-sm text-stone-700 whitespace-pre-wrap pl-10">
              {message.body}
            </div>
            {index === messages.length - 1 && onReply && (
              <div className="mt-3 pl-10">
                <button
                  onClick={onReply}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 rounded-lg transition-colors"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
