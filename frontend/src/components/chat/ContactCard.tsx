import { getInitials, formatSource } from './utils';
import { FieldGrid, StatusBadge } from './shared';

interface ContactData {
  id?: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  status?: string;
  source?: string;
  tags?: string[];
}

interface ContactCardProps {
  contact: ContactData;
  action?: 'create' | 'update' | 'view';
}

export function ContactCard({ contact, action }: ContactCardProps) {
  const actionLabel = action === 'create' ? 'New Contact' : action === 'update' ? 'Updated' : undefined;

  // Build fields array for FieldGrid
  const fields = [
    contact.company && { label: 'Company', value: contact.company },
    contact.phone && { label: 'Phone', value: contact.phone },
    contact.source && { label: 'Source', value: formatSource(contact.source) },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 my-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {getInitials(contact.name)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-stone-900 truncate">{contact.name}</h4>
            {actionLabel && <StatusBadge label={actionLabel} color="sky" />}
          </div>

          {/* Email */}
          <p className="text-sm text-stone-600 truncate">{contact.email}</p>

          {/* Details grid - using FieldGrid */}
          {fields.length > 0 && (
            <div className="mt-2">
              <FieldGrid fields={fields} columns={2} />
            </div>
          )}

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {contact.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-medium rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ID footer */}
      {contact.id && (
        <div className="mt-3 pt-2 border-t border-stone-100 text-[10px] text-stone-400 font-mono truncate">
          ID: {contact.id}
        </div>
      )}
    </div>
  );
}
