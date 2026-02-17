/**
 * Discord Channel Adapter
 *
 * Adapts Discord messages to the standardized MessageEnvelope format.
 * Supports guilds, channels, threads, DMs, and embeds.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer, MediaAttachment, ReplyContext } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// Discord Adapter
// ============================================================================

/**
 * Discord message format
 */
interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  attachments?: Array<{
    id: string;
    filename: string;
    size: number;
    url: string;
    proxy_url: string;
    content_type?: string;
  }>;
  embeds?: any[];
  message_reference?: {
    message_id: string;
    channel_id: string;
  };
  referenced_message?: DiscordMessage;
  thread?: {
    id: string;
    name: string;
  };
}

/**
 * Discord adapter implementation
 */
export class DiscordAdapter extends BaseChannelAdapter {
  // Discord message limit is 2000 chars
  private static readonly DISCORD_CHAR_LIMIT = 2000;

  constructor(config: ChannelConfig) {
    super(ChannelType.DISCORD, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Verify Discord credentials
    if (!this.config.settings.botToken) {
      throw new Error('Discord bot token not configured');
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
   * Normalize Discord message to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      orgId?: string;
      isDM?: boolean;
    },
  ): Promise<MessageEnvelope> {
    const msg = rawMessage as DiscordMessage;

    // Ignore bot messages
    if (msg.author.bot) {
      throw new Error('Ignoring bot message');
    }

    // Determine scope
    const isDM = !msg.guild_id || context?.isDM;
    const scope = isDM ? MessageScope.DM : MessageScope.GROUP;

    // Create sender peer
    const sender: Peer = this.createPeer(
      msg.author.id,
      `${msg.author.username}#${msg.author.discriminator}`,
      {
        discordUserId: msg.author.id,
        discordUsername: msg.author.username,
        guildId: msg.guild_id,
      },
    );

    // Extract text (remove Discord formatting)
    const text = this.cleanDiscordText(msg.content);

    // Extract media attachments
    const mediaAttachments = msg.attachments && msg.attachments.length > 0
      ? this.extractAttachments(msg.attachments)
      : undefined;

    // Extract reply context
    const replyTo = msg.message_reference
      ? {
          messageId: msg.message_reference.message_id,
          text: msg.referenced_message?.content,
        }
      : undefined;

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: msg.id,
      channelType: ChannelType.DISCORD,
      scope,

      sender,
      text,
      mediaAttachments,
      replyTo,

      orgId: context?.orgId || this.config.orgId,
      conversationId: msg.channel_id,
      sessionKey: scope === MessageScope.DM
        ? `agent:${context?.orgId || this.config.orgId}:discord:dm:${msg.author.id}`
        : `agent:${context?.orgId || this.config.orgId}:discord:group:${msg.channel_id}`,

      timestamp: new Date(msg.timestamp).getTime(),

      isFromUser: true,

      channelMetadata: {
        discordMessageId: msg.id,
        discordChannelId: msg.channel_id,
        discordGuildId: msg.guild_id,
        discordUserId: msg.author.id,
        isThread: !!msg.thread,
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send message via Discord API
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Discord adapter not connected');
    }

    const { botToken } = this.config.settings;

    if (!botToken) {
      throw new Error('Discord bot token not configured');
    }

    // Extract channel from metadata or session key
    const channelId = message.metadata?.discordChannelId || this.extractChannelFromSessionKey(message.sessionKey);

    if (!channelId) {
      throw new Error('Cannot send Discord message: no channel ID');
    }

    // Chunk message if needed
    const chunks = this.chunkText(
      message.text,
      DiscordAdapter.DISCORD_CHAR_LIMIT,
      'word',
    );

    // Send each chunk
    for (const chunk of chunks) {
      try {
        await this.postDiscordMessage(
          botToken,
          channelId,
          chunk,
          message.replyTo?.messageId,
        );
        this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
      } catch (error) {
        this.emit('error', error as Error);
        throw error;
      }
    }
  }

  /**
   * Post message to Discord
   */
  private async postDiscordMessage(
    token: string,
    channelId: string,
    content: string,
    replyToMessageId?: string,
  ): Promise<any> {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    const payload: any = {
      content,
    };

    // Add reply reference if replying
    if (replyToMessageId) {
      payload.message_reference = {
        message_id: replyToMessageId,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} ${error}`);
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
    return false;
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Clean Discord text formatting
   * Remove <@USER_ID>, <#CHANNEL_ID>, <:emoji:ID>, etc.
   */
  private cleanDiscordText(text: string): string {
    return text
      .replace(/<@!?(\d+)>/g, '@user') // User mentions
      .replace(/<#(\d+)>/g, '#channel') // Channel mentions
      .replace(/<@&(\d+)>/g, '@role') // Role mentions
      .replace(/<a?:(\w+):(\d+)>/g, ':$1:') // Custom emojis
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1') // Italic
      .replace(/__(.+?)__/g, '$1') // Underline
      .replace(/~~(.+?)~~/g, '$1') // Strikethrough
      .replace(/`(.+?)`/g, '$1'); // Inline code
  }

  /**
   * Extract file attachments
   */
  private extractAttachments(attachments: any[]): MediaAttachment[] {
    return attachments.map(att => ({
      type: this.getFileType(att.content_type || ''),
      url: att.url,
      filename: att.filename,
      size: att.size,
      mimeType: att.content_type,
      placeholder: `<${this.getFileType(att.content_type || '')}:${att.filename}>`,
      metadata: { discordAttachmentId: att.id },
    }));
  }

  /**
   * Get file type from MIME type
   */
  private getFileType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Extract channel ID from session key
   */
  private extractChannelFromSessionKey(sessionKey: string): string | null {
    const parts = sessionKey.split(':');
    if (parts.length >= 5) {
      return parts[4]; // channel or user ID
    }
    return null;
  }
}
