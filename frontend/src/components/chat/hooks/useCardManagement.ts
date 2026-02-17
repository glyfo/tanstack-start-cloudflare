import { useCallback } from 'react';

/**
 * useCardManagement Hook
 *
 * Manages state-driven card operations: dismissal and updates
 */

export function useCardManagement(
  callAgentMethod: (method: string, params: unknown[]) => Promise<unknown>
) {
  /**
   * Dismiss the active card via RPC
   */
  const dismissActiveCard = useCallback(async () => {
    console.log('[useCardManagement] dismissActiveCard called');
    try {
      console.log('[useCardManagement] Calling dismissCard RPC method');
      await callAgentMethod('dismissCard', []);
      console.log('[useCardManagement] dismissCard RPC completed');
    } catch (error) {
      console.error('[useCardManagement] Failed to dismiss card:', error);
    }
  }, [callAgentMethod]);

  return {
    dismissActiveCard,
  };
}
