/**
 * Slack Channel Adapter
 *
 * Adapts Slack messages to the standardized MessageEnvelope format.
 * Supports DMs, channels, threads, and rich formatting.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer, MediaAttachment, ReplyContext } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// Slack Adapter
// ============================================================================

/**
 * Slack event payload (simplified)
 */
interface SlackMessageEvent {
  type: 'message';
  subtype?: string;
  channel: string;
  user: string;
  text: string;
  ts: string; // Timestamp (unique message ID)
  thread_ts?: string; // Thread parent timestamp
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
    size: number;
  }>;
  blocks?: any[]; // Block Kit formatting
}

/**
 * Slack channel info
 */
interface SlackChannel {
  id: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
}

/**
 * Slack adapter implementation
 */
export class SlackAdapter extends BaseChannelAdapter {
  // Slack message limit is 40,000 chars (very generous)
  private static readonly SLACK_CHAR_LIMIT = 40000;

  constructor(config: ChannelConfig) {
    super(ChannelType.SLACK, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Verify Slack credentials
    if (!this.config.settings.botToken) {
      throw new Error('Slack bot token not configured');
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
   * Normalize Slack event to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      orgId?: string;
      channelInfo?: SlackChannel;
      workspaceId?: string;
    },
  ): Promise<MessageEnvelope> {
    const msg = rawMessage as SlackMessageEvent;

    // Ignore bot messages and message edits
    if (msg.subtype === 'bot_message' || msg.subtype === 'message_changed') {
      throw new Error('Ignoring bot message or edit');
    }

    // Determine scope (DM vs channel vs thread)
    const isChannel = context?.channelInfo?.is_channel || context?.channelInfo?.is_group;
    const isDM = context?.channelInfo?.is_im;
    const scope = isDM ? MessageScope.DM : MessageScope.GROUP;

    // Create sender peer
    const sender: Peer = this.createPeer(
      msg.user,
      undefined, // Display name fetched separately
      {
        slackUserId: msg.user,
        workspaceId: context?.workspaceId,
      },
    );

    // Extract text (remove Slack formatting)
    const text = this.cleanSlackText(msg.text);

    // Extract media attachments
    const mediaAttachments = msg.files ? this.extractFiles(msg.files) : undefined;

    // Extract reply context (threads)
    const replyTo = msg.thread_ts && msg.thread_ts !== msg.ts
      ? { messageId: msg.thread_ts }
      : undefined;

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: msg.ts,
      channelType: ChannelType.SLACK,
      scope,

      sender,
      text,
      mediaAttachments,
      replyTo,

      orgId: context?.orgId || this.config.orgId,
      conversationId: msg.channel,
      sessionKey: scope === MessageScope.DM
        ? `agent:${context?.orgId || this.config.orgId}:slack:dm:${msg.user}`
        : `agent:${context?.orgId || this.config.orgId}:slack:group:${msg.channel}`,

      timestamp: parseFloat(msg.ts) * 1000, // Convert to ms

      isFromUser: true,

      channelMetadata: {
        slackChannelId: msg.channel,
        slackUserId: msg.user,
        slackMessageTs: msg.ts,
        threadTs: msg.thread_ts,
        workspaceId: context?.workspaceId,
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send message via Slack API
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Slack adapter not connected');
    }

    const { botToken } = this.config.settings;

    if (!botToken) {
      throw new Error('Slack bot token not configured');
    }

    // Extract channel from metadata or session key
    const channelId = message.metadata?.slackChannelId || this.extractChannelFromSessionKey(message.sessionKey);
    const threadTs = message.replyTo?.messageId;

    if (!channelId) {
      throw new Error('Cannot send Slack message: no channel ID');
    }

    // Chunk message if needed (unlikely with 40k limit)
    const chunks = this.chunkText(
      message.text,
      SlackAdapter.SLACK_CHAR_LIMIT,
      'newline',
    );

    // Send each chunk
    for (const chunk of chunks) {
      try {
        await this.postSlackMessage(botToken, channelId, chunk, threadTs);
        this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
      } catch (error) {
        this.emit('error', error as Error);
        throw error;
      }
    }

    // Send file attachments
    if (message.mediaAttachments && message.mediaAttachments.length > 0) {
      for (const media of message.mediaAttachments) {
        if (media.url) {
          await this.uploadSlackFile(botToken, channelId, media, threadTs);
        }
      }
    }
  }

  /**
   * Post message to Slack
   */
  private async postSlackMessage(
    token: string,
    channel: string,
    text: string,
    threadTs?: string,
  ): Promise<any> {
    const url = 'https://slack.com/api/chat.postMessage';

    const payload: any = {
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    };

    // Add thread context if replying
    if (threadTs) {
      payload.thread_ts = threadTs;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    const result = await response.json() as any;
    if (!result.ok) {
      throw new Error(`Slack error: ${result.error}`);
    }

    return result;
  }

  /**
   * Upload file to Slack
   */
  private async uploadSlackFile(
    token: string,
    channel: string,
    media: MediaAttachment,
    threadTs?: string,
  ): Promise<any> {
    const url = 'https://slack.com/api/files.upload';

    // Download file first
    if (!media.url) {
      throw new Error('No media URL provided');
    }

    const fileResponse = await fetch(media.url);
    const fileBlob = await fileResponse.blob();

    const formData = new FormData();
    formData.append('channels', channel);
    formData.append('file', fileBlob, media.filename || 'file');
    if (media.caption) {
      formData.append('initial_comment', media.caption);
    }
    if (threadTs) {
      formData.append('thread_ts', threadTs);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Slack file upload error: ${response.status}`);
    }

    const result = await response.json() as any;
    if (!result.ok) {
      throw new Error(`Slack error: ${result.error}`);
    }

    return result;
  }

  // ------------------------------------------------------------------------
  // Webhook handling
  // ------------------------------------------------------------------------

  async handleWebhookMessage(
    payload: any,
    headers?: Record<string, string>,
  ): Promise<void> {
    // Normalize and emit message
    const envelope = await this.normalize(payload.event, {
      orgId: this.config.orgId,
      workspaceId: payload.team_id,
    });
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
    return false; // Slack doesn't have read receipts in the traditional sense
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Clean Slack text formatting
   * Remove <@USER>, <#CHANNEL>, <!here>, etc.
   */
  private cleanSlackText(text: string): string {
    return text
      .replace(/<@([A-Z0-9]+)>/g, '@user') // User mentions
      .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2') // Channel mentions
      .replace(/<!(here|channel|everyone)>/g, '@$1') // Special mentions
      .replace(/<([^|>]+)\|([^>]+)>/g, '$2') // Links with labels
      .replace(/<([^>]+)>/g, '$1'); // Plain URLs
  }

  /**
   * Extract file attachments
   */
  private extractFiles(files: any[]): MediaAttachment[] {
    return files.map(file => ({
      type: this.getFileType(file.mimetype),
      url: file.url_private,
      filename: file.name,
      mimeType: file.mimetype,
      size: file.size,
      placeholder: `<${this.getFileType(file.mimetype)}:${file.name}>`,
      metadata: { slackFileId: file.id },
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
