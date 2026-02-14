/**
 * Notification Card Component
 *
 * Displays system notifications in chat interface
 * Shows new leads, hot lead alerts, and workflow notifications
 */

type LeadSource = 'tiktok' | 'facebook' | 'whatsapp' | 'instagram';
type LeadClassification = 'hot' | 'warm' | 'cold' | 'unqualified' | 'new';

export interface Notification {
  id: string;
  type: 'new_lead' | 'hot_lead' | 'assignment' | 'workflow' | 'system';
  title: string;
  message: string;
  source?: LeadSource;
  classification?: LeadClassification;
  leadId?: string;
  timestamp: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationCardProps {
  notification: Notification;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

export function NotificationCard({
  notification,
  onDismiss,
  compact = false,
}: NotificationCardProps) {
  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'hot_lead':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'bg-red-600',
          iconText: 'text-white',
          title: 'text-red-900',
        };
      case 'new_lead':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'bg-blue-600',
          iconText: 'text-white',
          title: 'text-blue-900',
        };
      case 'assignment':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'bg-green-600',
          iconText: 'text-white',
          title: 'text-green-900',
        };
      case 'workflow':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          icon: 'bg-purple-600',
          iconText: 'text-white',
          title: 'text-purple-900',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: 'bg-stone-600',
          iconText: 'text-white',
          title: 'text-stone-900',
        };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hot_lead':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        );
      case 'new_lead':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'assignment':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'workflow':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const styles = getTypeStyles(notification.type);
  const minutesAgo = Math.floor((Date.now() - notification.timestamp) / 1000 / 60);
  const timeAgo =
    minutesAgo < 1
      ? 'Just now'
      : minutesAgo < 60
      ? `${minutesAgo}m ago`
      : `${Math.floor(minutesAgo / 60)}h ago`;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 py-2 px-3 rounded-md border ${styles.bg} ${styles.border}`}
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${styles.icon} ${styles.iconText}`}>
          {getTypeIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${styles.title} truncate`}>
            {notification.title}
          </div>
          <div className="text-xs text-stone-500">{timeAgo}</div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(notification.id)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 ${styles.bg} ${styles.border} hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.icon} ${styles.iconText}`}>
          {getTypeIcon(notification.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3 className={`font-semibold text-sm ${styles.title}`}>
              {notification.title}
            </h3>
            {onDismiss && (
              <button
                onClick={() => onDismiss(notification.id)}
                className="text-stone-400 hover:text-stone-600 transition-colors ml-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <p className="text-sm text-stone-700 mb-2">{notification.message}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-500">{timeAgo}</span>

            {notification.onAction && notification.actionLabel && (
              <button
                onClick={notification.onAction}
                className="text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors"
              >
                {notification.actionLabel} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Notification List - Display multiple notifications
 */
interface NotificationListProps {
  notifications: Notification[];
  onDismiss?: (id: string) => void;
  onDismissAll?: () => void;
  maxDisplay?: number;
}

export function NotificationList({
  notifications,
  onDismiss,
  onDismissAll,
  maxDisplay = 10,
}: NotificationListProps) {
  const displayNotifications = notifications.slice(0, maxDisplay);
  const remaining = notifications.length - displayNotifications.length;

  if (notifications.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white p-8 text-center">
        <svg
          className="w-12 h-12 mx-auto text-stone-300 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <p className="text-sm text-stone-500">No new notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">
          Notifications ({notifications.length})
        </h3>
        {onDismissAll && notifications.length > 0 && (
          <button
            onClick={onDismissAll}
            className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        {displayNotifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {remaining > 0 && (
        <div className="text-center text-xs text-stone-500 py-2">
          + {remaining} more notification{remaining !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
