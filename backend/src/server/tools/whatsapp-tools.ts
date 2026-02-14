/**
 * WhatsApp Agent Tools
 *
 * AI Agent tools for interacting with WhatsApp Business API
 * Used by ChatAgent to send messages and manage conversations
 */

import { createLogger } from '../utils/logger';
import {
  sendTextMessage,
  sendTemplateMessage,
  sendButtonMessage,
  markMessageAsRead,
} from '../services/whatsapp-api';
import {
  getTemplate,
  substituteTemplateParams,
  validateTemplateParams,
} from '../services/whatsapp-templates';

const logger = createLogger('WhatsAppTools');

/**
 * Tool: Send WhatsApp text message
 */
export async function sendWhatsAppMessage(
  env: any,
  waId: string,
  message: string,
  previewUrl: boolean = false
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || 'dev-whatsapp-phone-id';
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || 'dev-whatsapp-access-token';

    logger.info('[WhatsAppTools] Sending text message', {
      waId,
      messageLength: message.length,
    });

    const result = await sendTextMessage(
      phoneNumberId,
      accessToken,
      waId,
      message,
      previewUrl
    );

    if (result.success) {
      // Store outbound message in conversation DO
      const conversationId = env.WHATSAPP_CONVERSATION.idFromName(waId);
      const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

      await conversationDO.fetch(
        new Request('https://internal/addMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: result.messageId,
            from: waId,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'text',
            content: message,
            metadata: {},
            direction: 'outbound',
            phoneNumberId,
          }),
        })
      );
    }

    return result;
  } catch (error) {
    logger.error('[WhatsAppTools] Error sending message', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Send WhatsApp template message
 */
export async function sendWhatsAppTemplate(
  env: any,
  waId: string,
  templateName: string,
  params: Record<string, string>
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const template = getTemplate(templateName);

    if (!template) {
      return {
        success: false,
        error: `Template '${templateName}' not found`,
      };
    }

    // Validate parameters
    const validation = validateTemplateParams(template, params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Template validation failed: ${validation.errors.join(', ')}`,
      };
    }

    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || 'dev-whatsapp-phone-id';
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || 'dev-whatsapp-access-token';

    logger.info('[WhatsAppTools] Sending template message', {
      waId,
      templateName,
      paramCount: Object.keys(params).length,
    });

    const components = substituteTemplateParams(template, params);

    const result = await sendTemplateMessage(
      phoneNumberId,
      accessToken,
      waId,
      template.name,
      template.language,
      components
    );

    if (result.success) {
      // Store outbound message in conversation DO
      const conversationId = env.WHATSAPP_CONVERSATION.idFromName(waId);
      const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

      await conversationDO.fetch(
        new Request('https://internal/addMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: result.messageId,
            from: waId,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'template',
            content: `[Template: ${templateName}]`,
            metadata: { templateName, params },
            direction: 'outbound',
            phoneNumberId,
          }),
        })
      );
    }

    return result;
  } catch (error) {
    logger.error('[WhatsAppTools] Error sending template', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Send WhatsApp message with buttons
 */
export async function sendWhatsAppButtons(
  env: any,
  waId: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || 'dev-whatsapp-phone-id';
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || 'dev-whatsapp-access-token';

    logger.info('[WhatsAppTools] Sending button message', {
      waId,
      buttonCount: buttons.length,
    });

    const result = await sendButtonMessage(
      phoneNumberId,
      accessToken,
      waId,
      bodyText,
      buttons,
      headerText
    );

    if (result.success) {
      // Store outbound message in conversation DO
      const conversationId = env.WHATSAPP_CONVERSATION.idFromName(waId);
      const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

      await conversationDO.fetch(
        new Request('https://internal/addMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: result.messageId,
            from: waId,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'interactive',
            content: bodyText,
            metadata: { buttons, headerText },
            direction: 'outbound',
            phoneNumberId,
          }),
        })
      );
    }

    return result;
  } catch (error) {
    logger.error('[WhatsAppTools] Error sending buttons', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Mark WhatsApp message as read
 */
export async function markWhatsAppMessageAsRead(
  env: any,
  messageId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || 'dev-whatsapp-phone-id';
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || 'dev-whatsapp-access-token';

    logger.info('[WhatsAppTools] Marking message as read', { messageId });

    const result = await markMessageAsRead(phoneNumberId, accessToken, messageId);

    return result;
  } catch (error) {
    logger.error('[WhatsAppTools] Error marking message as read', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Get WhatsApp conversation state
 */
export async function getWhatsAppConversationState(
  env: any,
  waId: string
): Promise<{
  success: boolean;
  state?: any;
  error?: string;
}> {
  try {
    const conversationId = env.WHATSAPP_CONVERSATION.idFromName(waId);
    const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

    const response = await conversationDO.fetch(
      new Request('https://internal/getState', { method: 'GET' })
    );

    const state = await response.json();

    return {
      success: true,
      state,
    };
  } catch (error) {
    logger.error('[WhatsAppTools] Error getting conversation state', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool: Get WhatsApp conversation history
 */
export async function getWhatsAppConversationHistory(
  env: any,
  waId: string,
  limit: number = 20
): Promise<{
  success: boolean;
  messages?: any[];
  error?: string;
}> {
  try {
    const conversationId = env.WHATSAPP_CONVERSATION.idFromName(waId);
    const conversationDO = env.WHATSAPP_CONVERSATION.get(conversationId);

    const response = await conversationDO.fetch(
      new Request(`https://internal/getMessages?limit=${limit}`, {
        method: 'GET',
      })
    );

    const data = await response.json();

    return {
      success: data.success,
      messages: data.messages,
    };
  } catch (error) {
    logger.error('[WhatsAppTools] Error getting conversation history', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool definitions for AI Agent
 * These can be registered with the ChatAgent
 */
export const WHATSAPP_TOOLS = [
  {
    name: 'sendWhatsAppMessage',
    description:
      'Send a text message to a WhatsApp user. Use this for conversational responses within the 24-hour messaging window.',
    parameters: {
      type: 'object',
      properties: {
        waId: {
          type: 'string',
          description: 'WhatsApp ID (phone number) of the recipient',
        },
        message: {
          type: 'string',
          description: 'The message text to send',
        },
        previewUrl: {
          type: 'boolean',
          description: 'Whether to show URL preview for links in the message',
          default: false,
        },
      },
      required: ['waId', 'message'],
    },
    function: sendWhatsAppMessage,
  },
  {
    name: 'sendWhatsAppTemplate',
    description:
      'Send a pre-approved template message to a WhatsApp user. Required for initiating conversations outside the 24-hour window.',
    parameters: {
      type: 'object',
      properties: {
        waId: {
          type: 'string',
          description: 'WhatsApp ID (phone number) of the recipient',
        },
        templateName: {
          type: 'string',
          description:
            'Name of the approved template (e.g., "welcome_message", "lead_confirmation")',
          enum: [
            'welcome_message',
            'lead_confirmation',
            'appointment_reminder',
            'qualification_complete',
          ],
        },
        params: {
          type: 'object',
          description: 'Template parameters as key-value pairs (e.g., {"1": "John", "2": "24"})',
        },
      },
      required: ['waId', 'templateName', 'params'],
    },
    function: sendWhatsAppTemplate,
  },
  {
    name: 'sendWhatsAppButtons',
    description: 'Send an interactive message with buttons to a WhatsApp user',
    parameters: {
      type: 'object',
      properties: {
        waId: {
          type: 'string',
          description: 'WhatsApp ID (phone number) of the recipient',
        },
        bodyText: {
          type: 'string',
          description: 'Main message text',
        },
        buttons: {
          type: 'array',
          description: 'Array of buttons (max 3)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
        headerText: {
          type: 'string',
          description: 'Optional header text',
        },
      },
      required: ['waId', 'bodyText', 'buttons'],
    },
    function: sendWhatsAppButtons,
  },
  {
    name: 'markWhatsAppMessageAsRead',
    description: 'Mark a WhatsApp message as read',
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'ID of the message to mark as read',
        },
      },
      required: ['messageId'],
    },
    function: markWhatsAppMessageAsRead,
  },
];
