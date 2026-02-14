/**
 * Facebook Lead Ads Field Mapping Service
 *
 * Maps Facebook custom fields to CRM fields
 * Supports multiple form templates and custom questions
 */

import { createLogger } from '../utils/logger';
import type { FacebookLeadField } from '../webhooks/facebook';

const logger = createLogger('FacebookFieldMapper');

export interface FieldMapping {
  facebookField: string;
  crmField: string;
  transform?: (value: string) => any;
}

export interface FormTemplate {
  id: string;
  name: string;
  mappings: FieldMapping[];
}

/**
 * Default field mappings (Facebook standard fields -> CRM fields)
 */
export const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  { facebookField: 'full_name', crmField: 'name' },
  { facebookField: 'first_name', crmField: 'firstName' },
  { facebookField: 'last_name', crmField: 'lastName' },
  { facebookField: 'email', crmField: 'email' },
  { facebookField: 'phone_number', crmField: 'phone' },
  { facebookField: 'phone', crmField: 'phone' },
  { facebookField: 'company_name', crmField: 'company' },
  { facebookField: 'company', crmField: 'company' },
  { facebookField: 'job_title', crmField: 'jobTitle' },
  { facebookField: 'city', crmField: 'city' },
  { facebookField: 'state', crmField: 'state' },
  { facebookField: 'province', crmField: 'state' },
  { facebookField: 'country', crmField: 'country' },
  { facebookField: 'zip_code', crmField: 'zip' },
  { facebookField: 'zip', crmField: 'zip' },
  { facebookField: 'postal_code', crmField: 'zip' },
  { facebookField: 'street_address', crmField: 'address' },
  { facebookField: 'address', crmField: 'address' },
];

/**
 * BANT field mappings (maps to lead qualification fields)
 */
export const BANT_FIELD_MAPPINGS: Record<string, 'budget' | 'authority' | 'need' | 'timeline'> = {
  // Budget
  'budget': 'budget',
  'budget_range': 'budget',
  'investment_range': 'budget',
  'spending_capacity': 'budget',

  // Authority
  'job_title': 'authority',
  'role': 'authority',
  'position': 'authority',
  'decision_maker': 'authority',

  // Need
  'problem': 'need',
  'challenge': 'need',
  'pain_point': 'need',
  'need': 'need',
  'goal': 'need',
  'objective': 'need',

  // Timeline
  'timeline': 'timeline',
  'timeframe': 'timeline',
  'when_needed': 'timeline',
  'purchase_timeline': 'timeline',
  'urgency': 'timeline',
};

/**
 * Map Facebook lead fields to CRM fields using template
 *
 * @param fieldData - Facebook field data array
 * @param template - Optional form template with custom mappings
 * @returns Mapped CRM data
 */
export function mapFieldsToCRM(
  fieldData: FacebookLeadField[],
  template?: FormTemplate
): {
  contactInfo: Record<string, any>;
  bantData: Record<string, any>;
  customFields: Record<string, any>;
} {
  const contactInfo: Record<string, any> = {};
  const bantData: Record<string, any> = {};
  const customFields: Record<string, any> = {};

  // Get mappings (template takes precedence)
  const mappings = template?.mappings || DEFAULT_FIELD_MAPPINGS;
  const mappingLookup = new Map(
    mappings.map((m) => [m.facebookField.toLowerCase(), m])
  );

  for (const field of fieldData) {
    const fieldName = field.name.toLowerCase();
    const value = field.values[0] || '';

    // Check if field has a mapping
    const mapping = mappingLookup.get(fieldName);

    if (mapping) {
      // Apply transformation if defined
      const transformedValue = mapping.transform ? mapping.transform(value) : value;
      contactInfo[mapping.crmField] = transformedValue;
    } else {
      // Check if it's a BANT field
      const bantType = BANT_FIELD_MAPPINGS[fieldName];

      if (bantType) {
        bantData[fieldName] = value;
      } else {
        // Store as custom field
        customFields[field.name] = value;
      }
    }
  }

  logger.info('[FacebookFieldMapper] Fields mapped', {
    contactFields: Object.keys(contactInfo).length,
    bantFields: Object.keys(bantData).length,
    customFields: Object.keys(customFields).length,
  });

  return {
    contactInfo,
    bantData,
    customFields,
  };
}

/**
 * Create form template from form configuration
 *
 * @param formId - Facebook form ID
 * @param formName - Facebook form name
 * @param customMappings - Custom field mappings for this form
 * @returns Form template
 */
export function createFormTemplate(
  formId: string,
  formName: string,
  customMappings: FieldMapping[]
): FormTemplate {
  return {
    id: formId,
    name: formName,
    mappings: [...DEFAULT_FIELD_MAPPINGS, ...customMappings],
  };
}

/**
 * Validate mapped data
 *
 * @param contactInfo - Mapped contact information
 * @returns Validation result with errors
 */
export function validateMappedData(contactInfo: Record<string, any>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required fields
  if (!contactInfo.email && !contactInfo.phone) {
    errors.push('Either email or phone is required');
  }

  // Validate email format
  if (contactInfo.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactInfo.email)) {
      errors.push('Invalid email format');
    }
  }

  // Validate phone format (basic check)
  if (contactInfo.phone) {
    const phoneRegex = /[\d\s\-\+\(\)]+/;
    if (!phoneRegex.test(contactInfo.phone)) {
      warnings.push('Phone number format may be invalid');
    }
  }

  // Check for name
  if (!contactInfo.name && !contactInfo.firstName && !contactInfo.lastName) {
    warnings.push('No name provided');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Transform field value based on type
 *
 * @param value - Raw field value
 * @param type - Target field type
 * @returns Transformed value
 */
export function transformFieldValue(
  value: string,
  type: 'email' | 'phone' | 'name' | 'date' | 'number' | 'boolean'
): any {
  switch (type) {
    case 'email':
      return value.toLowerCase().trim();

    case 'phone':
      // Remove non-digit characters except + at start
      return value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

    case 'name':
      // Capitalize first letter of each word
      return value
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    case 'date':
      // Try to parse as ISO date
      try {
        return new Date(value).toISOString();
      } catch {
        return value;
      }

    case 'number':
      const num = parseFloat(value);
      return isNaN(num) ? value : num;

    case 'boolean':
      return ['yes', 'true', '1', 'on'].includes(value.toLowerCase());

    default:
      return value;
  }
}

/**
 * Extract industry from company name or other fields
 *
 * @param data - Mapped contact data
 * @returns Industry classification
 */
export function extractIndustry(data: Record<string, any>): string | undefined {
  // Common industry keywords
  const industryKeywords: Record<string, string[]> = {
    'Technology': ['tech', 'software', 'saas', 'it', 'digital'],
    'Healthcare': ['health', 'medical', 'hospital', 'clinic', 'pharma'],
    'Finance': ['bank', 'finance', 'insurance', 'investment'],
    'Retail': ['retail', 'shop', 'store', 'ecommerce'],
    'Manufacturing': ['manufacturing', 'factory', 'production'],
    'Real Estate': ['real estate', 'property', 'housing'],
    'Education': ['education', 'school', 'university', 'training'],
    'Marketing': ['marketing', 'advertising', 'agency'],
  };

  const searchText = [
    data.company,
    data.industry,
    data.jobTitle,
    ...Object.values(data.customFields || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some((keyword) => searchText.includes(keyword))) {
      return industry;
    }
  }

  return undefined;
}

/**
 * Enrich contact data with additional computed fields
 *
 * @param contactInfo - Basic contact information
 * @param fieldData - Original Facebook field data
 * @returns Enriched contact data
 */
export function enrichContactData(
  contactInfo: Record<string, any>,
  fieldData: FacebookLeadField[]
): Record<string, any> {
  const enriched = { ...contactInfo };

  // Construct full name if not present
  if (!enriched.name && (enriched.firstName || enriched.lastName)) {
    enriched.name = [enriched.firstName, enriched.lastName]
      .filter(Boolean)
      .join(' ');
  }

  // Extract first/last name from full name if needed
  if (enriched.name && !enriched.firstName && !enriched.lastName) {
    const nameParts = enriched.name.split(' ');
    enriched.firstName = nameParts[0];
    enriched.lastName = nameParts.slice(1).join(' ') || nameParts[0];
  }

  // Detect industry
  if (!enriched.industry) {
    enriched.industry = extractIndustry(enriched);
  }

  // Normalize email
  if (enriched.email) {
    enriched.email = enriched.email.toLowerCase().trim();
  }

  // Format phone
  if (enriched.phone) {
    enriched.phone = transformFieldValue(enriched.phone, 'phone');
  }

  return enriched;
}
