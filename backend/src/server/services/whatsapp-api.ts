/**
 * WhatsApp Cloud API Client
 *
 * Handles sending messages and interacting with WhatsApp Cloud API
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('WhatsAppAPI');

const WHATSAPP_API_VERSION = 'v21.0';
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

/**
 * Send text message
 */
export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
  previewUrl: boolean = false
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    logger.info('[WhatsAppAPI] Sending text message', {
      phoneNumberId,
      to,
      textLength: text.length,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[WhatsAppAPI] Failed to send text message', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send message',
      };
    }

    const data = await response.json() as any;

    logger.info('[WhatsAppAPI] Text message sent successfully', {
      messageId: data.messages?.[0]?.id,
    });

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error sending text message', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send template message
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
      text?: string;
      currency?: { fallback_value: string; code: string; amount_1000: number };
      date_time?: { fallback_value: string };
      image?: { link: string };
      document?: { link: string; filename: string };
      video?: { link: string };
    }>;
    sub_type?: 'quick_reply' | 'url';
    index?: number;
  }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: components || [],
      },
    };

    logger.info('[WhatsAppAPI] Sending template message', {
      phoneNumberId,
      to,
      templateName,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[WhatsAppAPI] Failed to send template message', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send template',
      };
    }

    const data = await response.json() as any;

    logger.info('[WhatsAppAPI] Template message sent successfully', {
      messageId: data.messages?.[0]?.id,
    });

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error sending template message', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send interactive message with buttons
 */
export async function sendButtonMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: Array<{
    id: string;
    title: string;
  }>,
  headerText?: string,
  footerText?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title,
            },
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      payload.interactive.footer = {
        text: footerText,
      };
    }

    logger.info('[WhatsAppAPI] Sending button message', {
      phoneNumberId,
      to,
      buttonCount: buttons.length,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[WhatsAppAPI] Failed to send button message', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send buttons',
      };
    }

    const data = await response.json() as any;

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error sending button message', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send interactive message with list
 */
export async function sendListMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title?: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>,
  headerText?: string,
  footerText?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText,
        },
        action: {
          button: buttonText,
          sections,
        },
      },
    };

    if (headerText) {
      payload.interactive.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      payload.interactive.footer = {
        text: footerText,
      };
    }

    logger.info('[WhatsAppAPI] Sending list message', {
      phoneNumberId,
      to,
      sectionCount: sections.length,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[WhatsAppAPI] Failed to send list message', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to send list',
      };
    }

    const data = await response.json() as any;

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error sending list message', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[WhatsAppAPI] Failed to mark message as read', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to mark as read',
      };
    }

    logger.info('[WhatsAppAPI] Message marked as read', { messageId });

    return { success: true };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error marking message as read', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get media URL
 */
export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = `${WHATSAPP_API_BASE}/${mediaId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      logger.error('[WhatsAppAPI] Failed to get media URL', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: errorData.error?.message || 'Failed to get media URL',
      };
    }

    const data = await response.json() as any;

    return {
      success: true,
      url: data.url,
    };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error getting media URL', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download media
 */
export async function downloadMedia(
  mediaUrl: string,
  accessToken: string
): Promise<{ success: boolean; data?: ArrayBuffer; mimeType?: string; error?: string }> {
  try {
    const response = await fetch(mediaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.error('[WhatsAppAPI] Failed to download media', {
        status: response.status,
        mediaUrl,
      });
      return {
        success: false,
        error: 'Failed to download media',
      };
    }

    const data = await response.arrayBuffer();
    const mimeType = response.headers.get('Content-Type') || undefined;

    return {
      success: true,
      data,
      mimeType,
    };
  } catch (error) {
    logger.error('[WhatsAppAPI] Error downloading media', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
