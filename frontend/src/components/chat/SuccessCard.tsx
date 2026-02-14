/**
 * Success Card Component
 *
 * Displays a success message after creating or updating a record.
 * Provides visual confirmation with the created/updated data.
 */

import { FieldGrid, CardActions } from './shared';

interface SuccessCardProps {
  type: 'contact' | 'opportunity' | 'lead';
  action: 'created' | 'updated' | 'deleted';
  title: string;
  subtitle?: string;
  details?: Array<{ label: string; value: string }>;
  onView?: () => void;
  onUndo?: () => void;
}

export function SuccessCard({
  type,
  action,
  title,
  subtitle,
  details,
  onView,
  onUndo,
}: SuccessCardProps) {
  const getTypeConfig = () => {
    switch (type) {
      case 'contact':
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          color: 'sky',
          bgGradient: 'from-sky-500 to-sky-600',
        };
      case 'opportunity':
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'emerald',
          bgGradient: 'from-emerald-500 to-emerald-600',
        };
      case 'lead':
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
          color: 'purple',
          bgGradient: 'from-purple-500 to-purple-600',
        };
    }
  };

  const getActionLabel = () => {
    const labels = {
      created: 'Created',
      updated: 'Updated',
      deleted: 'Deleted',
    };
    return labels[action];
  };

  const config = getTypeConfig();

  // Build action buttons
  const actions = [
    onView && {
      label: 'View Details',
      onClick: onView,
      variant: 'secondary' as const,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    onUndo && {
      label: 'Undo',
      onClick: onUndo,
      variant: 'secondary' as const,
    },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void; variant: 'primary' | 'secondary'; icon?: React.ReactNode }>;

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden my-3">
      {/* Success Header */}
      <div className={`bg-gradient-to-r ${config.bgGradient} px-4 py-3`}>
        <div className="flex items-center gap-3">
          {/* Success checkmark */}
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-sm font-medium capitalize">{type}</span>
              <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full">
                {getActionLabel()}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {subtitle && (
          <p className="text-sm text-stone-600 mb-3">{subtitle}</p>
        )}

        {/* Details Grid - using FieldGrid */}
        {details && details.length > 0 && (
          <div className="mb-4">
            <FieldGrid fields={details} columns={2} />
          </div>
        )}

        {/* Actions - using CardActions */}
        {actions.length > 0 && (
          <div className="pt-3 border-t border-stone-100">
            <CardActions actions={actions} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Success Notification
 * For inline success messages without full card
 */
interface SuccessNotificationProps {
  message: string;
  type?: 'success' | 'info' | 'warning';
}

export function SuccessNotification({ message, type = 'success' }: SuccessNotificationProps) {
  const colors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const icons = {
    success: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[type]} my-2`}>
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
