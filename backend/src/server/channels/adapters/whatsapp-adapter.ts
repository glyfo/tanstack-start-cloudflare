/**
 * WhatsApp Channel Adapter
 *
 * Adapts WhatsApp Cloud API messages to the standardized MessageEnvelope format.
 * Handles media attachments, 4000 char chunking, reply context, and groups.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer, MediaAttachment, ReplyContext } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// WhatsApp Adapter
// ============================================================================

/**
 * WhatsApp webhook message format (simplified)
 */
interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location';
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string };
  context?: {
    from: string;
    id: string;
  };
}

/**
 * WhatsApp adapter implementation
 */
export class WhatsAppAdapter extends BaseChannelAdapter {
  // WhatsApp Cloud API limit is 4096 chars (we use 4000 for safety)
  private static readonly WHATSAPP_CHAR_LIMIT = 4000;

  constructor(config: ChannelConfig) {
    super(ChannelType.WHATSAPP, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Verify WhatsApp credentials
    if (!this.config.settings.phoneNumberId || !this.config.settings.accessToken) {
      throw new Error('WhatsApp credentials not configured');
    }

    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  // ------------------------------------------------------------------------
  // Message normalization
  // ------------------------------------------------------------------------

  /**
   * Normalize WhatsApp webhook message to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      orgId?: string;
      conversationId?: string;
      isGroup?: boolean;
    },
  ): Promise<MessageEnvelope> {
    const msg = rawMessage as WhatsAppMessage;

    // Determine scope (DM or group)
    const scope = context?.isGroup ? MessageScope.GROUP : MessageScope.DM;

    // Create sender peer
    const sender: Peer = this.createPeer(
      msg.from,
      undefined, // Display name will be fetched separately if needed
      {
        whatsappId: msg.from,
      },
    );

    // Extract text content
    let text = '';
    if (msg.type === 'text' && msg.text) {
      text = msg.text.body;
    } else if (msg.type === 'image' && msg.image?.caption) {
      text = msg.image.caption;
    } else if (msg.type === 'video' && msg.video?.caption) {
      text = msg.video.caption;
    } else if (msg.type === 'document' && msg.document?.caption) {
      text = msg.document.caption;
    } else if (msg.type === 'location' && msg.location?.name) {
      text = msg.location.name;
    }

    // Extract media attachments
    const mediaAttachments = await this.extractMediaAttachments(msg);

    // Extract reply context
    const replyTo = msg.context ? this.extractReplyContext(msg.context) : undefined;

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: msg.id,
      channelType: ChannelType.WHATSAPP,
      scope,

      sender,
      text,
      mediaAttachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,
      replyTo,

      orgId: context?.orgId || this.config.orgId,
      conversationId: context?.conversationId,
      sessionKey: scope === MessageScope.GROUP
        ? `agent:${context?.orgId || this.config.orgId}:whatsapp:group:${context?.conversationId}`
        : `agent:${context?.orgId || this.config.orgId}:whatsapp:dm:${msg.from}`,

      timestamp: parseInt(msg.timestamp) * 1000, // Convert to ms

      isFromUser: true,

      channelMetadata: {
        whatsappMessageId: msg.id,
        whatsappFrom: msg.from,
        messageType: msg.type,
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send message via WhatsApp Cloud API
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('WhatsApp adapter not connected');
    }

    const { phoneNumberId, accessToken } = this.config.settings;

    if (!phoneNumberId || !accessToken) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Extract recipient WhatsApp ID
    const recipientId = message.recipient.id;

    // Chunk message if needed
    const chunks = this.chunkText(
      message.text,
      WhatsAppAdapter.WHATSAPP_CHAR_LIMIT,
      this.config.chunkMode || 'newline',
    );

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLast = i === chunks.length - 1;

      try {
        await this.sendWhatsAppMessage(
          phoneNumberId,
          accessToken,
          recipientId,
          chunk,
          message.replyTo?.messageId,
        );

        // Emit delivery event
        this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
      } catch (error) {
        this.emit('error', error as Error);
        throw error;
      }

      // Small delay between chunks
      if (!isLast) {
        await this.sleep(500);
      }
    }

    // Send media attachments if present
    if (message.mediaAttachments && message.mediaAttachments.length > 0) {
      for (const media of message.mediaAttachments) {
        if (media.url) {
          await this.sendWhatsAppMedia(
            phoneNumberId,
            accessToken,
            recipientId,
            media,
          );
        }
      }
    }
  }

  /**
   * Send text message via WhatsApp Cloud API
   */
  private async sendWhatsAppMessage(
    phoneNumberId: string,
    accessToken: string,
    recipientId: string,
    text: string,
    replyToMessageId?: string,
  ): Promise<any> {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientId,
      type: 'text',
      text: { body: text },
    };

    // Add reply context if provided
    if (replyToMessageId) {
      payload.context = {
        message_id: replyToMessageId,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    return await response.json();
  }

  /**
   * Send media message via WhatsApp Cloud API
   */
  private async sendWhatsAppMedia(
    phoneNumberId: string,
    accessToken: string,
    recipientId: string,
    media: MediaAttachment,
  ): Promise<any> {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    // Determine media type
    const mediaType = this.getWhatsAppMediaType(media.type);

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientId,
      type: mediaType,
      [mediaType]: {
        link: media.url,
      },
    };

    // Add caption for supported types
    if (media.caption && ['image', 'video', 'document'].includes(mediaType)) {
      payload[mediaType].caption = media.caption;
    }

    // Add filename for documents
    if (media.filename && mediaType === 'document') {
      payload[mediaType].filename = media.filename;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${error}`);
    }

    return await response.json();
  }

  // ------------------------------------------------------------------------
  // Webhook handling
  // ------------------------------------------------------------------------

  async handleWebhookMessage(
    payload: any,
    headers?: Record<string, string>,
  ): Promise<void> {
    // Normalize and emit message
    // Context (orgId, isGroup) should be determined by webhook handler
    const envelope = await this.normalize(payload);
    this.emit('message', envelope);
  }

  // ------------------------------------------------------------------------
  // Capabilities
  // ------------------------------------------------------------------------

  supportsMedia(): boolean {
    return true;
  }

  supportsGroups(): boolean {
    return true;
  }

  supportsReadReceipts(): boolean {
    return true; // WhatsApp supports read receipts
  }

  // ------------------------------------------------------------------------
  // Media handling
  // ------------------------------------------------------------------------

  /**
   * Extract media attachments from WhatsApp message
   */
  private async extractMediaAttachments(msg: WhatsAppMessage): Promise<MediaAttachment[]> {
    const attachments: MediaAttachment[] = [];

    switch (msg.type) {
      case 'image':
        if (msg.image) {
          attachments.push({
            type: 'image',
            mimeType: msg.image.mime_type,
            caption: msg.image.caption,
            placeholder: '<image>',
            metadata: { mediaId: msg.image.id },
          });
        }
        break;

      case 'video':
        if (msg.video) {
          attachments.push({
            type: 'video',
            mimeType: msg.video.mime_type,
            caption: msg.video.caption,
            placeholder: '<video>',
            metadata: { mediaId: msg.video.id },
          });
        }
        break;

      case 'audio':
        if (msg.audio) {
          attachments.push({
            type: 'audio',
            mimeType: msg.audio.mime_type,
            placeholder: '<audio>',
            metadata: { mediaId: msg.audio.id },
          });
        }
        break;

      case 'document':
        if (msg.document) {
          attachments.push({
            type: 'document',
            mimeType: msg.document.mime_type,
            filename: msg.document.filename,
            caption: msg.document.caption,
            placeholder: '<document>',
            metadata: { mediaId: msg.document.id },
          });
        }
        break;

      case 'sticker':
        if (msg.sticker) {
          attachments.push({
            type: 'sticker',
            mimeType: msg.sticker.mime_type,
            placeholder: '<sticker>',
            metadata: { mediaId: msg.sticker.id },
          });
        }
        break;

      case 'location':
        if (msg.location) {
          attachments.push({
            type: 'location',
            placeholder: `<location: ${msg.location.name || 'Location'}>`,
            metadata: {
              latitude: msg.location.latitude,
              longitude: msg.location.longitude,
              name: msg.location.name,
            },
          });
        }
        break;
    }

    return attachments;
  }

  /**
   * Extract reply context from WhatsApp message
   */
  private extractReplyContext(context: { from: string; id: string }): ReplyContext {
    return {
      messageId: context.id,
      sender: this.createPeer(context.from),
    };
  }

  /**
   * Download WhatsApp media file
   * (For future implementation - download media to R2)
   */
  private async downloadWhatsAppMedia(mediaId: string, accessToken: string): Promise<Blob> {
    // Step 1: Get media URL
    const metaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;
    const metaResponse = await fetch(metaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!metaResponse.ok) {
      throw new Error('Failed to get media URL');
    }

    const meta = await metaResponse.json() as any;
    const mediaUrl = meta.url;

    // Step 2: Download media
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      throw new Error('Failed to download media');
    }

    return await mediaResponse.blob();
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Get WhatsApp media type from generic media type
   */
  private getWhatsAppMediaType(type: string): string {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'audio':
        return 'audio';
      case 'document':
        return 'document';
      case 'sticker':
        return 'sticker';
      default:
        return 'document';
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
