/**
 * WhatsApp Template Manager
 *
 * Manages approved WhatsApp message templates
 * Handles template parameter substitution and validation
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('WhatsAppTemplates');

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: {
      header_text?: string[];
      body_text?: string[][];
    };
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

/**
 * Default template configurations
 * These should match approved templates in WhatsApp Business Manager
 */
export const DEFAULT_TEMPLATES: Record<string, WhatsAppTemplate> = {
  welcome_message: {
    id: 'welcome_message',
    name: 'welcome_message',
    language: 'en_US',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}! Welcome to our service. How can we help you today?',
        example: {
          body_text: [['John']],
        },
      },
    ],
  },
  lead_confirmation: {
    id: 'lead_confirmation',
    name: 'lead_confirmation',
    language: 'en_US',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Thank you for your interest, {{1}}! We received your inquiry and will get back to you within {{2}} hours.',
        example: {
          body_text: [['Sarah', '24']],
        },
      },
    ],
  },
  appointment_reminder: {
    id: 'appointment_reminder',
    name: 'appointment_reminder',
    language: 'en_US',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}! This is a reminder about your appointment on {{2}} at {{3}}.',
        example: {
          body_text: [['Mike', 'January 25th', '2:00 PM']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Confirm',
          },
          {
            type: 'QUICK_REPLY',
            text: 'Reschedule',
          },
        ],
      },
    ],
  },
  qualification_complete: {
    id: 'qualification_complete',
    name: 'qualification_complete',
    language: 'en_US',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Great news, {{1}}! Your qualification is complete. Our team will contact you shortly to discuss next steps.',
        example: {
          body_text: [['Emma']],
        },
      },
    ],
  },
};

/**
 * Get template by name
 */
export function getTemplate(templateName: string): WhatsAppTemplate | null {
  return DEFAULT_TEMPLATES[templateName] || null;
}

/**
 * Substitute parameters in template
 */
export function substituteTemplateParams(
  template: WhatsAppTemplate,
  params: Record<string, string>
): Array<{
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text';
    text: string;
  }>;
}> {
  const components: any[] = [];

  for (const component of template.components) {
    if (component.type === 'HEADER' && component.text) {
      const headerParams = extractParams(component.text);
      if (headerParams.length > 0) {
        components.push({
          type: 'header',
          parameters: headerParams.map((paramNum) => ({
            type: 'text',
            text: params[paramNum] || `{{${paramNum}}}`,
          })),
        });
      }
    }

    if (component.type === 'BODY' && component.text) {
      const bodyParams = extractParams(component.text);
      if (bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams.map((paramNum) => ({
            type: 'text',
            text: params[paramNum] || `{{${paramNum}}}`,
          })),
        });
      }
    }
  }

  return components;
}

/**
 * Extract parameter numbers from template text
 * Example: "Hi {{1}}! Your appointment is {{2}}" -> ['1', '2']
 */
function extractParams(text: string): string[] {
  const regex = /\{\{(\d+)\}\}/g;
  const params: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    params.push(match[1]);
  }

  return params;
}

/**
 * Validate template parameters
 */
export function validateTemplateParams(
  template: WhatsAppTemplate,
  params: Record<string, string>
): {
  valid: boolean;
  errors: string[];
  missingParams: string[];
} {
  const errors: string[] = [];
  const missingParams: string[] = [];

  // Extract all required parameters from template
  const requiredParams = new Set<string>();

  for (const component of template.components) {
    if (component.text) {
      const params = extractParams(component.text);
      params.forEach((p) => requiredParams.add(p));
    }
  }

  // Check if all required params are provided
  for (const paramNum of requiredParams) {
    if (!params[paramNum]) {
      missingParams.push(paramNum);
      errors.push(`Missing parameter {{${paramNum}}}`);
    }
  }

  // Validate parameter values
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string') {
      errors.push(`Parameter {{${key}}} must be a string`);
    } else if (value.length === 0) {
      errors.push(`Parameter {{${key}}} cannot be empty`);
    } else if (value.length > 1000) {
      errors.push(`Parameter {{${key}}} is too long (max 1000 characters)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingParams,
  };
}

/**
 * Format template preview with substituted params
 */
export function formatTemplatePreview(
  template: WhatsAppTemplate,
  params: Record<string, string>
): string {
  let preview = '';

  for (const component of template.components) {
    if (component.type === 'HEADER' && component.text) {
      let headerText = component.text;
      const headerParams = extractParams(headerText);
      for (const paramNum of headerParams) {
        headerText = headerText.replace(
          new RegExp(`\\{\\{${paramNum}\\}\\}`, 'g'),
          params[paramNum] || `{{${paramNum}}}`
        );
      }
      preview += `**${headerText}**\n\n`;
    }

    if (component.type === 'BODY' && component.text) {
      let bodyText = component.text;
      const bodyParams = extractParams(bodyText);
      for (const paramNum of bodyParams) {
        bodyText = bodyText.replace(
          new RegExp(`\\{\\{${paramNum}\\}\\}`, 'g'),
          params[paramNum] || `{{${paramNum}}}`
        );
      }
      preview += `${bodyText}\n\n`;
    }

    if (component.type === 'FOOTER' && component.text) {
      preview += `_${component.text}_\n\n`;
    }

    if (component.type === 'BUTTONS' && component.buttons) {
      preview += 'Buttons:\n';
      for (const button of component.buttons) {
        preview += `• ${button.text}\n`;
      }
    }
  }

  return preview.trim();
}

/**
 * List all available templates
 */
export function listTemplates(
  statusFilter?: 'APPROVED' | 'PENDING' | 'REJECTED'
): WhatsAppTemplate[] {
  const templates = Object.values(DEFAULT_TEMPLATES);

  if (statusFilter) {
    return templates.filter((t) => t.status === statusFilter);
  }

  return templates;
}

/**
 * Check if template requires button interaction
 */
export function hasButtons(template: WhatsAppTemplate): boolean {
  return template.components.some((c) => c.type === 'BUTTONS');
}

/**
 * Get template button options
 */
export function getTemplateButtons(
  template: WhatsAppTemplate
): Array<{ text: string; type: string }> {
  const buttonsComponent = template.components.find((c) => c.type === 'BUTTONS');

  if (!buttonsComponent || !buttonsComponent.buttons) {
    return [];
  }

  return buttonsComponent.buttons.map((b) => ({
    text: b.text,
    type: b.type,
  }));
}

/**
 * Create template component structure for API
 */
export function buildTemplateComponents(
  template: WhatsAppTemplate,
  params: Record<string, string>
): Array<{
  type: string;
  parameters: Array<{
    type: string;
    text: string;
  }>;
}> {
  return substituteTemplateParams(template, params);
}

logger.info('[WhatsAppTemplates] Template manager initialized', {
  templateCount: Object.keys(DEFAULT_TEMPLATES).length,
  approvedCount: listTemplates('APPROVED').length,
});
