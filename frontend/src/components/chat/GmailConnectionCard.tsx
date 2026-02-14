/**
 * GmailConnectionCard - Compact Gmail setup card for chat initial screen
 */

import { useConnections } from '@/hooks/useConnections';

export function GmailConnectionCard() {
  const { isConnected, connect, connecting } = useConnections();
  const gmailConnected = isConnected('gmail');

  if (gmailConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg">
        <div className="w-6 h-6 rounded bg-black flex items-center justify-center text-white flex-shrink-0">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-black">Gmail Connected</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black text-white">
          Active
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect('gmail')}
      disabled={connecting === 'gmail'}
      className="w-full flex items-center gap-3 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-all disabled:opacity-50"
    >
      <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white flex-shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-[11px] font-medium text-black">
          {connecting === 'gmail' ? 'Connecting...' : 'Connect Gmail'}
        </p>
        <p className="text-[10px] text-neutral-500">Receive email leads automatically</p>
      </div>
      <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
