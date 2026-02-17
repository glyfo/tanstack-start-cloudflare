/**
 * Pairing Requests Panel
 *
 * Shows pending pairing requests from unknown senders on WhatsApp, Telegram, etc.
 * Allows admin to approve/reject access.
 */

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, MessageCircle, AlertCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PairingRequest {
  id: string;
  orgId: string;
  channelType: string;
  peer: {
    id: string;
    displayName?: string;
  };
  firstMessage?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  expiresAt: number;
}

// ============================================================================
// Pairing Requests Panel
// ============================================================================

export function PairingRequestsPanel() {
  const [requests, setRequests] = useState<PairingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);

  const loadRequests = async () => {
    try {
      const response = await fetch(`/api/pairing-requests?status=${filter}`);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error loading pairing requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await fetch('/api/pairing-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, reviewedBy: 'admin' }),
      });
      loadRequests();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await fetch('/api/pairing-requests/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, reviewedBy: 'admin' }),
      });
      loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Pairing Requests</h2>
          <p className="text-sm text-stone-500 mt-1">
            Approve or reject access requests from unknown senders
          </p>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <MessageCircle className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">No pairing requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const isExpired = Date.now() > request.expiresAt;
            const isPending = request.status === 'pending';

            return (
              <div
                key={request.id}
                className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  {/* Request Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-stone-900">
                        {request.peer.displayName || request.peer.id}
                      </span>
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs rounded font-medium uppercase">
                        {request.channelType}
                      </span>

                      {/* Status Badge */}
                      {request.status === 'approved' && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-medium">
                          ✓ Approved
                        </span>
                      )}
                      {request.status === 'rejected' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                          ✗ Rejected
                        </span>
                      )}
                      {isExpired && isPending && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                          ⏱ Expired
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-stone-600 mb-2">
                      ID: {request.peer.id}
                    </div>

                    {/* First Message */}
                    {request.firstMessage && (
                      <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-700 mb-3">
                        <div className="text-xs text-stone-500 mb-1">First message:</div>
                        "{request.firstMessage}"
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-4 text-xs text-stone-500">
                      <span>Requested {formatRelativeTime(request.createdAt)}</span>
                      {!isExpired && isPending && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires {formatRelativeTime(request.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending && !isExpired && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="flex items-center gap-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const future = seconds < 0;
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) return future ? 'in a moment' : 'just now';
  if (absSeconds < 3600) {
    const mins = Math.floor(absSeconds / 60);
    return future ? `in ${mins}m` : `${mins}m ago`;
  }
  if (absSeconds < 86400) {
    const hours = Math.floor(absSeconds / 3600);
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.floor(absSeconds / 86400);
  return future ? `in ${days}d` : `${days}d ago`;
}
