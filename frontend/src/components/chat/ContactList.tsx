import { useState } from 'react';
import { getInitials, formatSource, sourceColors, getAvatarColor } from './utils';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  description?: string;
  company?: string;
  status?: string;
  tags?: string[];
}

interface ContactListProps {
  contacts: Contact[];
  emptyMessage?: string;
}

function ContactItem({ contact }: { contact: Contact }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`px-4 py-3 transition-colors ${isExpanded ? 'bg-stone-50' : 'hover:bg-stone-50/50'}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-center gap-3 cursor-pointer"
      >
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(contact.name)}`}>
          {getInitials(contact.name)}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-900 truncate">{contact.name}</span>
            {contact.source && (
              <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${sourceColors[contact.source] || 'bg-stone-200 text-stone-600'}`}>
                {formatSource(contact.source)}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 truncate">{contact.email}</p>
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 ml-11 grid grid-cols-2 gap-x-4 gap-y-2">
          {contact.company && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Company</p>
              <p className="text-xs text-stone-700 font-medium">{contact.company}</p>
            </div>
          )}
          {contact.phone && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Phone</p>
              <p className="text-xs text-stone-700 font-medium">{contact.phone}</p>
            </div>
          )}
          {contact.source && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Source</p>
              <p className="text-xs text-stone-700 font-medium">{formatSource(contact.source)}</p>
            </div>
          )}
          {contact.description && (
            <div className="col-span-2">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Notes</p>
              <p className="text-xs text-stone-600">{contact.description}</p>
            </div>
          )}
          {contact.tags && contact.tags.length > 0 && (
            <div className="col-span-2">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[10px] font-medium rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-[10px] text-stone-300 font-mono">ID: {contact.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ContactList({ contacts, emptyMessage = "No contacts yet." }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-6 my-3 text-center">
        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-2">
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <p className="text-sm text-stone-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden my-3 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <span className="text-sm font-semibold text-stone-900">
            {contacts.length} Contact{contacts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-stone-100">
        {contacts.map((contact) => (
          <ContactItem key={contact.id} contact={contact} />
        ))}
      </div>
    </div>
  );
}
