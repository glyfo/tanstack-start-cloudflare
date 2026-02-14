/**
 * TokenExpiryWarning - Alert component for token expiration
 */

interface TokenExpiryWarningProps {
  daysLeft: number;
  platformName: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function TokenExpiryWarning({
  daysLeft,
  platformName,
  onRefresh,
  isRefreshing,
}: TokenExpiryWarningProps) {
  if (daysLeft > 7) return null;

  const isUrgent = daysLeft <= 3;
  const bgColor = isUrgent ? 'bg-red-50' : 'bg-yellow-50';
  const borderColor = isUrgent ? 'border-red-200' : 'border-yellow-200';
  const textColor = isUrgent ? 'text-red-800' : 'text-yellow-800';
  const iconColor = isUrgent ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-3 mt-3`}>
      <div className="flex items-start gap-2">
        <svg
          className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <p className={`text-sm font-medium ${textColor}`}>
            {daysLeft <= 0
              ? `${platformName} connection has expired`
              : daysLeft === 1
              ? `${platformName} token expires tomorrow`
              : `${platformName} token expires in ${daysLeft} days`}
          </p>
          <p className={`text-xs mt-0.5 ${isUrgent ? 'text-red-600' : 'text-yellow-700'}`}>
            {daysLeft <= 0
              ? 'Please reconnect to restore functionality.'
              : 'Refresh the token to prevent service interruption.'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isUrgent
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRefreshing ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Refreshing...
            </span>
          ) : daysLeft <= 0 ? (
            'Reconnect'
          ) : (
            'Refresh Token'
          )}
        </button>
      </div>
    </div>
  );
}
