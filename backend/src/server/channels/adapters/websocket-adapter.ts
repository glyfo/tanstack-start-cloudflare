/**
 * WebSocket Channel Adapter
 *
 * Adapts WebSocket messages to the standardized MessageEnvelope format.
 * Wraps existing ChatAgent WebSocket logic.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// WebSocket Adapter
// ============================================================================

/**
 * WebSocket connection info
 */
interface WebSocketConnection {
  ws: WebSocket;
  sessionId: string;
  userId?: string;
  orgId: string;
  metadata?: Record<string, any>;
}

/**
 * WebSocket message format (from frontend)
 */
interface WebSocketMessage {
  type: 'message' | 'ping' | 'pong' | 'typing' | 'state';
  sessionId?: string;
  content?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

/**
 * WebSocket adapter implementation
 */
export class WebSocketAdapter extends BaseChannelAdapter {
  private connections: Map<string, WebSocketConnection> = new Map();

  constructor(config: ChannelConfig) {
    super(ChannelType.WEBSOCKET, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // WebSocket adapter doesn't maintain persistent connection
    // Connections are managed per WebSocket client
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    // Close all active connections
    for (const [sessionId, conn] of this.connections) {
      try {
        conn.ws.close();
      } catch (error) {
        console.error(`Error closing WebSocket for session ${sessionId}:`, error);
      }
    }
    this.connections.clear();
    this.connected = false;
    this.emit('disconnected');
  }

  // ------------------------------------------------------------------------
  // Connection management
  // ------------------------------------------------------------------------

  /**
   * Register a WebSocket connection
   */
  registerConnection(ws: WebSocket, sessionId: string, orgId: string, metadata?: Record<string, any>): void {
    this.connections.set(sessionId, {
      ws,
      sessionId,
      orgId,
      metadata,
    });
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(sessionId: string): void {
    this.connections.delete(sessionId);
  }

  /**
   * Get connection info
   */
  getConnection(sessionId: string): WebSocketConnection | undefined {
    return this.connections.get(sessionId);
  }

  // ------------------------------------------------------------------------
  // Message normalization
  // ------------------------------------------------------------------------

  /**
   * Normalize WebSocket message to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      sessionId?: string;
      userId?: string;
      orgId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<MessageEnvelope> {
    const msg = rawMessage as WebSocketMessage;
    const sessionId = msg.sessionId || context?.sessionId || 'unknown';
    const orgId = context?.orgId || this.config.orgId;

    // Extract content
    const text = msg.content || '';

    // Create sender peer
    const sender: Peer = this.createPeer(
      context?.userId || sessionId,
      context?.metadata?.displayName,
      {
        sessionId,
        ...context?.metadata,
      },
    );

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: this.generateMessageId(),
      channelType: ChannelType.WEBSOCKET,
      scope: MessageScope.DM, // WebSocket is always DM

      sender,
      text,

      orgId,
      sessionKey: `agent:${orgId}:websocket:dm:${sender.id}`,

      timestamp: msg.timestamp || Date.now(),
      isFromUser: true,

      channelMetadata: {
        ...msg.metadata,
        sessionId,
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send message via WebSocket
   */
  async send(message: OutboundMessage): Promise<void> {
    // Extract session ID from session key or metadata
    const sessionId = message.metadata?.sessionId || this.extractSessionId(message.sessionKey);

    if (!sessionId) {
      throw new Error('Cannot send WebSocket message: no sessionId');
    }

    const conn = this.connections.get(sessionId);
    if (!conn) {
      throw new Error(`WebSocket connection not found for session: ${sessionId}`);
    }

    // Check if WebSocket is open
    if (conn.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not open for session: ${sessionId}`);
    }

    // Build WebSocket message
    const wsMessage = {
      type: 'message',
      content: message.text,
      timestamp: Date.now(),
      metadata: message.metadata,
    };

    // Send via WebSocket
    try {
      conn.ws.send(JSON.stringify(wsMessage));
      this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Broadcast message to all connections for a session
   */
  async broadcast(message: OutboundMessage): Promise<void> {
    const sessionId = message.metadata?.sessionId || this.extractSessionId(message.sessionKey);

    if (!sessionId) {
      throw new Error('Cannot broadcast: no sessionId');
    }

    // For now, WebSocket adapter doesn't support true broadcast
    // Just send to the primary connection
    await this.send(message);
  }

  // ------------------------------------------------------------------------
  // Capabilities
  // ------------------------------------------------------------------------

  supportsMedia(): boolean {
    return false; // WebSocket chat doesn't support media (yet)
  }

  supportsGroups(): boolean {
    return false; // WebSocket is 1:1 only
  }

  supportsReadReceipts(): boolean {
    return false; // Not implemented yet
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Extract session ID from session key
   * Format: agent:<orgId>:websocket:dm:<sessionId>
   */
  private extractSessionId(sessionKey: string): string | null {
    const parts = sessionKey.split(':');
    if (parts.length === 5 && parts[2] === 'websocket') {
      return parts[4];
    }
    return null;
  }
}
