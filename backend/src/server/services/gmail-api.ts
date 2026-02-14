/**
 * Gmail API Service
 *
 * Provides methods for reading and sending emails via Gmail API.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('GmailAPI');

// =============================================================================
// TYPES
// =============================================================================

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: GmailMessagePayload;
  sizeEstimate: number;
}

export interface GmailMessagePayload {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers: GmailHeader[];
  body: GmailMessageBody;
  parts?: GmailMessagePayload[];
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailMessageBody {
  size: number;
  data?: string;
  attachmentId?: string;
}

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

export interface GmailLabel {
  id: string;
  name: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  type?: string;
}

export interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  labels: string[];
}

// =============================================================================
// MESSAGE LISTING
// =============================================================================

/**
 * List messages with optional search query
 */
export async function listMessages(
  accessToken: string,
  options: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  } = {}
): Promise<GmailListResponse> {
  const { query, maxResults = 10, labelIds, pageToken } = options;

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  if (query) url.searchParams.set('q', query);
  if (maxResults) url.searchParams.set('maxResults', maxResults.toString());
  if (labelIds?.length) url.searchParams.set('labelIds', labelIds.join(','));
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  logger.info('[GmailAPI] Listing messages', { query, maxResults });

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to list messages', { error, status: response.status });
    throw new Error(`Failed to list Gmail messages: ${error}`);
  }

  return response.json();
}

// =============================================================================
// MESSAGE RETRIEVAL
// =============================================================================

/**
 * Get a single message by ID
 */
export async function getMessage(
  accessToken: string,
  messageId: string,
  format: 'full' | 'metadata' | 'minimal' | 'raw' = 'full'
): Promise<GmailMessage> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to get message', { messageId, error });
    throw new Error(`Failed to get Gmail message: ${error}`);
  }

  return response.json();
}

/**
 * Get a thread by ID
 */
export async function getThread(
  accessToken: string,
  threadId: string,
  format: 'full' | 'metadata' | 'minimal' = 'full'
): Promise<GmailThread> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=${format}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to get thread', { threadId, error });
    throw new Error(`Failed to get Gmail thread: ${error}`);
  }

  return response.json();
}

// =============================================================================
// MESSAGE SENDING
// =============================================================================

/**
 * Send an email message
 */
export async function sendEmail(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    replyToMessageId?: string;
  }
): Promise<{ id: string; threadId: string; labelIds: string[] }> {
  const { to, subject, body, threadId, replyToMessageId } = params;

  // Build RFC 2822 message
  const messageParts: string[] = [];

  if (replyToMessageId) {
    messageParts.push(`In-Reply-To: ${replyToMessageId}`);
    messageParts.push(`References: ${replyToMessageId}`);
  }

  messageParts.push(
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body
  );

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: Record<string, string> = { raw: encodedMessage };
  if (threadId) {
    requestBody.threadId = threadId;
  }

  logger.info('[GmailAPI] Sending email', { to, subject: subject.substring(0, 50) });

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to send message', { error });
    throw new Error(`Failed to send Gmail message: ${error}`);
  }

  return response.json();
}

/**
 * Create a draft email
 */
export async function createDraft(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }
): Promise<{ id: string; message: GmailMessage }> {
  const { to, subject, body, threadId } = params;

  // Build RFC 2822 message
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ];

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: Record<string, unknown> = {
    message: { raw: encodedMessage },
  };
  if (threadId) {
    (requestBody.message as Record<string, string>).threadId = threadId;
  }

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to create draft', { error });
    throw new Error(`Failed to create Gmail draft: ${error}`);
  }

  return response.json();
}

// =============================================================================
// MESSAGE MODIFICATION
// =============================================================================

/**
 * Modify message labels (archive, mark read, etc.)
 */
export async function modifyMessage(
  accessToken: string,
  messageId: string,
  options: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
): Promise<GmailMessage> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: options.addLabelIds || [],
        removeLabelIds: options.removeLabelIds || [],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to modify message', { messageId, error });
    throw new Error(`Failed to modify Gmail message: ${error}`);
  }

  return response.json();
}

/**
 * Mark message as read
 */
export async function markAsRead(accessToken: string, messageId: string): Promise<GmailMessage> {
  return modifyMessage(accessToken, messageId, { removeLabelIds: ['UNREAD'] });
}

/**
 * Archive message (remove from INBOX)
 */
export async function archiveMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  return modifyMessage(accessToken, messageId, { removeLabelIds: ['INBOX'] });
}

// =============================================================================
// LABELS
// =============================================================================

/**
 * List all labels
 */
export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('[GmailAPI] Failed to list labels', { error });
    throw new Error(`Failed to list Gmail labels: ${error}`);
  }

  const data = await response.json() as any;
  return data.labels || [];
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

/**
 * Parse email headers from message
 */
export function parseHeaders(message: GmailMessage): {
  from: string;
  to: string;
  subject: string;
  date: string;
  messageId?: string;
} {
  const headers = message.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    from: getHeader('from'),
    to: getHeader('to'),
    subject: getHeader('subject'),
    date: getHeader('date'),
    messageId: getHeader('message-id'),
  };
}

/**
 * Extract plain text body from message
 */
export function extractBody(message: GmailMessage): string {
  const { payload } = message;

  // Simple case: body is directly in payload
  if (payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart: find text/plain part
  if (payload.parts) {
    const textPart = findPartByMimeType(payload.parts, 'text/plain');
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }

    // Fallback to text/html if no plain text
    const htmlPart = findPartByMimeType(payload.parts, 'text/html');
    if (htmlPart?.body?.data) {
      // Simple HTML to text (strip tags)
      const html = decodeBase64Url(htmlPart.body.data);
      return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  return message.snippet;
}

/**
 * Find a part by MIME type recursively
 */
function findPartByMimeType(
  parts: GmailMessagePayload[],
  mimeType: string
): GmailMessagePayload | null {
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part;
    }
    if (part.parts) {
      const found = findPartByMimeType(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/**
 * Parse a Gmail message into a simplified format
 */
export function parseMessage(message: GmailMessage): ParsedEmail {
  const headers = parseHeaders(message);
  const body = extractBody(message);

  return {
    id: message.id,
    threadId: message.threadId,
    from: headers.from,
    to: headers.to,
    subject: headers.subject,
    date: headers.date,
    snippet: message.snippet,
    body,
    labels: message.labelIds || [],
  };
}

/**
 * Extract email address from "Name <email>" format
 */
export function extractEmailAddress(fromString: string): { name: string; email: string } {
  const match = fromString.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/^"(.+)"$/, '$1').trim(),
      email: match[2].trim(),
    };
  }
  return { name: '', email: fromString.trim() };
}
