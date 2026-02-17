/**
 * Session Key Migration Utilities
 *
 * Handles parsing and migration of session keys between old and new formats.
 *
 * New format: agent:<orgId>:<channel>:<scope>:<id>
 * Examples:
 *   - agent:default-org:websocket:dm:user-123
 *   - agent:default-org:whatsapp:dm:+1234567890
 *   - agent:default-org:whatsapp:group:group-jid
 *   - agent:default-org:sms:dm:+1234567890
 */

import type { ChannelType, MessageScope, ParsedSessionKey, MessageEnvelope } from '../channels/types';
import { MessageScope as MS, ChannelType as CT } from '../channels/types';

// ============================================================================
// Session Key Parsing
// ============================================================================

/**
 * Parse hierarchical session key
 * Format: agent:<orgId>:<channel>:<scope>:<id>
 */
export function parseSessionKey(key: string): ParsedSessionKey | null {
  const parts = key.split(':');

  // Validate format
  if (parts.length !== 5) {
    return null;
  }

  const [prefix, orgId, channel, scope, id] = parts;

  // Validate prefix
  if (prefix !== 'agent') {
    return null;
  }

  // Validate channel
  const channelType = channel as ChannelType;
  if (!Object.values(CT).includes(channelType)) {
    return null;
  }

  // Validate scope
  const messageScope = scope as MessageScope;
  if (!Object.values(MS).includes(messageScope)) {
    return null;
  }

  return {
    prefix: 'agent',
    orgId,
    channelType,
    scope: messageScope,
    id,
    raw: key,
  };
}

/**
 * Migrate old session key to new format
 * Old format: simple session ID (e.g., "user-123", UUID)
 * New format: agent:<orgId>:<channel>:<scope>:<id>
 */
export function migrateSessionKey(
  oldKey: string,
  orgId: string,
  channelType: ChannelType = CT.WEBSOCKET,
  scope: MessageScope = MS.DM,
): string {
  // If already in new format, return as-is
  const parsed = parseSessionKey(oldKey);
  if (parsed) {
    return oldKey;
  }

  // Convert to new format
  return computeSessionKey(orgId, channelType, scope, oldKey);
}

/**
 * Compute session key from components
 */
export function computeSessionKey(
  orgId: string,
  channelType: ChannelType,
  scope: MessageScope,
  id: string,
): string {
  return `agent:${orgId}:${channelType}:${scope}:${id}`;
}

/**
 * Compute session key from MessageEnvelope
 */
export function computeSessionKeyFromEnvelope(envelope: MessageEnvelope): string {
  // Use pre-computed key if available
  if (envelope.sessionKey) {
    return envelope.sessionKey;
  }

  // For DMs: use sender ID
  // For groups: use conversation ID
  const id = envelope.scope === MS.DM
    ? envelope.sender.id
    : (envelope.conversationId || envelope.sender.id);

  return computeSessionKey(
    envelope.orgId,
    envelope.channelType,
    envelope.scope,
    id,
  );
}

/**
 * Extract peer ID from session key
 */
export function extractPeerIdFromSessionKey(key: string): string | null {
  const parsed = parseSessionKey(key);
  return parsed ? parsed.id : null;
}

/**
 * Check if session key is in new format
 */
export function isNewSessionKeyFormat(key: string): boolean {
  return parseSessionKey(key) !== null;
}

/**
 * Get default session key for legacy WebSocket sessions
 */
export function getLegacyWebSocketSessionKey(sessionId: string, orgId: string = 'default-org'): string {
  return migrateSessionKey(sessionId, orgId, CT.WEBSOCKET, MS.DM);
}
