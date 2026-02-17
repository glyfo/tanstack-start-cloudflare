/**
 * Envelope Converter Utilities
 *
 * Converts between MessageEnvelope and ChatAgent's Message format.
 * Maintains backward compatibility with existing message structure.
 */

import type { MessageEnvelope, OutboundMessage, Peer } from './types';

// ChatAgent's Message interface (from AIChatAgent)
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Envelope → Message Conversion
// ============================================================================

/**
 * Convert MessageEnvelope to ChatAgent Message format
 */
export function envelopeToMessage(envelope: MessageEnvelope): Message {
  // Build content (text + media placeholders)
  let content = envelope.text;

  // Add media placeholders if present
  if (envelope.mediaAttachments && envelope.mediaAttachments.length > 0) {
    const mediaPlaceholders = envelope.mediaAttachments
      .map(media => media.placeholder || `<${media.type}>`)
      .join(' ');
    content = `${mediaPlaceholders}\n${content}`.trim();
  }

  // Add reply context if present
  if (envelope.replyTo) {
    const replyPrefix = `[Reply to: "${envelope.replyTo.text || 'message'}"]\n`;
    content = replyPrefix + content;
  }

  // Determine role
  const role = envelope.isFromUser ? 'user' : 'assistant';

  // Build metadata
  const metadata: Record<string, any> = {
    // Envelope metadata
    messageId: envelope.messageId,
    channelType: envelope.channelType,
    scope: envelope.scope,
    sessionKey: envelope.sessionKey,

    // Sender info
    sender: peerToMetadata(envelope.sender),

    // Reply context
    ...(envelope.replyTo && {
      replyTo: envelope.replyTo,
    }),

    // Media attachments
    ...(envelope.mediaAttachments && {
      mediaAttachments: envelope.mediaAttachments,
    }),

    // Channel metadata
    ...(envelope.channelMetadata || {}),
  };

  return {
    role,
    content,
    timestamp: envelope.timestamp,
    metadata,
  };
}

/**
 * Convert Peer to metadata object
 */
function peerToMetadata(peer: Peer): Record<string, any> {
  return {
    id: peer.id,
    displayName: peer.displayName,
    channelType: peer.channelType,
    ...peer.metadata,
  };
}

// ============================================================================
// Message → Envelope Conversion
// ============================================================================

/**
 * Convert ChatAgent Message to MessageEnvelope
 * Used for outbound messages (agent responses)
 */
export function messageToEnvelope(
  message: Message,
  recipientPeer: Peer,
  orgId: string,
  sessionKey: string,
): OutboundMessage {
  // Extract channel type from session key
  const channelType = extractChannelTypeFromSessionKey(sessionKey);

  const outbound: OutboundMessage = {
    channelType,
    recipient: recipientPeer,
    text: message.content,
    orgId,
    sessionKey,
    metadata: {
      ...message.metadata,
      messageId: message.metadata?.messageId || generateMessageId(),
      timestamp: message.timestamp || Date.now(),
    },
  };

  return outbound;
}

/**
 * Extract channel type from session key
 * Format: agent:<orgId>:<channel>:<scope>:<id>
 */
function extractChannelTypeFromSessionKey(sessionKey: string): string {
  const parts = sessionKey.split(':');
  if (parts.length >= 3) {
    return parts[2]; // channel type
  }
  return 'websocket'; // default fallback
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// Batch Conversion
// ============================================================================

/**
 * Convert multiple envelopes to messages
 */
export function envelopesToMessages(envelopes: MessageEnvelope[]): Message[] {
  return envelopes.map(envelopeToMessage);
}

/**
 * Convert multiple messages to envelopes
 */
export function messagesToEnvelopes(
  messages: Message[],
  recipientPeer: Peer,
  orgId: string,
  sessionKey: string,
): OutboundMessage[] {
  return messages.map(msg => messageToEnvelope(msg, recipientPeer, orgId, sessionKey));
}
