/**
 * Schema-Driven Form Component
 *
 * Generates form UI automatically from Zod schema metadata.
 * Single component for all entity types - following ShipTypes philosophy.
 */

import { useState, useMemo, useCallback } from 'react';
import { z } from 'zod';
import {
  groupSchemaFields,
  validateSchema,
  type SchemaField,
} from '@/schemas/entities';

// ============================================================================
// TYPES
// ============================================================================

interface SchemaFormProps<T extends z.ZodObject<any>> {
  schema: T;
  initialData?: Partial<z.infer<T>>;
  onSubmit: (data: z.infer<T>) => void | Promise<void>;
  onCancel?: () => void;
  onFieldChange?: (key: string, value: any, formData: Record<string, any>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  showOptional?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Render custom header above the form */
  header?: React.ReactNode;
  /** Fields to exclude from rendering */
  excludeFields?: string[];
  /** Fields to make read-only */
  readOnlyFields?: string[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SchemaForm<T extends z.ZodObject<any>>({
  schema,
  initialData = {},
  onSubmit,
  onCancel,
  onFieldChange,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  showOptional: initialShowOptional = false,
  disabled = false,
  compact = false,
  header,
  excludeFields = [],
  readOnlyFields = [],
}: SchemaFormProps<T>) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(initialShowOptional);

  // Group fields by priority, excluding specified fields
  const fieldGroups = useMemo(() => {
    const groups = groupSchemaFields(schema);
    const filterFields = (fields: SchemaField[]) =>
      fields.filter(f => !excludeFields.includes(f.key));

    return {
      primary: filterFields(groups.primary),
      secondary: filterFields(groups.secondary),
      optional: filterFields(groups.optional),
    };
  }, [schema, excludeFields]);

  const handleChange = useCallback((key: string, value: any) => {
    const newFormData = { ...formData, [key]: value };
    setFormData(newFormData);

    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }

    // Notify parent of field change
    onFieldChange?.(key, value, newFormData);
  }, [formData, errors, onFieldChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isSubmitting) return;

    // Validate with Zod
    const result = validateSchema(schema, formData);
    if (!result.success) {
      setErrors(result.errors!);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(result.data!);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // FIELD RENDERERS
  // ============================================================================

  const renderField = (field: SchemaField) => {
    const { key, meta } = field;
    const value = formData[key] ?? '';
    const error = errors[key];
    const isReadOnly = readOnlyFields.includes(key);
    const isDisabled = disabled || isSubmitting || isReadOnly;

    const baseClass = compact
      ? 'w-full px-3 py-2 bg-stone-50 border-0 rounded-lg text-sm'
      : 'w-full px-3 py-2.5 bg-stone-50 border-0 rounded-xl text-sm';

    const inputClass = `${baseClass} text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 transition-all ${
      error ? 'ring-2 ring-red-300' : 'focus:ring-stone-200'
    } ${isReadOnly ? 'bg-stone-100 text-stone-500' : ''}`;

    switch (meta.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            disabled={isDisabled}
            className={inputClass}
          >
            <option value="">{meta.placeholder || `Select ${meta.label}`}</option>
            {meta.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={meta.placeholder}
            disabled={isDisabled}
            rows={compact ? 2 : 3}
            className={`${inputClass} resize-none`}
          />
        );

      case 'number':
        return (
          <div className="relative">
            {key.toLowerCase().includes('value') && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
            )}
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(key, e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder={meta.placeholder}
              disabled={isDisabled}
              className={`${inputClass} ${key.toLowerCase().includes('value') ? 'pl-7' : ''}`}
            />
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => handleChange(key, e.target.value ? new Date(e.target.value).getTime() : undefined)}
            disabled={isDisabled}
            className={inputClass}
          />
        );

      default:
        return (
          <input
            type={meta.type || 'text'}
            value={value}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={meta.placeholder || meta.label}
            disabled={isDisabled}
            className={inputClass}
          />
        );
    }
  };

  const renderFieldWithWrapper = (field: SchemaField) => {
    const isHalf = field.meta.width === 'half';
    const isFull = field.meta.type === 'textarea' || field.meta.width === 'full';

    return (
      <div
        key={field.key}
        className={isFull ? 'col-span-2' : isHalf ? '' : 'col-span-2'}
      >
        {renderField(field)}
      </div>
    );
  };

  const renderFieldGroup = (fields: SchemaField[]) => {
    if (fields.length === 0) return null;

    return (
      <div className="grid grid-cols-2 gap-3">
        {fields.map(renderFieldWithWrapper)}
      </div>
    );
  };

  const hasOptionalFields = fieldGroups.secondary.length > 0 || fieldGroups.optional.length > 0;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Custom header */}
      {header}

      {/* Primary fields */}
      {renderFieldGroup(fieldGroups.primary)}

      {/* Toggle for optional fields */}
      {hasOptionalFields && (
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showOptional ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {showOptional ? 'Less options' : 'More options'}
        </button>
      )}

      {/* Secondary & Optional fields */}
      {showOptional && (
        <div className="space-y-3">
          {renderFieldGroup(fieldGroups.secondary)}
          {renderFieldGroup(fieldGroups.optional)}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className={`px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2`}
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm transition-colors"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}

// ============================================================================
// SPECIALIZED FORM WRAPPERS
// ============================================================================

import {
  CreateContactSchema,
  CreateOpportunitySchema,
  STAGE_CONFIG,
  type CreateContactInput,
  type CreateOpportunityInput,
  type OpportunityStage,
} from '@/schemas/entities';

// ----------------------------------------------------------------------------
// ContactForm - Schema-driven contact creation
// ----------------------------------------------------------------------------

interface ContactFormProps {
  initialData?: Partial<CreateContactInput>;
  onSubmit: (data: CreateContactInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function ContactForm({ initialData, onSubmit, onCancel }: ContactFormProps) {
  return (
    <SchemaForm
      schema={CreateContactSchema}
      initialData={initialData}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitLabel="Create"
      compact
    />
  );
}

// ----------------------------------------------------------------------------
// OpportunityForm - Schema-driven opportunity creation with stage chips
// ----------------------------------------------------------------------------

interface OpportunityFormProps {
  initialData?: Partial<CreateOpportunityInput>;
  onSubmit: (data: CreateOpportunityInput) => void | Promise<void>;
  onCancel?: () => void;
  /** Contact info to display if pre-selected */
  selectedContact?: { name: string; email?: string };
}

export function OpportunityForm({
  initialData,
  onSubmit,
  onCancel,
  selectedContact,
}: OpportunityFormProps) {
  const [stage, setStage] = useState<OpportunityStage>(initialData?.stage || 'lead');

  const handleFieldChange = (key: string, value: any) => {
    if (key === 'stage') {
      setStage(value as OpportunityStage);
    }
  };

  const handleSubmit = (data: CreateOpportunityInput) => {
    // Auto-set probability from stage if not manually set
    const finalData = {
      ...data,
      probability: data.probability ?? STAGE_CONFIG[data.stage || 'lead'].probability,
    };
    onSubmit(finalData);
  };

  // Custom header with contact info and stage selector
  const header = (
    <div className="space-y-3">
      {/* Contact badge if selected */}
      {selectedContact && (
        <div className="flex items-center gap-2 px-3 py-2 bg-stone-100 rounded-xl">
          <div className="w-6 h-6 rounded-full bg-stone-300 flex items-center justify-center text-xs font-medium text-stone-600">
            {selectedContact.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-stone-600">
            For <span className="font-medium text-stone-900">{selectedContact.name}</span>
          </span>
        </div>
      )}

      {/* Stage chips */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(STAGE_CONFIG).slice(0, 4).map(([value, config]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStage(value as OpportunityStage)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              stage === value
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <SchemaForm
      schema={CreateOpportunitySchema}
      initialData={{ ...initialData, stage }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      onFieldChange={handleFieldChange}
      submitLabel="Create deal"
      header={header}
      excludeFields={['stage', 'contactId', selectedContact ? 'contactName' : '']}
      compact
    />
  );
}
