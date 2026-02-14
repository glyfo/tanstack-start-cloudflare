/**
 * DisconnectConfirmDialog - Confirmation dialog for disconnecting platforms
 */

interface DisconnectConfirmDialogProps {
  platformName: string;
  isOpen: boolean;
  isDisconnecting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DisconnectConfirmDialog({
  platformName,
  isOpen,
  isDisconnecting,
  onConfirm,
  onCancel,
}: DisconnectConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Icon */}
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600"
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
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-stone-900 text-center mb-2">
          Disconnect {platformName}?
        </h3>
        <p className="text-sm text-stone-600 text-center mb-6">
          This will revoke access and stop receiving events from {platformName}. You can
          reconnect at any time.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDisconnecting}
            className="flex-1 px-4 py-2.5 bg-white border border-stone-300 text-stone-700 font-medium rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDisconnecting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDisconnecting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
