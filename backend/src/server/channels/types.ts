/**
 * Channel Types and Interfaces
 *
 * Core types for the multi-channel messaging architecture.
 * Supports WebSocket, WhatsApp, SMS, and future channels.
 */

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Supported channel types
 */
export enum ChannelType {
  WEBSOCKET = 'websocket',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  SLACK = 'slack',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  EMAIL = 'email',
}

/**
 * Message scope (DM, group, broadcast)
 */
export enum MessageScope {
  DM = 'dm',           // Direct message (1:1)
  GROUP = 'group',     // Group conversation
  BROADCAST = 'broadcast', // One-to-many broadcast
}

/**
 * Access policy for new senders
 */
export enum AccessPolicy {
  OPEN = 'open',         // Accept all messages
  ALLOWLIST = 'allowlist', // Only allow pre-approved senders
  PAIRING = 'pairing',   // Require pairing approval
  CLOSED = 'closed',     // Reject all new senders
}

/**
 * Pairing request status
 */
export enum PairingStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

// ============================================================================
// Message Envelope
// ============================================================================

/**
 * Normalized message format across all channels
 */
export interface MessageEnvelope {
  // Identity
  messageId: string;              // Unique message ID
  channelType: ChannelType;       // Source channel
  scope: MessageScope;            // DM, group, or broadcast

  // Sender information
  sender: Peer;                   // Sender identity
  recipients?: Peer[];            // Recipients (for groups/broadcasts)

  // Content
  text: string;                   // Message text
  mediaAttachments?: MediaAttachment[]; // Media files
  replyTo?: ReplyContext;         // Reply metadata

  // Routing
  orgId: string;                  // Organization ID
  sessionKey?: string;            // Pre-computed session key (optional)
  conversationId?: string;        // Group/thread ID (for groups)

  // Metadata
  timestamp: number;              // Unix timestamp (ms)
  channelMetadata?: Record<string, any>; // Channel-specific data

  // System flags
  isFromUser: boolean;            // true = user message, false = agent message
  requiresDeliveryReceipt?: boolean;
}

/**
 * Peer (sender/recipient) identity
 */
export interface Peer {
  id: string;                     // Channel-specific ID (phone, username, etc)
  displayName?: string;           // Human-readable name
  channelType: ChannelType;       // Which channel this peer is on
  metadata?: Record<string, any>; // Channel-specific metadata
}

/**
 * Reply context (for threaded conversations)
 */
export interface ReplyContext {
  messageId: string;              // ID of message being replied to
  text?: string;                  // Snippet of original message
  sender?: Peer;                  // Original sender
}

/**
 * Media attachment
 */
export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location';
  url?: string;                   // Download URL (if available)
  mimeType?: string;              // MIME type
  filename?: string;              // Original filename
  size?: number;                  // File size in bytes
  caption?: string;               // Media caption

  // Placeholders (before download)
  placeholder?: string;           // Text placeholder (e.g., "<image>")

  // Channel-specific metadata
  metadata?: Record<string, any>;
}

// ============================================================================
// Outbound Messages
// ============================================================================

/**
 * Message to send via channel
 */
export interface OutboundMessage {
  channelType: ChannelType;       // Target channel
  recipient: Peer;                // Recipient identity
  text: string;                   // Message text
  mediaAttachments?: MediaAttachment[];
  replyTo?: ReplyContext;         // Reply context

  // Routing
  orgId: string;
  sessionKey: string;             // Session this belongs to

  // Metadata
  metadata?: Record<string, any>; // Channel-specific options
}

// ============================================================================
// Channel Configuration
// ============================================================================

/**
 * Channel configuration for an organization
 */
export interface ChannelConfig {
  id: string;                     // Config ID
  orgId: string;                  // Organization ID
  channelType: ChannelType;       // Channel type
  accountId: string;              // Account identifier (phone number, workspace ID, etc)

  // Status
  enabled: boolean;               // Is channel active?

  // Access control
  dmPolicy: AccessPolicy;         // Policy for DMs
  groupPolicy: AccessPolicy;      // Policy for groups

  // Message handling
  textChunkLimit?: number;        // Max chars per message (for chunking)
  chunkMode?: 'newline' | 'word' | 'char'; // How to split chunks
  sendReadReceipts?: boolean;     // Send read receipts

  // Channel-specific settings
  settings: Record<string, any>;  // API keys, tokens, config options

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Channel binding (routing rule)
 */
export interface ChannelBinding {
  id: string;                     // Binding ID
  orgId: string;                  // Organization ID
  channelConfigId: string;        // Associated channel config

  // Matching rules
  peer?: Peer;                    // Specific peer (if null, matches all)
  conversationId?: string;        // Specific conversation (for groups)
  scope?: MessageScope;           // DM, group, or broadcast

  // Target
  agentId: string;                // Which agent handles this
  agentType: 'chat' | 'custom';   // Agent type

  // Priority (higher = checked first)
  priority: number;

  // Status
  enabled: boolean;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Pairing request (for new senders)
 */
export interface PairingRequest {
  id: string;                     // Request ID
  orgId: string;                  // Organization ID
  channelConfigId: string;        // Channel config

  // Requester
  peer: Peer;                     // Who is requesting access
  conversationId?: string;        // Group ID (if group)
  scope: MessageScope;            // DM or group

  // Initial message
  firstMessage?: string;          // First message from requester

  // Status
  status: PairingStatus;
  reviewedBy?: string;            // Admin who reviewed
  reviewedAt?: number;            // Review timestamp
  expiresAt: number;              // Expiration timestamp

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Session registry entry
 */
export interface SessionEntry {
  sessionKey: string;             // Hierarchical session key
  orgId: string;                  // Organization ID
  channelType: ChannelType;       // Channel type
  scope: MessageScope;            // DM, group, or broadcast

  // Identity
  peer: Peer;                     // Primary peer
  conversationId?: string;        // Group/thread ID

  // Routing
  agentId: string;                // Which agent handles this
  agentStubId?: string;           // DO stub ID (if needed)

  // Security (OpenClaw pattern)
  trustTier?: string;             // operator, dm, or group

  // Metadata
  lastMessageAt: number;          // Last message timestamp
  messageCount: number;           // Total messages
  metadata?: Record<string, any>; // Session-specific data

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Session Key Parsing
// ============================================================================

/**
 * Parsed session key components
 * Format: agent:<orgId>:<channel>:<scope>:<id>
 */
export interface ParsedSessionKey {
  prefix: 'agent';                // Always 'agent'
  orgId: string;                  // Organization ID
  channelType: ChannelType;       // Channel type
  scope: MessageScope;            // DM, group, broadcast
  id: string;                     // Peer or conversation ID
  raw: string;                    // Original key
}

// ============================================================================
// Adapter Events
// ============================================================================

/**
 * Events emitted by channel adapters
 */
export interface AdapterEvents {
  message: (envelope: MessageEnvelope) => void;
  error: (error: Error) => void;
  connected: () => void;
  disconnected: () => void;
  delivery: (messageId: string, status: 'sent' | 'delivered' | 'read' | 'failed') => void;
}

// ============================================================================
// Channel Statistics
// ============================================================================

/**
 * Channel usage statistics
 */
export interface ChannelStats {
  channelConfigId: string;
  channelType: ChannelType;

  // Message counts
  messagesInbound: number;
  messagesOutbound: number;
  messagesTotal: number;

  // Session counts
  activeSessions: number;
  totalSessions: number;

  // Access control
  pairingRequestsPending: number;
  pairingRequestsApproved: number;
  pairingRequestsRejected: number;

  // Error tracking
  errorCount: number;
  lastError?: string;
  lastErrorAt?: number;

  // Timestamps
  periodStart: number;
  periodEnd: number;
}
