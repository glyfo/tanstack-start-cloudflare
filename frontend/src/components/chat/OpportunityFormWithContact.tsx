/**
 * OpportunityFormWithContact - Composable opportunity form with embedded contact selector
 *
 * This component enforces the contact-opportunity relationship by embedding
 * the contact selector directly. Users must select or create a contact before
 * filling in opportunity details.
 *
 * Phases:
 * 1. Contact Selection - search existing or create new
 * 2. Opportunity Details - shown after contact is selected
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ContactForm } from './SchemaForm';
import {
  STAGE_CONFIG,
  type CreateContactInput,
  type OpportunityStage,
} from '@/schemas/entities';

// ============================================================================
// TYPES
// ============================================================================

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface SelectedContact {
  contactId: string;
  contactName: string;
  contactEmail: string;
  company?: string;
}

// Stage type matching the legacy format (with hyphens) for API compatibility
type LegacyStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';

// Convert internal stage format to legacy API format
function mapStageToLegacy(stage: OpportunityStage): LegacyStage {
  return stage.replace(/_/g, '-') as LegacyStage;
}

// Convert legacy API format to internal stage format
function mapStageToInternal(stage?: LegacyStage): OpportunityStage {
  if (!stage) return 'lead';
  return stage.replace(/-/g, '_') as OpportunityStage;
}

export interface OpportunityFormData {
  title: string;
  contactId: string;
  contactName: string;
  contactEmail?: string;
  company?: string;
  dealValue?: number;
  stage: LegacyStage;
  probability?: number;
  expectedCloseDate?: string;
  description?: string;
  source?: string;
}

interface OpportunityFormWithContactProps {
  initialData?: Partial<OpportunityFormData>;
  onSubmit: (data: OpportunityFormData) => void;
  onCancel?: () => void;
  onContextUpdate?: (context: {
    type: string;
    formId: string;
    formState: Record<string, any>;
    action: string;
  }) => void;
  onSearchContacts?: (query: string) => Promise<Contact[]>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OpportunityFormWithContact({
  initialData = {},
  onSubmit,
  onCancel,
  onContextUpdate,
  onSearchContacts,
}: OpportunityFormWithContactProps) {
  // Contact selection state
  const [selectedContact, setSelectedContact] = useState<SelectedContact | null>(
    initialData.contactId && initialData.contactName
      ? {
          contactId: initialData.contactId,
          contactName: initialData.contactName,
          contactEmail: initialData.contactEmail || '',
          company: initialData.company,
        }
      : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);

  // Opportunity form state
  const [stage, setStage] = useState<OpportunityStage>(mapStageToInternal(initialData.stage));
  const [formData, setFormData] = useState<Record<string, any>>({
    title: initialData.title || '',
    dealValue: initialData.dealValue,
    description: initialData.description || '',
    expectedCloseDate: initialData.expectedCloseDate,
    source: initialData.source || 'chat',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Cancel confirmation state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Check if form has data worth preserving
  const hasFormData = useMemo(() => {
    return selectedContact !== null || formData.title?.trim() || formData.dealValue;
  }, [selectedContact, formData.title, formData.dealValue]);

  // Validation
  const canSubmit = useMemo(() => {
    return selectedContact?.contactId && formData.title?.trim() && !isSubmitting;
  }, [selectedContact, formData.title, isSubmitting]);

  // Notify parent of state changes
  const notifyContextUpdate = useCallback((action: string, state: Record<string, any>) => {
    onContextUpdate?.({
      type: "form-state-change",
      formId: "opportunity-form-with-contact",
      formState: state,
      action,
    });
  }, [onContextUpdate]);

  // ============================================================================
  // CONTACT SEARCH
  // ============================================================================

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (onSearchContacts) {
        const results = await onSearchContacts(query);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[OpportunityFormWithContact] Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [onSearchContacts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectContact = (contact: Contact) => {
    const selected: SelectedContact = {
      contactId: contact.id,
      contactName: contact.name,
      contactEmail: contact.email,
      company: contact.company,
    };
    setSelectedContact(selected);
    setSearchQuery('');
    setSearchResults([]);
    notifyContextUpdate('contact-selected', selected);
  };

  const handleCreateContact = async (data: CreateContactInput) => {
    // Create temporary contact - actual creation happens on form submit
    const tempContact: SelectedContact = {
      contactId: `new-${Date.now()}`,
      contactName: data.name,
      contactEmail: data.email,
      company: data.company,
    };
    setSelectedContact(tempContact);
    setShowCreateContact(false);
    notifyContextUpdate('contact-created', tempContact);
  };

  const handleChangeContact = () => {
    setSelectedContact(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Clear error when field is edited
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleStageChange = (newStage: OpportunityStage) => {
    setStage(newStage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedContact) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // Build final data (convert stage to legacy format)
      const submitData: OpportunityFormData = {
        title: formData.title,
        contactId: selectedContact.contactId,
        contactName: selectedContact.contactName,
        contactEmail: selectedContact.contactEmail,
        company: selectedContact.company,
        dealValue: formData.dealValue,
        stage: mapStageToLegacy(stage),
        probability: STAGE_CONFIG[stage].probability,
        expectedCloseDate: formData.expectedCloseDate,
        description: formData.description,
        source: formData.source || 'chat',
      };

      // Validate title
      if (!submitData.title?.trim()) {
        setErrors({ title: 'Title is required' });
        setIsSubmitting(false);
        return;
      }

      notifyContextUpdate('form-submit', submitData);
      await onSubmit(submitData);
    } catch (error) {
      console.error('[OpportunityFormWithContact] Submit error:', error);
      setErrors({ _form: 'Failed to create opportunity' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (hasFormData) {
      setShowCancelConfirm(true);
    } else {
      confirmCancel();
    }
  };

  const confirmCancel = () => {
    notifyContextUpdate('form-cancelled', { ...formData, selectedContact });
    onCancel?.();
  };

  // ============================================================================
  // RENDER: CREATE CONTACT FORM
  // ============================================================================

  if (showCreateContact) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 space-y-3">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateContact(false)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-stone-900">New Contact</span>
        </div>

        <ContactForm
          onSubmit={handleCreateContact}
          onCancel={() => setShowCreateContact(false)}
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER: MAIN FORM
  // ============================================================================

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 space-y-4">
      {/* ================================================================== */}
      {/* PHASE 1: CONTACT SELECTION */}
      {/* ================================================================== */}

      {!selectedContact ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">Who is this opportunity for?</p>

          {/* Search input */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border-0 rounded-full text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 transition-all"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSelectContact(contact)}
                  className="w-full px-3 py-2.5 text-left rounded-xl hover:bg-stone-100 transition-all flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-600">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{contact.name}</p>
                    <p className="text-xs text-stone-500 truncate">{contact.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-2">No contacts found</p>
          )}

          {/* Create new contact button */}
          <button
            type="button"
            onClick={() => setShowCreateContact(true)}
            className="w-full px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium rounded-full transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create new contact
          </button>

          {/* Cancel button */}
          {onCancel && (
            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ================================================================== */}
          {/* PHASE 2: OPPORTUNITY DETAILS */}
          {/* ================================================================== */}

          {/* Selected contact badge */}
          <div className="flex items-center justify-between px-3 py-2 bg-stone-100 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-stone-300 flex items-center justify-center text-xs font-medium text-stone-600">
                {selectedContact.contactName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-stone-900">{selectedContact.contactName}</p>
                {selectedContact.contactEmail && (
                  <p className="text-xs text-stone-500">{selectedContact.contactEmail}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleChangeContact}
              className="text-xs text-stone-500 hover:text-stone-700 transition-colors"
            >
              Change
            </button>
          </div>

          {/* Stage chips */}
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(STAGE_CONFIG).slice(0, 4).map(([value, config]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleStageChange(value as OpportunityStage)}
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

          {/* Title field */}
          <div>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Opportunity title *"
              disabled={isSubmitting}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50 disabled:cursor-not-allowed ${
                errors.title ? 'border-red-300 bg-red-50' : 'border-stone-200'
              }`}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title}</p>
            )}
          </div>

          {/* Value field */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
            <input
              type="number"
              value={formData.dealValue || ''}
              onChange={(e) => handleFieldChange('dealValue', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Deal value"
              min="0"
              step="100"
              disabled={isSubmitting}
              className="w-full pl-7 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Optional fields toggle */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showOptional ? 'Less options' : 'More options'}
          </button>

          {/* Optional fields */}
          {showOptional && (
            <div className="space-y-3 pt-2 border-t border-stone-100">
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Description"
                rows={2}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50 disabled:cursor-not-allowed resize-none"
              />
              <input
                type="date"
                value={formData.expectedCloseDate || ''}
                onChange={(e) => handleFieldChange('expectedCloseDate', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50 disabled:cursor-not-allowed"
              />
            </div>
          )}

          {/* Form error */}
          {errors._form && (
            <p className="text-sm text-red-500">{errors._form}</p>
          )}

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-2">Discard this opportunity?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmCancel}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Yes, discard
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Keep editing
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                canSubmit
                  ? 'bg-stone-900 hover:bg-stone-800 text-white'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create deal'}
            </button>
            {onCancel && !showCancelConfirm && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm transition-colors disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
