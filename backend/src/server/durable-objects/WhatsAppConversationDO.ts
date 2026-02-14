/**
 * WhatsApp Conversation Durable Object
 *
 * Manages WhatsApp conversation state per phone number
 * Stores message history and tracks 24-hour messaging window
 */

import { DurableObject } from 'cloudflare:workers';
import { createLogger } from '../utils/logger';

const logger = createLogger('WhatsAppConversationDO');

export class WhatsAppConversationDO extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Create conversation metadata table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS conversation (
        wa_id TEXT PRIMARY KEY,
        contact_name TEXT,
        phone_number_id TEXT,
        contact_id TEXT,
        last_inbound_message_time INTEGER,
        last_outbound_message_time INTEGER,
        message_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Migration: Add contact_id column if it doesn't exist (for existing DOs)
    try {
      this.sql.exec(`ALTER TABLE conversation ADD COLUMN contact_id TEXT`);
    } catch {
      // Column already exists, ignore
    }

    // Create messages table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        wa_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
        type TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        status TEXT DEFAULT 'sent',
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_id)
    `);
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)
    `);
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/addMessage':
        return this.addMessage(request);
      case '/updateMessageStatus':
        return this.updateMessageStatus(request);
      case '/getMessages':
        return this.getMessages(request);
      case '/getState':
        return this.getState();
      case '/markAsRead':
        return this.markAsRead(request);
      case '/linkContact':
        return this.linkContact(request);
      case '/unlinkContact':
        return this.unlinkContact();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Add message to conversation
   */
  private async addMessage(request: Request): Promise<Response> {
    try {
      const data = await request.json<{
        messageId: string;
        from: string;
        timestamp: string;
        type: string;
        content: string;
        metadata: any;
        contactName?: string;
        phoneNumberId?: string;
        direction?: 'inbound' | 'outbound';
      }>();

      const {
        messageId,
        from,
        timestamp,
        type,
        content,
        metadata,
        contactName,
        phoneNumberId,
        direction = 'inbound',
      } = data;

      const timestampMs = parseInt(timestamp) * 1000;

      // Upsert conversation metadata
      const existing = this.sql
        .exec('SELECT * FROM conversation WHERE wa_id = ?', from)
        .toArray()[0];

      if (!existing) {
        this.sql.exec(
          `
          INSERT INTO conversation (wa_id, contact_name, phone_number_id, last_inbound_message_time, message_count)
          VALUES (?, ?, ?, ?, 1)
        `,
          from,
          contactName || null,
          phoneNumberId || null,
          timestampMs
        );
      } else {
        const updateField =
          direction === 'inbound' ? 'last_inbound_message_time' : 'last_outbound_message_time';

        this.sql.exec(
          `
          UPDATE conversation
          SET ${updateField} = ?,
              message_count = message_count + 1,
              updated_at = unixepoch()
          WHERE wa_id = ?
        `,
          timestampMs,
          from
        );
      }

      // Insert message
      this.sql.exec(
        `
        INSERT INTO messages (id, message_id, wa_id, direction, type, content, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        messageId,
        messageId,
        from,
        direction,
        type,
        content,
        JSON.stringify(metadata),
        timestampMs
      );

      logger.info('[WhatsAppConversationDO] Message added', {
        messageId,
        waId: from,
        direction,
        type,
      });

      return new Response(
        JSON.stringify({ success: true, messageId }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error adding message', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Update message status (sent, delivered, read, failed)
   */
  private async updateMessageStatus(request: Request): Promise<Response> {
    try {
      const { messageId, status, timestamp } = await request.json<{
        messageId: string;
        status: string;
        timestamp: string;
      }>();

      this.sql.exec(
        'UPDATE messages SET status = ? WHERE message_id = ?',
        status,
        messageId
      );

      logger.info('[WhatsAppConversationDO] Message status updated', {
        messageId,
        status,
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error updating status', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get messages with pagination
   */
  private async getMessages(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const messages = this.sql
        .exec(
          `
        SELECT * FROM messages
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `,
          limit,
          offset
        )
        .toArray()
        .map((msg: any) => ({
          ...msg,
          metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
        }));

      const totalCount = (
        this.sql.exec('SELECT COUNT(*) as count FROM messages').toArray()[0] as any
      ).count;

      return new Response(
        JSON.stringify({
          success: true,
          messages,
          totalCount,
          limit,
          offset,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error getting messages', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Get conversation state
   */
  private getState(): Response {
    try {
      const conversation = this.sql
        .exec('SELECT * FROM conversation LIMIT 1')
        .toArray()[0] as any;

      if (!conversation) {
        return new Response(
          JSON.stringify({
            success: true,
            waId: null,
            messageCount: 0,
            lastInboundMessageTime: null,
            lastOutboundMessageTime: null,
            withinWindow: false,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Check if within 24-hour messaging window
      const now = Date.now();
      const lastInbound = conversation.last_inbound_message_time || 0;
      const withinWindow = now - lastInbound < 24 * 60 * 60 * 1000;

      return new Response(
        JSON.stringify({
          success: true,
          waId: conversation.wa_id,
          contactName: conversation.contact_name,
          phoneNumberId: conversation.phone_number_id,
          contactId: conversation.contact_id || null,
          messageCount: conversation.message_count,
          lastInboundMessageTime: conversation.last_inbound_message_time,
          lastOutboundMessageTime: conversation.last_outbound_message_time,
          withinWindow,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error getting state', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Mark all messages as read
   */
  private async markAsRead(request: Request): Promise<Response> {
    try {
      const { messageId } = await request.json<{ messageId?: string }>();

      if (messageId) {
        this.sql.exec(
          'UPDATE messages SET status = ? WHERE message_id = ? AND direction = ?',
          'read',
          messageId,
          'inbound'
        );
      } else {
        this.sql.exec(
          'UPDATE messages SET status = ? WHERE direction = ? AND status != ?',
          'read',
          'inbound',
          'read'
        );
      }

      logger.info('[WhatsAppConversationDO] Messages marked as read', {
        messageId: messageId || 'all',
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error marking as read', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Link conversation to a contact (for 360-degree customer view)
   */
  private async linkContact(request: Request): Promise<Response> {
    try {
      const { contactId } = await request.json<{ contactId: string }>();

      if (!contactId) {
        return new Response(
          JSON.stringify({ success: false, error: 'contactId is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      this.sql.exec(
        'UPDATE conversation SET contact_id = ?, updated_at = unixepoch()',
        contactId
      );

      logger.info('[WhatsAppConversationDO] Linked to contact', { contactId });

      return new Response(
        JSON.stringify({ success: true, contactId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error linking contact', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Unlink conversation from contact
   */
  private unlinkContact(): Response {
    try {
      this.sql.exec(
        'UPDATE conversation SET contact_id = NULL, updated_at = unixepoch()'
      );

      logger.info('[WhatsAppConversationDO] Unlinked from contact');

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error('[WhatsAppConversationDO] Error unlinking contact', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
}
