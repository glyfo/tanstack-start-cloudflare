/**
 * Channel Adapter Interface and Base Class
 *
 * Defines the contract for channel implementations.
 * All channels (WebSocket, WhatsApp, SMS, etc) implement this interface.
 */

import type {
  ChannelType,
  ChannelConfig,
  MessageEnvelope,
  OutboundMessage,
  Peer,
  AdapterEvents,
} from './types';

// ============================================================================
// Channel Adapter Interface
// ============================================================================

/**
 * Channel adapter interface
 * All channel implementations must implement these methods
 */
export interface ChannelAdapter {
  // Identity
  readonly channelType: ChannelType;
  readonly config: ChannelConfig;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Message handling
  normalize(rawMessage: any, context?: any): Promise<MessageEnvelope>;
  send(message: OutboundMessage): Promise<void>;

  // Event handling
  on<K extends keyof AdapterEvents>(event: K, handler: AdapterEvents[K]): void;
  off<K extends keyof AdapterEvents>(event: K, handler: AdapterEvents[K]): void;

  // Channel-specific capabilities
  supportsMedia(): boolean;
  supportsGroups(): boolean;
  supportsReadReceipts(): boolean;

  // Webhook handling (for webhook-based channels)
  handleWebhookMessage?(payload: any, headers?: Record<string, string>): Promise<void>;
}

// ============================================================================
// Base Channel Adapter
// ============================================================================

/**
 * Base adapter with common functionality
 */
export abstract class BaseChannelAdapter implements ChannelAdapter {
  protected eventHandlers: Partial<Record<keyof AdapterEvents, Function[]>> = {};
  protected connected: boolean = false;

  constructor(
    public readonly channelType: ChannelType,
    public readonly config: ChannelConfig,
  ) {}

  // ------------------------------------------------------------------------
  // Abstract methods (must be implemented by subclasses)
  // ------------------------------------------------------------------------

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract normalize(rawMessage: any, context?: any): Promise<MessageEnvelope>;
  abstract send(message: OutboundMessage): Promise<void>;

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  isConnected(): boolean {
    return this.connected;
  }

  // ------------------------------------------------------------------------
  // Event handling
  // ------------------------------------------------------------------------

  on<K extends keyof AdapterEvents>(event: K, handler: AdapterEvents[K]): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]!.push(handler as Function);
  }

  off<K extends keyof AdapterEvents>(event: K, handler: AdapterEvents[K]): void {
    const handlers = this.eventHandlers[event];
    if (!handlers) return;

    const index = handlers.indexOf(handler as Function);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  protected emit<K extends keyof AdapterEvents>(
    event: K,
    ...args: Parameters<AdapterEvents[K]>
  ): void {
    const handlers = this.eventHandlers[event];
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    }
  }

  // ------------------------------------------------------------------------
  // Default capabilities (can be overridden)
  // ------------------------------------------------------------------------

  supportsMedia(): boolean {
    return false; // Override in subclasses that support media
  }

  supportsGroups(): boolean {
    return false; // Override in subclasses that support groups
  }

  supportsReadReceipts(): boolean {
    return false; // Override in subclasses that support read receipts
  }

  // ------------------------------------------------------------------------
  // Webhook handling (optional)
  // ------------------------------------------------------------------------

  async handleWebhookMessage(
    payload: any,
    headers?: Record<string, string>,
  ): Promise<void> {
    throw new Error('handleWebhookMessage not implemented');
  }

  // ------------------------------------------------------------------------
  // Utility methods
  // ------------------------------------------------------------------------

  /**
   * Chunk long text into multiple messages
   */
  protected chunkText(text: string, maxLength: number, mode: 'newline' | 'word' | 'char' = 'newline'): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];

    switch (mode) {
      case 'newline': {
        // Split by paragraphs/newlines first
        const paragraphs = text.split(/\n+/);
        let currentChunk = '';

        for (const para of paragraphs) {
          if (currentChunk.length + para.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? '\n' : '') + para;
          } else {
            if (currentChunk) chunks.push(currentChunk);

            // If single paragraph is too long, fall back to word splitting
            if (para.length > maxLength) {
              chunks.push(...this.chunkText(para, maxLength, 'word'));
              currentChunk = '';
            } else {
              currentChunk = para;
            }
          }
        }

        if (currentChunk) chunks.push(currentChunk);
        break;
      }

      case 'word': {
        // Split by words
        const words = text.split(/\s+/);
        let currentChunk = '';

        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) chunks.push(currentChunk);

            // If single word is too long, fall back to char splitting
            if (word.length > maxLength) {
              chunks.push(...this.chunkText(word, maxLength, 'char'));
              currentChunk = '';
            } else {
              currentChunk = word;
            }
          }
        }

        if (currentChunk) chunks.push(currentChunk);
        break;
      }

      case 'char': {
        // Split by characters (last resort)
        for (let i = 0; i < text.length; i += maxLength) {
          chunks.push(text.slice(i, i + maxLength));
        }
        break;
      }
    }

    return chunks;
  }

  /**
   * Create a Peer object from channel-specific identifier
   */
  protected createPeer(id: string, displayName?: string, metadata?: Record<string, any>): Peer {
    return {
      id,
      displayName,
      channelType: this.channelType,
      metadata,
    };
  }

  /**
   * Generate unique message ID
   */
  protected generateMessageId(): string {
    return `${this.channelType}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
