/**
 * Settings Menu - Chat session management
 */

import { useState } from 'react';
import { Settings, Trash2, RefreshCw, X } from 'lucide-react';

interface SettingsMenuProps {
  onResetSession: () => void;
}

export function SettingsMenu({ onResetSession }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    onResetSession();
    setShowConfirm(false);
    setIsOpen(false);
  };

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute top-16 right-4 w-80 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Session Info */}
            <div>
              <h4 className="text-sm font-medium text-stone-700 mb-2">Session</h4>
              <p className="text-xs text-stone-500 mb-3">
                Your conversation history is stored locally and on the server.
                Clearing the session will delete all messages and forms.
              </p>
            </div>

            {/* Clear Session Button */}
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="font-medium">Clear Session & History</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    Are you sure?
                  </p>
                  <p className="text-xs text-amber-700">
                    This will permanently delete:
                  </p>
                  <ul className="text-xs text-amber-700 mt-1 ml-4 list-disc">
                    <li>All conversation history</li>
                    <li>Any open forms</li>
                    <li>Temporary data and state</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="font-medium">Yes, Clear Everything</span>
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400">
                <strong>Tip:</strong> You can also type <code className="px-1 py-0.5 bg-stone-100 rounded text-stone-600">/reset</code> to clear the session.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
