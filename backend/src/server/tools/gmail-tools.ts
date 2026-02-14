/**
 * Gmail Agent Tools
 *
 * AI Agent tools for interacting with Gmail API.
 * Provides capabilities for listing, reading, and sending emails.
 */

import { createLogger } from '../utils/logger';
import { refreshGmailToken } from '../services/gmail-oauth';
import {
  listMessages,
  getMessage,
  getThread,
  sendEmail,
  markAsRead,
  archiveMessage,
  parseMessage,
  extractEmailAddress,
  type ParsedEmail,
} from '../services/gmail-api';

const logger = createLogger('GmailTools');

// =============================================================================
// TYPES
// =============================================================================

export interface GmailToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EmailSummary {
  id: string;
  threadId: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

// =============================================================================
// HELPER: GET ACCESS TOKEN
// =============================================================================

async function getGmailAccessToken(env: any, orgId: string): Promise<string | null> {
  try {
    const connectionsDO = env.SOCIAL_CONNECTIONS_DO.get(
      env.SOCIAL_CONNECTIONS_DO.idFromName(orgId)
    );
    const connection = await connectionsDO.getConnection('gmail');

    if (!connection) {
      logger.warn('[GmailTools] No Gmail connection found', { orgId });
      return null;
    }

    const accessToken = await connectionsDO.getAccessToken('gmail');
    if (!accessToken) {
      logger.warn('[GmailTools] Gmail connection exists but token could not be decrypted', { orgId });
      return null;
    }

    // Check if token needs refresh
    if (connection.expiresAt && connection.expiresAt * 1000 < Date.now()) {
      logger.info('[GmailTools] Token expired, refreshing');
      const refreshToken = await connectionsDO.getRefreshToken('gmail');
      if (!refreshToken) {
        logger.warn('[GmailTools] Missing Gmail refresh token, reconnect required', { orgId });
        return null;
      }

      const clientId = env.GMAIL_CLIENT_ID;
      const clientSecret = env.GMAIL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        logger.warn('[GmailTools] Missing Gmail OAuth credentials in env');
        return null;
      }

      const refreshed = await refreshGmailToken({
        refreshToken,
        clientId,
        clientSecret,
      });

      await connectionsDO.updateTokens({
        platform: 'gmail',
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      });

      return refreshed.accessToken;
    }

    return accessToken;
  } catch (error) {
    logger.error('[GmailTools] Failed to get access token', { error });
    return null;
  }
}

// =============================================================================
// TOOL: LIST EMAILS
// =============================================================================

/**
 * List recent emails from Gmail inbox
 */
export async function listGmailEmails(
  env: any,
  orgId: string,
  options: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
  } = {}
): Promise<GmailToolResult<EmailSummary[]>> {
  try {
    const accessToken = await getGmailAccessToken(env, orgId);
    if (!accessToken) {
      return { success: false, error: 'Gmail not connected. Please connect Gmail in settings.' };
    }

    const { query, maxResults = 10, labelIds = ['INBOX'] } = options;

    // List message IDs
    const listResult = await listMessages(accessToken, { query, maxResults, labelIds });

    if (!listResult.messages?.length) {
      return { success: true, data: [] };
    }

    // Fetch message details in parallel (limited to 10 for performance)
    const messageIds = listResult.messages.slice(0, 10);
    const messages = await Promise.all(
      messageIds.map((m) => getMessage(accessToken, m.id, 'metadata'))
    );

    // Parse into summaries
    const summaries: EmailSummary[] = messages.map((msg) => {
      const parsed = parseMessage(msg);
      const fromParsed = extractEmailAddress(parsed.from);

      return {
        id: msg.id,
        threadId: msg.threadId,
        from: fromParsed,
        subject: parsed.subject || '(no subject)',
        snippet: parsed.snippet,
        date: parsed.date,
        isUnread: msg.labelIds?.includes('UNREAD') || false,
      };
    });

    logger.info('[GmailTools] Listed emails', { count: summaries.length, query });

    return { success: true, data: summaries };
  } catch (error) {
    logger.error('[GmailTools] Error listing emails', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list emails',
    };
  }
}

// =============================================================================
// TOOL: READ EMAIL
// =============================================================================

/**
 * Read a specific email by ID
 */
export async function readGmailEmail(
  env: any,
  orgId: string,
  messageId: string
): Promise<GmailToolResult<ParsedEmail>> {
  try {
    const accessToken = await getGmailAccessToken(env, orgId);
    if (!accessToken) {
      return { success: false, error: 'Gmail not connected. Please connect Gmail in settings.' };
    }

    const message = await getMessage(accessToken, messageId, 'full');
    const parsed = parseMessage(message);

    // Mark as read
    await markAsRead(accessToken, messageId);

    logger.info('[GmailTools] Read email', { messageId, subject: parsed.subject });

    return { success: true, data: parsed };
  } catch (error) {
    logger.error('[GmailTools] Error reading email', { messageId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read email',
    };
  }
}

// =============================================================================
// TOOL: GET EMAIL THREAD
// =============================================================================

/**
 * Get full conversation thread
 */
export async function getGmailThread(
  env: any,
  orgId: string,
  threadId: string
): Promise<GmailToolResult<ParsedEmail[]>> {
  try {
    const accessToken = await getGmailAccessToken(env, orgId);
    if (!accessToken) {
      return { success: false, error: 'Gmail not connected. Please connect Gmail in settings.' };
    }

    const thread = await getThread(accessToken, threadId, 'full');
    const emails = thread.messages.map((msg) => parseMessage(msg));

    logger.info('[GmailTools] Got thread', { threadId, messageCount: emails.length });

    return { success: true, data: emails };
  } catch (error) {
    logger.error('[GmailTools] Error getting thread', { threadId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get thread',
    };
  }
}

// =============================================================================
// TOOL: SEND EMAIL
// =============================================================================

/**
 * Send or reply to an email
 */
export async function sendGmailEmail(
  env: any,
  orgId: string,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    replyToMessageId?: string;
  }
): Promise<GmailToolResult<{ messageId: string; threadId: string }>> {
  try {
    const accessToken = await getGmailAccessToken(env, orgId);
    if (!accessToken) {
      return { success: false, error: 'Gmail not connected. Please connect Gmail in settings.' };
    }

    const result = await sendEmail(accessToken, params);

    logger.info('[GmailTools] Sent email', {
      to: params.to,
      subject: params.subject,
      messageId: result.id,
    });

    return {
      success: true,
      data: { messageId: result.id, threadId: result.threadId },
    };
  } catch (error) {
    logger.error('[GmailTools] Error sending email', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// =============================================================================
// TOOL: ARCHIVE EMAIL
// =============================================================================

/**
 * Archive an email (remove from inbox)
 */
export async function archiveGmailEmail(
  env: any,
  orgId: string,
  messageId: string
): Promise<GmailToolResult<{ archived: boolean }>> {
  try {
    const accessToken = await getGmailAccessToken(env, orgId);
    if (!accessToken) {
      return { success: false, error: 'Gmail not connected. Please connect Gmail in settings.' };
    }

    await archiveMessage(accessToken, messageId);

    logger.info('[GmailTools] Archived email', { messageId });

    return { success: true, data: { archived: true } };
  } catch (error) {
    logger.error('[GmailTools] Error archiving email', { messageId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive email',
    };
  }
}

// =============================================================================
// TOOL DEFINITIONS FOR AI AGENT
// =============================================================================

export const GMAIL_TOOL_DEFINITIONS = [
  {
    name: 'listGmailEmails',
    description:
      'List recent emails from Gmail inbox. Use this to check for new messages or search emails.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Gmail search query (e.g., "is:unread", "from:someone@example.com", "subject:invoice")',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of emails to return (default: 10, max: 20)',
          default: 10,
        },
      },
    },
  },
  {
    name: 'readGmailEmail',
    description: 'Read the full content of a specific email by its ID.',
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The Gmail message ID to read',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'getGmailThread',
    description: 'Get the full conversation thread for an email, including all replies.',
    parameters: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The Gmail thread ID to retrieve',
        },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'sendGmailEmail',
    description: 'Send a new email or reply to an existing conversation.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text)',
        },
        threadId: {
          type: 'string',
          description: 'Thread ID if replying to an existing conversation',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'archiveGmailEmail',
    description: 'Archive an email, removing it from the inbox but keeping it searchable.',
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The Gmail message ID to archive',
        },
      },
      required: ['messageId'],
    },
  },
];

/**
 * Execute a Gmail tool by name
 */
export async function executeGmailTool(
  toolName: string,
  args: Record<string, unknown>,
  env: any,
  orgId: string
): Promise<GmailToolResult> {
  switch (toolName) {
    case 'listGmailEmails':
      return listGmailEmails(env, orgId, {
        query: args.query as string | undefined,
        maxResults: args.maxResults as number | undefined,
      });

    case 'readGmailEmail':
      return readGmailEmail(env, orgId, args.messageId as string);

    case 'getGmailThread':
      return getGmailThread(env, orgId, args.threadId as string);

    case 'sendGmailEmail':
      return sendGmailEmail(env, orgId, {
        to: args.to as string,
        subject: args.subject as string,
        body: args.body as string,
        threadId: args.threadId as string | undefined,
      });

    case 'archiveGmailEmail':
      return archiveGmailEmail(env, orgId, args.messageId as string);

    default:
      return { success: false, error: `Unknown Gmail tool: ${toolName}` };
  }
}
