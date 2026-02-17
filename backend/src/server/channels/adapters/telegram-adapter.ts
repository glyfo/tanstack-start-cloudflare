/**
 * Telegram Channel Adapter
 *
 * Adapts Telegram messages to the standardized MessageEnvelope format.
 * Supports bots, groups, channels, and rich media.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer, MediaAttachment, ReplyContext } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// Telegram Adapter
// ============================================================================

/**
 * Telegram message format
 */
interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    duration: number;
    mime_type?: string;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size: number;
  };
  audio?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size: number;
  };
  voice?: {
    file_id: string;
    file_unique_id: string;
    duration: number;
    mime_type?: string;
    file_size: number;
  };
  sticker?: {
    file_id: string;
    file_unique_id: string;
    emoji?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  reply_to_message?: TelegramMessage;
}

/**
 * Telegram adapter implementation
 */
export class TelegramAdapter extends BaseChannelAdapter {
  // Telegram message limit is 4096 chars
  private static readonly TELEGRAM_CHAR_LIMIT = 4096;

  constructor(config: ChannelConfig) {
    super(ChannelType.TELEGRAM, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Verify Telegram credentials
    if (!this.config.settings.botToken) {
      throw new Error('Telegram bot token not configured');
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
   * Normalize Telegram message to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      orgId?: string;
    },
  ): Promise<MessageEnvelope> {
    const msg = rawMessage as TelegramMessage;

    // Ignore bot messages
    if (msg.from.is_bot) {
      throw new Error('Ignoring bot message');
    }

    // Determine scope
    const isPrivate = msg.chat.type === 'private';
    const scope = isPrivate ? MessageScope.DM : MessageScope.GROUP;

    // Create sender peer
    const displayName = [msg.from.first_name, msg.from.last_name]
      .filter(Boolean)
      .join(' ');

    const sender: Peer = this.createPeer(
      msg.from.id.toString(),
      displayName || msg.from.username,
      {
        telegramUserId: msg.from.id,
        telegramUsername: msg.from.username,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
      },
    );

    // Extract text
    const text = msg.text || msg.caption || '';

    // Extract media attachments
    const mediaAttachments = this.extractMedia(msg);

    // Extract reply context
    const replyTo = msg.reply_to_message
      ? {
          messageId: msg.reply_to_message.message_id.toString(),
          text: msg.reply_to_message.text || msg.reply_to_message.caption,
        }
      : undefined;

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: msg.message_id.toString(),
      channelType: ChannelType.TELEGRAM,
      scope,

      sender,
      text,
      mediaAttachments,
      replyTo,

      orgId: context?.orgId || this.config.orgId,
      conversationId: msg.chat.id.toString(),
      sessionKey: scope === MessageScope.DM
        ? `agent:${context?.orgId || this.config.orgId}:telegram:dm:${msg.from.id}`
        : `agent:${context?.orgId || this.config.orgId}:telegram:group:${msg.chat.id}`,

      timestamp: msg.date * 1000, // Convert to ms

      isFromUser: true,

      channelMetadata: {
        telegramMessageId: msg.message_id,
        telegramChatId: msg.chat.id,
        telegramUserId: msg.from.id,
        chatType: msg.chat.type,
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send message via Telegram API
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Telegram adapter not connected');
    }

    const { botToken } = this.config.settings;

    if (!botToken) {
      throw new Error('Telegram bot token not configured');
    }

    // Extract chat ID from metadata or session key
    const chatId = message.metadata?.telegramChatId || this.extractChatIdFromSessionKey(message.sessionKey);

    if (!chatId) {
      throw new Error('Cannot send Telegram message: no chat ID');
    }

    // Chunk message if needed
    const chunks = this.chunkText(
      message.text,
      TelegramAdapter.TELEGRAM_CHAR_LIMIT,
      'newline',
    );

    // Send each chunk
    for (const chunk of chunks) {
      try {
        await this.sendTelegramMessage(
          botToken,
          chatId,
          chunk,
          message.replyTo?.messageId,
        );
        this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
      } catch (error) {
        this.emit('error', error as Error);
        throw error;
      }
    }

    // Send media attachments
    if (message.mediaAttachments && message.mediaAttachments.length > 0) {
      for (const media of message.mediaAttachments) {
        if (media.url) {
          await this.sendTelegramMedia(botToken, chatId, media);
        }
      }
    }
  }

  /**
   * Send text message to Telegram
   */
  private async sendTelegramMessage(
    token: string,
    chatId: string,
    text: string,
    replyToMessageId?: string,
  ): Promise<any> {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };

    // Add reply reference if replying
    if (replyToMessageId) {
      payload.reply_to_message_id = parseInt(replyToMessageId);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${error}`);
    }

    const result = await response.json() as any;
    if (!result.ok) {
      throw new Error(`Telegram error: ${result.description}`);
    }

    return result.result;
  }

  /**
   * Send media message to Telegram
   */
  private async sendTelegramMedia(
    token: string,
    chatId: string,
    media: MediaAttachment,
  ): Promise<any> {
    const baseUrl = `https://api.telegram.org/bot${token}`;

    // Determine method based on media type
    let method = 'sendDocument';
    if (media.type === 'image') method = 'sendPhoto';
    else if (media.type === 'video') method = 'sendVideo';
    else if (media.type === 'audio') method = 'sendAudio';

    const url = `${baseUrl}/${method}`;

    const payload: any = {
      chat_id: chatId,
    };

    // Set the appropriate media field
    const mediaField = method.replace('send', '').toLowerCase();
    payload[mediaField] = media.url;

    // Add caption if provided
    if (media.caption) {
      payload.caption = media.caption;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${error}`);
    }

    const result = await response.json() as any;
    if (!result.ok) {
      throw new Error(`Telegram error: ${result.description}`);
    }

    return result.result;
  }

  // ------------------------------------------------------------------------
  // Webhook handling
  // ------------------------------------------------------------------------

  async handleWebhookMessage(
    payload: any,
    headers?: Record<string, string>,
  ): Promise<void> {
    // Telegram sends updates as { update_id, message }
    const message = payload.message || payload.edited_message;
    if (!message) {
      throw new Error('No message in update');
    }

    // Normalize and emit message
    const envelope = await this.normalize(message);
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
    return false;
  }

  // ------------------------------------------------------------------------
  // Media handling
  // ------------------------------------------------------------------------

  /**
   * Extract media attachments from Telegram message
   */
  private extractMedia(msg: TelegramMessage): MediaAttachment[] | undefined {
    const attachments: MediaAttachment[] = [];

    // Photo (array of different sizes)
    if (msg.photo && msg.photo.length > 0) {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      attachments.push({
        type: 'image',
        placeholder: '<image>',
        metadata: { telegramFileId: largestPhoto.file_id },
      });
    }

    // Video
    if (msg.video) {
      attachments.push({
        type: 'video',
        mimeType: msg.video.mime_type,
        placeholder: '<video>',
        metadata: { telegramFileId: msg.video.file_id },
      });
    }

    // Document
    if (msg.document) {
      attachments.push({
        type: 'document',
        filename: msg.document.file_name,
        mimeType: msg.document.mime_type,
        size: msg.document.file_size,
        placeholder: `<document:${msg.document.file_name || 'file'}>`,
        metadata: { telegramFileId: msg.document.file_id },
      });
    }

    // Audio
    if (msg.audio) {
      attachments.push({
        type: 'audio',
        mimeType: msg.audio.mime_type,
        placeholder: '<audio>',
        metadata: { telegramFileId: msg.audio.file_id },
      });
    }

    // Voice
    if (msg.voice) {
      attachments.push({
        type: 'audio',
        mimeType: msg.voice.mime_type,
        placeholder: '<voice message>',
        metadata: { telegramFileId: msg.voice.file_id },
      });
    }

    // Sticker
    if (msg.sticker) {
      attachments.push({
        type: 'sticker',
        placeholder: `<sticker${msg.sticker.emoji ? ': ' + msg.sticker.emoji : ''}>`,
        metadata: { telegramFileId: msg.sticker.file_id },
      });
    }

    // Location
    if (msg.location) {
      attachments.push({
        type: 'location',
        placeholder: '<location>',
        metadata: {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
        },
      });
    }

    return attachments.length > 0 ? attachments : undefined;
  }

  /**
   * Extract chat ID from session key
   */
  private extractChatIdFromSessionKey(sessionKey: string): string | null {
    const parts = sessionKey.split(':');
    if (parts.length >= 5) {
      return parts[4]; // chat or user ID
    }
    return null;
  }
}
