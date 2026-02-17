/**
 * Email Channel Adapter
 *
 * Adapts email messages to the standardized MessageEnvelope format.
 * Supports inbound email via Cloudflare Email Workers and outbound via SMTP.
 */

import { BaseChannelAdapter } from '../channel-adapter';
import type { ChannelConfig, MessageEnvelope, OutboundMessage, Peer, MediaAttachment } from '../types';
import { ChannelType, MessageScope } from '../types';

// ============================================================================
// Email Adapter
// ============================================================================

/**
 * Email message format (Cloudflare Email Workers)
 */
interface EmailMessage {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  headers: Map<string, string>;
  raw: ReadableStream;
  rawSize: number;
}

/**
 * Parsed email address
 */
interface EmailAddress {
  name?: string;
  address: string;
}

/**
 * Email adapter implementation
 */
export class EmailAdapter extends BaseChannelAdapter {
  // Email has no practical character limit, but we'll chunk at 100KB for processing
  private static readonly EMAIL_CHAR_LIMIT = 100000;

  constructor(config: ChannelConfig) {
    super(ChannelType.EMAIL, config);
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------

  async connect(): Promise<void> {
    // Verify email configuration
    if (!this.config.settings.smtpHost || !this.config.settings.fromAddress) {
      throw new Error('Email configuration not complete');
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
   * Normalize email to MessageEnvelope
   */
  async normalize(
    rawMessage: any,
    context?: {
      orgId?: string;
      messageId?: string;
    },
  ): Promise<MessageEnvelope> {
    const msg = rawMessage as EmailMessage;

    // Parse email addresses
    const fromAddr = this.parseEmailAddress(msg.from);
    const toAddr = this.parseEmailAddress(msg.to);

    // Create sender peer
    const sender: Peer = this.createPeer(
      fromAddr.address,
      fromAddr.name,
      {
        emailAddress: fromAddr.address,
        emailName: fromAddr.name,
      },
    );

    // Extract text content (prefer plain text over HTML)
    const text = msg.text || this.stripHtml(msg.html || '');

    // Extract subject as part of context
    const fullText = msg.subject
      ? `Subject: ${msg.subject}\n\n${text}`
      : text;

    // Extract In-Reply-To header for threading
    const inReplyTo = msg.headers.get('In-Reply-To');
    const replyTo = inReplyTo
      ? { messageId: inReplyTo }
      : undefined;

    // Build envelope
    const envelope: MessageEnvelope = {
      messageId: context?.messageId || msg.headers.get('Message-ID') || this.generateMessageId(),
      channelType: ChannelType.EMAIL,
      scope: MessageScope.DM, // Email is always 1:1

      sender,
      text: fullText,
      replyTo,

      orgId: context?.orgId || this.config.orgId,
      sessionKey: `agent:${context?.orgId || this.config.orgId}:email:dm:${fromAddr.address}`,

      timestamp: Date.now(),

      isFromUser: true,

      channelMetadata: {
        emailFrom: msg.from,
        emailTo: msg.to,
        emailSubject: msg.subject,
        emailMessageId: msg.headers.get('Message-ID'),
        emailInReplyTo: inReplyTo,
        emailReferences: msg.headers.get('References'),
      },
    };

    return envelope;
  }

  // ------------------------------------------------------------------------
  // Message sending
  // ------------------------------------------------------------------------

  /**
   * Send email via SMTP or API
   */
  async send(message: OutboundMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Email adapter not connected');
    }

    const { smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, fromName } = this.config.settings;

    if (!smtpHost || !fromAddress) {
      throw new Error('Email SMTP configuration not complete');
    }

    // Extract recipient email
    const recipientEmail = message.recipient.id;

    // Build email subject and body
    const subject = this.extractSubjectFromText(message.text);
    const body = this.removeSubjectFromText(message.text);

    // Build email headers
    const headers: Record<string, string> = {
      From: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      To: recipientEmail,
      Subject: subject,
      'Content-Type': 'text/plain; charset=utf-8',
    };

    // Add In-Reply-To for threading
    if (message.replyTo?.messageId) {
      headers['In-Reply-To'] = message.replyTo.messageId;
      headers['References'] = message.metadata?.emailReferences
        ? `${message.metadata.emailReferences} ${message.replyTo.messageId}`
        : message.replyTo.messageId;
    }

    // Send via MailChannels (Cloudflare Workers email sending)
    // https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/
    try {
      await this.sendViaMailChannels(fromAddress, recipientEmail, subject, body, headers);
      this.emit('delivery', message.metadata?.messageId || 'unknown', 'sent');
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Send email via MailChannels API
   */
  private async sendViaMailChannels(
    from: string,
    to: string,
    subject: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<void> {
    const url = 'https://api.mailchannels.net/tx/v1/send';

    const payload = {
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: {
        email: from,
        name: headers.From.match(/^(.+?)\s*</)?.[1] || from,
      },
      subject,
      content: [
        {
          type: 'text/plain',
          value: body,
        },
      ],
      headers: headers,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MailChannels API error: ${response.status} ${error}`);
    }
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
    return false; // Email attachments require more complex handling
  }

  supportsGroups(): boolean {
    return false; // Email is 1:1 (CC/BCC handled separately)
  }

  supportsReadReceipts(): boolean {
    return false; // Email read receipts are unreliable
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Parse email address from string
   * Examples: "John Doe <john@example.com>", "john@example.com"
   */
  private parseEmailAddress(email: string): EmailAddress {
    const match = email.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return {
        name: match[1].trim(),
        address: match[2].trim(),
      };
    }
    return {
      address: email.trim(),
    };
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Extract subject from text (first line if it starts with "Subject:")
   */
  private extractSubjectFromText(text: string): string {
    const match = text.match(/^Subject:\s*(.+?)$/m);
    return match ? match[1].trim() : 'Message from CRM';
  }

  /**
   * Remove subject line from text
   */
  private removeSubjectFromText(text: string): string {
    return text.replace(/^Subject:\s*.+?\n+/m, '');
  }
}
