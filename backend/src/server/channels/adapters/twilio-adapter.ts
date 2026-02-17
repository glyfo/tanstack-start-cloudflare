/**
 * Twilio SMS Channel Adapter
 *
 * Adapts Twilio SMS messages to the standardized MessageEnvelope format.
 * Handles SMS sending via Twilio API with 1600 character limit.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// Twilio SMS Adapter
// ============================================================================

/**
 * Twilio webhook payload format
 */
interface TwilioWebhookPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  [key: string]: string | undefined;
}

/**
 * Twilio adapter implementation
 */
export class TwilioAdapter extends BaseChannelAdapter {
  // Twilio SMS limit is 1600 chars (for concatenated messages)
  private static readonly SMS_CHAR_LIMIT = 1600;

  constructor(config: ChannelConfig) {
    super(ChannelType.SMS, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Verify Twilio credentials
    if (!this.config.settings.accountSid || !this.config.settings.authToken) {
      throw new Error('Twilio credentials not configured');
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
   * Normalize Twilio webhook payload to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      orgId?: string;
    },
  ): Promise<MessageEnvelope> {
    const payload = rawMessage as TwilioWebhookPayload;

    // Extract phone numbers
    const fromNumber = this.normalizePhoneNumber(payload.From);
    const toNumber = this.normalizePhoneNumber(payload.To);

    // Create sender peer
    const sender: Peer = this.createPeer(
      fromNumber,
      fromNumber, // Use phone number as display name
      {
        rawFrom: payload.From,
        rawTo: payload.To,
      },
    );

    // Check for media attachments
    const mediaAttachments: any[] = [];
    if (payload.NumMedia && parseInt(payload.NumMedia) > 0) {
      for (let i = 0; i < parseInt(payload.NumMedia); i++) {
        const mediaUrl = payload[`MediaUrl${i}`];
        const mediaType = payload[`MediaContentType${i}`];

        if (mediaUrl) {
          mediaAttachments.push({
            type: this.getMediaType(mediaType || ''),
            url: mediaUrl,
            mimeType: mediaType,
            placeholder: `<media:${this.getMediaType(mediaType || '')}>`,
          });
        }
      }
    }

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: payload.MessageSid,
      channelType: ChannelType.SMS,
      scope: MessageScope.DM, // SMS is always DM

      sender,
      text: payload.Body || '',
      mediaAttachments: mediaAttachments.length > 0 ? mediaAttachments : undefined,

      orgId: context?.orgId || this.config.orgId,
      sessionKey: `agent:${context?.orgId || this.config.orgId}:sms:dm:${fromNumber}`,

      timestamp: Date.now(),
      isFromUser: true,

      channelMetadata: {
        twilioMessageSid: payload.MessageSid,
        fromNumber: payload.From,
        toNumber: payload.To,
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send SMS via Twilio API
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Twilio adapter not connected');
    }

    const { accountSid, authToken, phoneNumber } = this.config.settings;

    if (!accountSid || !authToken || !phoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // Extract recipient phone number
    const toNumber = message.recipient.id;

    // Chunk message if needed
    const chunks = this.chunkText(
      message.text,
      TwilioAdapter.SMS_CHAR_LIMIT,
      this.config.chunkMode || 'word',
    );

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLast = i === chunks.length - 1;

      // Add chunk indicator if multiple chunks
      const text = chunks.length > 1
        ? `[${i + 1}/${chunks.length}] ${chunk}`
        : chunk;

      try {
        await this.sendSMS(accountSid, authToken, phoneNumber, toNumber, text);

        // Emit delivery event
        this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
      } catch (error) {
        this.emit('error', error as Error);
        throw error;
      }

      // Rate limit: wait between chunks (Twilio rate limits: 1 msg/sec per number)
      if (!isLast) {
        await this.sleep(1000);
      }
    }
  }

  /**
   * Send SMS via Twilio API
   */
  private async sendSMS(
    accountSid: string,
    authToken: string,
    fromNumber: string,
    toNumber: string,
    body: string,
  ): Promise<any> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    // Encode credentials for Basic Auth
    const credentials = btoa(`${accountSid}:${authToken}`);

    // Build form data
    const formData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: body,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${error}`);
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
    // Verify Twilio signature (optional but recommended)
    // Implementation depends on Twilio signature verification

    // Normalize and emit message
    const envelope = await this.normalize(payload);
    this.emit('message', envelope);
  }

  // ------------------------------------------------------------------------
  // Capabilities
  // ------------------------------------------------------------------------

  supportsMedia(): boolean {
    return true; // SMS supports MMS media
  }

  supportsGroups(): boolean {
    return false; // SMS is 1:1 only
  }

  supportsReadReceipts(): boolean {
    return false; // SMS doesn't support read receipts natively
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure E.164 format (starts with +)
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code
      normalized = '+1' + normalized;
    }

    return normalized;
  }

  /**
   * Get media type from MIME type
   */
  private getMediaType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
