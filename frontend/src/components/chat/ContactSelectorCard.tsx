/**
 * ContactSelectorCard - Select existing contact or create new
 *
 * Used in conversational flows when an entity requires a contact reference.
 * Uses schema-driven form for inline contact creation.
 */

import { useState, useEffect, useCallback } from 'react';
import { ContactForm } from './SchemaForm';
import type { CreateContactInput } from '@/schemas/entities';

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface ContactSelectorProps {
  initialData?: {
    placeholder?: string;
    allowCreate?: boolean;
    prefilledContactId?: string;
  };
  onContactSelected: (contact: { contactId: string; contactName: string; contactEmail: string; company?: string }) => void;
  onCancel?: () => void;
  onContextUpdate?: (context: {
    type: string;
    formId: string;
    formState: Record<string, any>;
    action: string;
  }) => void;
  onSearch?: (query: string) => Promise<Contact[]>;
}

export function ContactSelectorCard({
  initialData = {},
  onContactSelected,
  onCancel,
  onContextUpdate,
  onSearch,
}: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const notifyContextUpdate = (action: string, state: Record<string, any>) => {
    onContextUpdate?.({
      type: "form-state-change",
      formId: "contact-selector",
      formState: state,
      action,
    });
  };

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (onSearch) {
        const results = await onSearch(query);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [onSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    notifyContextUpdate('contact-selected', {
      contactId: contact.id,
      contactName: contact.name,
      contactEmail: contact.email,
    });
  };

  const handleConfirmSelection = () => {
    if (selectedContact) {
      onContactSelected({
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        contactEmail: selectedContact.email,
      });
    }
  };

  const handleCreateContact = async (data: CreateContactInput) => {
    // Create a temporary contact with the form data
    // The actual creation will happen when the flow advances
    const tempContact = {
      contactId: `new-${Date.now()}`,
      contactName: data.name,
      contactEmail: data.email,
      company: data.company,
    };

    onContactSelected(tempContact);
  };

  // Create new contact form - using SchemaForm
  if (showCreateForm) {
    return (
      <div className="space-y-3">
        {/* Header with back link */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-stone-500">New contact</span>
        </div>

        {/* Schema-driven contact form */}
        <ContactForm
          onSubmit={handleCreateContact}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  // Search mode
  return (
    <div className="space-y-3">
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
          placeholder={initialData.placeholder || "Search contacts..."}
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
        <div className="space-y-1">
          {searchResults.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => handleSelectContact(contact)}
              className={`w-full px-3 py-2.5 text-left rounded-xl transition-all flex items-center gap-3 ${
                selectedContact?.id === contact.id
                  ? 'bg-stone-900 text-white'
                  : 'hover:bg-stone-100'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                selectedContact?.id === contact.id ? 'bg-white/20' : 'bg-stone-200'
              }`}>
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${selectedContact?.id === contact.id ? 'text-white' : 'text-stone-900'}`}>
                  {contact.name}
                </p>
                <p className={`text-xs truncate ${selectedContact?.id === contact.id ? 'text-white/70' : 'text-stone-500'}`}>
                  {contact.email}
                </p>
              </div>
              {selectedContact?.id === contact.id && (
                <svg className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-2">
          No contacts found
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {selectedContact ? (
          <button
            type="button"
            onClick={handleConfirmSelection}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-full transition-colors"
          >
            Continue with {selectedContact.name}
          </button>
        ) : (
          initialData.allowCreate !== false && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-full transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New contact
            </button>
          )
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
