/**
 * WhatsApp Message Parser
 *
 * Parses different WhatsApp message types (text, media, location, interactive)
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('WhatsAppMessageParser');

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts' | 'interactive' | 'button' | 'sticker';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
    voice?: boolean;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: Array<{
    name: {
      formatted_name: string;
      first_name?: string;
      last_name?: string;
    };
    phones?: Array<{
      phone: string;
      type?: string;
    }>;
    emails?: Array<{
      email: string;
      type?: string;
    }>;
  }>;
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  button?: {
    text: string;
    payload: string;
  };
  context?: {
    from: string;
    id: string;
  };
}

export interface ParsedMessage {
  content: string;
  metadata: {
    type: string;
    mediaId?: string;
    location?: {
      lat: number;
      lng: number;
      name?: string;
      address?: string;
    };
    contacts?: any[];
    interactionId?: string;
    interactionTitle?: string;
    replyToMessageId?: string;
    [key: string]: any;
  };
}

/**
 * Parse WhatsApp message into standardized format
 */
export function parseWhatsAppMessage(message: WhatsAppMessage): ParsedMessage {
  const metadata: ParsedMessage['metadata'] = {
    type: message.type,
  };

  let content = '';

  switch (message.type) {
    case 'text':
      content = message.text?.body || '';
      break;

    case 'image':
      metadata.mediaId = message.image?.id;
      metadata.mimeType = message.image?.mime_type;
      content = message.image?.caption || '[Image]';
      break;

    case 'video':
      metadata.mediaId = message.video?.id;
      metadata.mimeType = message.video?.mime_type;
      content = message.video?.caption || '[Video]';
      break;

    case 'audio':
      metadata.mediaId = message.audio?.id;
      metadata.mimeType = message.audio?.mime_type;
      metadata.isVoice = message.audio?.voice;
      content = message.audio?.voice ? '[Voice Message]' : '[Audio]';
      break;

    case 'document':
      metadata.mediaId = message.document?.id;
      metadata.mimeType = message.document?.mime_type;
      metadata.filename = message.document?.filename;
      content = message.document?.caption || `[Document: ${message.document?.filename || 'Unknown'}]`;
      break;

    case 'location':
      if (message.location) {
        metadata.location = {
          lat: message.location.latitude,
          lng: message.location.longitude,
          name: message.location.name,
          address: message.location.address,
        };
        content = `[Location: ${message.location.name || message.location.address || `${message.location.latitude}, ${message.location.longitude}`}]`;
      }
      break;

    case 'contacts':
      metadata.contacts = message.contacts;
      const contactNames = message.contacts?.map(c => c.name.formatted_name).join(', ') || '';
      content = `[Contact${message.contacts && message.contacts.length > 1 ? 's' : ''}: ${contactNames}]`;
      break;

    case 'interactive':
      if (message.interactive?.type === 'button_reply') {
        metadata.interactionId = message.interactive.button_reply?.id;
        metadata.interactionTitle = message.interactive.button_reply?.title;
        content = message.interactive.button_reply?.title || '[Button clicked]';
      } else if (message.interactive?.type === 'list_reply') {
        metadata.interactionId = message.interactive.list_reply?.id;
        metadata.interactionTitle = message.interactive.list_reply?.title;
        metadata.interactionDescription = message.interactive.list_reply?.description;
        content = message.interactive.list_reply?.title || '[List item selected]';
      }
      break;

    case 'button':
      metadata.buttonPayload = message.button?.payload;
      content = message.button?.text || '[Button]';
      break;

    case 'sticker':
      content = '[Sticker]';
      break;

    default:
      content = `[Unsupported message type: ${message.type}]`;
      logger.warn('[WhatsAppMessageParser] Unsupported message type', {
        type: message.type,
        messageId: message.id,
      });
  }

  // Add context (reply information)
  if (message.context) {
    metadata.replyToMessageId = message.context.id;
    metadata.replyToSender = message.context.from;
  }

  logger.info('[WhatsAppMessageParser] Message parsed', {
    messageId: message.id,
    type: message.type,
    contentLength: content.length,
  });

  return {
    content,
    metadata,
  };
}

/**
 * Extract phone number from WhatsApp ID
 */
export function extractPhoneNumber(waId: string): string {
  // WhatsApp IDs are phone numbers without + or spaces
  // Format: country code + number (e.g., 15551234567)
  return waId;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(waId: string): string {
  // Simple formatting: +1 (555) 123-4567
  if (waId.length === 11 && waId.startsWith('1')) {
    // US/Canada number
    return `+${waId[0]} (${waId.slice(1, 4)}) ${waId.slice(4, 7)}-${waId.slice(7)}`;
  } else if (waId.length >= 10) {
    // International number
    return `+${waId}`;
  }
  return waId;
}

/**
 * Check if message is a command
 */
export function isCommand(content: string): boolean {
  return content.trim().startsWith('/');
}

/**
 * Parse command from message
 */
export function parseCommand(content: string): {
  command: string;
  args: string[];
} | null {
  if (!isCommand(content)) {
    return null;
  }

  const parts = content.trim().split(/\s+/);
  const command = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Extract intent from message content
 * Simple keyword-based intent detection
 */
export function extractIntent(content: string): string | null {
  const lowerContent = content.toLowerCase();

  // Greeting
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(lowerContent)) {
    return 'greeting';
  }

  // Help request
  if (/(help|assist|support|question)/i.test(lowerContent)) {
    return 'help_request';
  }

  // Product inquiry
  if (/(price|cost|how much|product|service|offer)/i.test(lowerContent)) {
    return 'product_inquiry';
  }

  // Complaint
  if (/(problem|issue|not working|broken|complaint)/i.test(lowerContent)) {
    return 'complaint';
  }

  // Appointment/meeting
  if (/(appointment|meeting|schedule|book|calendar)/i.test(lowerContent)) {
    return 'appointment_request';
  }

  // Thanks/goodbye
  if (/(thank|thanks|bye|goodbye|see you)/i.test(lowerContent)) {
    return 'closing';
  }

  return null;
}

/**
 * Sanitize message content for storage
 */
export function sanitizeContent(content: string): string {
  // Remove excessive whitespace
  let sanitized = content.replace(/\s+/g, ' ').trim();

  // Limit length
  const maxLength = 4000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

/**
 * Check if content contains sensitive information
 */
export function containsSensitiveInfo(content: string): {
  hasSensitive: boolean;
  types: string[];
} {
  const types: string[] = [];

  // Credit card pattern
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(content)) {
    types.push('credit_card');
  }

  // SSN pattern
  if (/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/.test(content)) {
    types.push('ssn');
  }

  // Password keywords
  if (/\b(password|passwd|pwd)[\s:=]/i.test(content)) {
    types.push('password');
  }

  return {
    hasSensitive: types.length > 0,
    types,
  };
}
