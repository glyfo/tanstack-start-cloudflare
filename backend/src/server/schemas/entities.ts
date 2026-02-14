/**
 * Entity Schemas - Single Source of Truth
 *
 * Following "Ship Types, Not Docs" philosophy:
 * - Define schema once with Zod
 * - Derive types, validation, form fields, and persistence from schema
 * - Types ARE the documentation
 */

import { z } from 'zod';

// ============================================================================
// FIELD METADATA - For UI form generation
// ============================================================================

export interface FieldMeta {
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'hidden';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hidden?: boolean;
  group?: 'primary' | 'secondary' | 'optional';
  width?: 'full' | 'half';
}

// Helper to attach UI metadata to Zod schemas
export function withMeta<T extends z.ZodTypeAny>(schema: T, meta: FieldMeta): T {
  (schema as any)._meta = meta;
  return schema;
}

// Extract metadata from a Zod type
export function getMeta(zodType: z.ZodTypeAny): FieldMeta | undefined {
  return (zodType as any)._meta;
}

// ============================================================================
// CONTACT SCHEMA
// ============================================================================

export const ContactStatusSchema = z.enum(['active', 'inactive', 'archived']);
export type ContactStatus = z.infer<typeof ContactStatusSchema>;

export const ContactSourceSchema = z.enum([
  'website', 'linkedin', 'referral', 'email', 'cold_call',
  'event', 'tiktok', 'facebook', 'instagram', 'whatsapp', 'chat', 'other'
]);
export type ContactSource = z.infer<typeof ContactSourceSchema>;

export const ContactSchema = z.object({
  id: z.string().optional(),

  // Primary fields - always visible (friendly labels for non-tech users)
  name: withMeta(
    z.string().min(1, 'Please enter their name'),
    { label: 'Their name', placeholder: 'e.g. Sarah Johnson', type: 'text', required: true, group: 'primary', width: 'half' }
  ),

  email: withMeta(
    z.string().email('Please enter a valid email'),
    { label: 'Their email', placeholder: 'e.g. sarah@company.com', type: 'email', required: true, group: 'primary', width: 'half' }
  ),

  phone: withMeta(
    z.string().optional(),
    { label: 'Their phone', placeholder: 'e.g. +1 555-0000', type: 'tel', group: 'primary', width: 'half' }
  ),

  source: withMeta(
    ContactSourceSchema.optional(),
    {
      label: 'How you met',
      placeholder: 'Where did you find them?',
      type: 'select',
      options: [
        // Social Media (most common for leads)
        { value: 'tiktok', label: 'TikTok' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'linkedin', label: 'LinkedIn' },
        // Other channels
        { value: 'website', label: 'My website' },
        { value: 'chat', label: 'Chat' },
        { value: 'referral', label: 'Someone referred them' },
        { value: 'email', label: 'Email' },
        { value: 'cold_call', label: 'I called them' },
        { value: 'event', label: 'Event or meetup' },
        { value: 'other', label: 'Other' },
      ],
      group: 'primary',
      width: 'half'
    }
  ),

  // Secondary fields - shown on expand (more details)
  description: withMeta(
    z.string().optional(),
    { label: 'Notes about them', placeholder: 'Anything you want to remember...', type: 'textarea', group: 'secondary', width: 'full' }
  ),

  company: withMeta(
    z.string().optional(),
    { label: 'Where they work', placeholder: 'Company name', type: 'text', group: 'secondary', width: 'half' }
  ),

  jobTitle: withMeta(
    z.string().optional(),
    { label: 'Their role', placeholder: 'What they do', type: 'text', group: 'secondary', width: 'half' }
  ),

  status: withMeta(
    ContactStatusSchema.default('active'),
    {
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Not active' },
        { value: 'archived', label: 'Archived' },
      ],
      group: 'secondary',
      width: 'half'
    }
  ),

  // Legacy field - keep for backward compatibility but hidden
  notes: withMeta(
    z.string().optional(),
    { label: 'Notes', type: 'hidden', group: 'optional', width: 'full' }
  ),

  // System fields - not shown in forms
  tags: z.array(z.string()).default([]),
  leadScore: z.number().min(0).max(100).default(0),
  customFields: z.record(z.string(), z.any()).default({}),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;
export type ContactInput = z.input<typeof ContactSchema>;

// Schema for creating a contact (form fields)
export const CreateContactSchema = ContactSchema.pick({
  name: true,
  email: true,
  phone: true,
  source: true,
  description: true,
  company: true,
  jobTitle: true,
  status: true,
  tags: true,
});

export type CreateContactInput = z.infer<typeof CreateContactSchema>;

// ============================================================================
// OPPORTUNITY SCHEMA
// ============================================================================

export const OpportunityStageSchema = z.enum([
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost'
]);
export type OpportunityStage = z.infer<typeof OpportunityStageSchema>;

export const STAGE_CONFIG: Record<OpportunityStage, { label: string; probability: number; color: string }> = {
  lead: { label: 'Lead', probability: 10, color: 'stone' },
  qualified: { label: 'Qualified', probability: 25, color: 'blue' },
  proposal: { label: 'Proposal', probability: 50, color: 'amber' },
  negotiation: { label: 'Negotiation', probability: 75, color: 'orange' },
  closed_won: { label: 'Won', probability: 100, color: 'green' },
  closed_lost: { label: 'Lost', probability: 0, color: 'red' },
};

export const OpportunitySourceSchema = z.enum([
  'chat', 'tiktok', 'facebook', 'instagram', 'whatsapp',
  'website', 'referral', 'cold_outreach', 'event', 'other'
]);
export type OpportunitySource = z.infer<typeof OpportunitySourceSchema>;

export const OpportunitySchema = z.object({
  id: z.string().optional(),

  // Primary fields
  title: withMeta(
    z.string().min(1, 'Title is required'),
    { label: 'Deal Title', placeholder: 'Enterprise License Deal', type: 'text', required: true, group: 'primary', width: 'full' }
  ),

  contactId: withMeta(
    z.string().optional(),
    { type: 'hidden', group: 'primary' }
  ),

  contactName: withMeta(
    z.string().optional(),
    { label: 'Contact', placeholder: 'Select or enter contact', type: 'text', group: 'primary', width: 'half' }
  ),

  dealValue: withMeta(
    z.number().positive().optional(),
    { label: 'Value', placeholder: '50000', type: 'number', group: 'primary', width: 'half' }
  ),

  stage: withMeta(
    OpportunityStageSchema.default('lead'),
    {
      label: 'Stage',
      type: 'select',
      options: Object.entries(STAGE_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
      group: 'primary',
      width: 'half'
    }
  ),

  // Secondary fields
  company: withMeta(
    z.string().optional(),
    { label: 'Company', placeholder: 'Acme Inc.', type: 'text', group: 'secondary', width: 'half' }
  ),

  expectedCloseDate: withMeta(
    z.number().optional(), // Unix timestamp
    { label: 'Expected Close', type: 'date', group: 'secondary', width: 'half' }
  ),

  source: withMeta(
    OpportunitySourceSchema.default('chat'),
    {
      label: 'Source',
      type: 'select',
      options: [
        { value: 'chat', label: 'Chat' },
        { value: 'tiktok', label: 'TikTok' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'website', label: 'Website' },
        { value: 'referral', label: 'Referral' },
        { value: 'cold_outreach', label: 'Cold Outreach' },
        { value: 'event', label: 'Event' },
        { value: 'other', label: 'Other' },
      ],
      group: 'secondary',
      width: 'half'
    }
  ),

  probability: withMeta(
    z.number().min(0).max(100).default(10),
    { label: 'Probability', placeholder: '50', type: 'number', group: 'secondary', width: 'half' }
  ),

  // Optional fields
  description: withMeta(
    z.string().optional(),
    { label: 'Notes', placeholder: 'Deal notes...', type: 'textarea', group: 'optional', width: 'full' }
  ),

  closeReason: withMeta(
    z.string().optional(),
    { label: 'Close Reason', placeholder: 'Why was this closed?', type: 'text', group: 'optional', width: 'half' }
  ),

  competitor: withMeta(
    z.string().optional(),
    { label: 'Competitor', placeholder: 'Competing vendor', type: 'text', group: 'optional', width: 'half' }
  ),

  // System fields
  currency: z.string().default('USD'),
  previousStage: OpportunityStageSchema.optional(),
  stageEnteredAt: z.number().optional(),
  actualCloseDate: z.number().optional(),
  qualificationScore: z.number().min(0).max(100).default(0),
  isQualified: z.boolean().default(false),
  lastActivityAt: z.number().optional(),
  isStalled: z.boolean().default(false),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export type Opportunity = z.infer<typeof OpportunitySchema>;
export type OpportunityInput = z.input<typeof OpportunitySchema>;

// Schema for creating an opportunity
export const CreateOpportunitySchema = OpportunitySchema.pick({
  title: true,
  contactId: true,
  contactName: true,
  dealValue: true,
  stage: true,
  company: true,
  expectedCloseDate: true,
  source: true,
  probability: true,
  description: true,
});

export type CreateOpportunityInput = z.infer<typeof CreateOpportunitySchema>;

// ============================================================================
// SCHEMA UTILITIES
// ============================================================================

export interface SchemaField {
  key: string;
  meta: FieldMeta;
  zodType: z.ZodTypeAny;
  isRequired: boolean;
}

/**
 * Extract field metadata from a Zod schema for form generation
 */
export function getSchemaFields<T extends z.ZodObject<any>>(schema: T): SchemaField[] {
  const shape = schema.shape;
  const fields: SchemaField[] = [];

  for (const [key, zodType] of Object.entries(shape)) {
    const zod = zodType as z.ZodTypeAny;
    const meta = getMeta(zod);

    if (meta && meta.type !== 'hidden') {
      // Check if field is required (from metadata or Zod type)
      const isRequired = meta.required || (!zod.isOptional() && !zod.isNullable());

      fields.push({ key, meta, zodType: zod, isRequired });
    }
  }

  return fields;
}

/**
 * Group fields by their group property
 */
export function groupSchemaFields<T extends z.ZodObject<any>>(schema: T) {
  const fields = getSchemaFields(schema);
  return {
    primary: fields.filter(f => f.meta.group === 'primary'),
    secondary: fields.filter(f => f.meta.group === 'secondary'),
    optional: fields.filter(f => f.meta.group === 'optional'),
  };
}

/**
 * Get stage options with probabilities for opportunity forms
 */
export function getStageOptions() {
  return Object.entries(STAGE_CONFIG).map(([value, config]) => ({
    value: value as OpportunityStage,
    label: config.label,
    probability: config.probability,
    color: config.color,
  }));
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

/**
 * Validate data against a schema and return friendly errors
 */
export function validateSchema<T extends z.ZodObject<any>>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  // Zod v4 uses .issues instead of .errors
  const issues = (result.error as any).issues || (result.error as any).errors || [];
  for (const issue of issues) {
    const key = issue.path?.[0] as string;
    if (key) {
      errors[key] = issue.message;
    }
  }

  return { success: false, errors };
}

/**
 * Prepare data for persistence (add timestamps)
 */
export function prepareForPersistence<T extends { createdAt?: number; updatedAt?: number }>(
  data: T,
  isNew: boolean = true
): T {
  const now = Date.now();
  return {
    ...data,
    updatedAt: now,
    createdAt: isNew ? now : data.createdAt,
  };
}

// ============================================================================
// FORM FIELD GENERATION
// ============================================================================

export interface FormFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'hidden';
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  width: 'full' | 'half';
  group: 'primary' | 'secondary' | 'optional';
}

/**
 * Generate form field configs from a schema
 */
export function generateFormFields<T extends z.ZodObject<any>>(schema: T): FormFieldConfig[] {
  return getSchemaFields(schema).map(({ key, meta, isRequired }) => ({
    key,
    label: meta.label || key,
    placeholder: meta.placeholder,
    type: meta.type || 'text',
    required: isRequired,
    options: meta.options,
    width: meta.width || 'full',
    group: meta.group || 'primary',
  }));
}

// ============================================================================
// ENTITY REGISTRY - For dynamic form rendering
// ============================================================================

export const EntitySchemas = {
  contact: {
    schema: ContactSchema,
    createSchema: CreateContactSchema,
    name: 'Contact',
    namePlural: 'Contacts',
  },
  opportunity: {
    schema: OpportunitySchema,
    createSchema: CreateOpportunitySchema,
    name: 'Opportunity',
    namePlural: 'Opportunities',
  },
} as const;

export type EntityType = keyof typeof EntitySchemas;
