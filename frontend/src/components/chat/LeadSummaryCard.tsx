/**
 * Lead Summary Card
 *
 * Simple, clean lead display for chat interface
 * Follows ChatEngine design patterns with stone/gray palette
 */

type LeadSource = 'tiktok' | 'facebook' | 'whatsapp' | 'instagram';
type LeadClassification = 'hot' | 'warm' | 'cold' | 'unqualified' | 'new';

export interface LeadSummary {
  id: string;
  source: LeadSource;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  classification?: LeadClassification;
  score?: number;
  campaign?: string;
  timestamp: number;
}

interface LeadSummaryCardProps {
  lead: LeadSummary;
  onView?: (id: string) => void;
  compact?: boolean;
}

export function LeadSummaryCard({ lead, onView, compact = false }: LeadSummaryCardProps) {
  const getSourceColor = (source: LeadSource): string => {
    const colors: Record<LeadSource, string> = {
      tiktok: 'bg-black text-white',
      facebook: 'bg-blue-600 text-white',
      whatsapp: 'bg-green-600 text-white',
      instagram: 'bg-gradient-to-r from-purple-600 to-pink-500 text-white',
    };
    return colors[source];
  };

  const getClassificationBadge = (classification?: LeadClassification) => {
    if (!classification || classification === 'new') return null;

    const styles: Record<Exclude<LeadClassification, 'new'>, string> = {
      hot: 'bg-red-50 text-red-700 border-red-200',
      warm: 'bg-orange-50 text-orange-700 border-orange-200',
      cold: 'bg-blue-50 text-blue-700 border-blue-200',
      unqualified: 'bg-stone-50 text-stone-600 border-stone-200',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[classification as Exclude<LeadClassification, 'new'>]}`}
      >
        {classification.charAt(0).toUpperCase() + classification.slice(1)}
      </span>
    );
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-stone-400';
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-blue-600';
    return 'text-stone-600';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${getSourceColor(lead.source)}`}>
          <span className="text-xs font-bold">{lead.source[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-stone-900 truncate">
            {lead.name || lead.email || lead.phone || 'Unknown'}
          </div>
          <div className="text-xs text-stone-500">{lead.campaign || lead.source}</div>
        </div>
        {lead.score && (
          <div className={`text-sm font-semibold ${getScoreColor(lead.score)}`}>
            {lead.score}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-stone-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getSourceColor(lead.source)}`}>
            <span className="text-sm font-bold">{lead.source[0].toUpperCase()}</span>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 text-sm">
              {lead.name || 'Anonymous Lead'}
            </h3>
            <p className="text-xs text-stone-500">
              {new Date(lead.timestamp).toLocaleDateString()} at{' '}
              {new Date(lead.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getClassificationBadge(lead.classification)}
          {lead.score && (
            <div className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
              {lead.score}
            </div>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3">
        {lead.email && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-stone-700 font-mono text-xs">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-stone-700 font-mono text-xs">{lead.phone}</span>
          </div>
        )}
        {lead.company && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-stone-700 text-xs">{lead.company}</span>
          </div>
        )}
      </div>

      {/* Campaign */}
      {lead.campaign && (
        <div className="text-xs text-stone-500 mb-3 flex items-center gap-1.5">
          <span className="uppercase tracking-wider font-medium">Campaign:</span>
          <span className="font-mono">{lead.campaign}</span>
        </div>
      )}

      {/* Actions */}
      {onView && (
        <button
          onClick={() => onView(lead.id)}
          className="w-full px-3 py-1.5 text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-md hover:bg-stone-100 transition-colors"
        >
          View Details
        </button>
      )}
    </div>
  );
}

/**
 * Lead List Group - for displaying multiple leads in chat
 */
interface LeadListGroupProps {
  leads: LeadSummary[];
  title?: string;
  onViewLead?: (id: string) => void;
  maxDisplay?: number;
}

export function LeadListGroup({
  leads,
  title = 'Recent Leads',
  onViewLead,
  maxDisplay = 5
}: LeadListGroupProps) {
  const displayLeads = leads.slice(0, maxDisplay);
  const remaining = leads.length - displayLeads.length;

  return (
    <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          <span className="text-xs text-stone-500">{leads.length} total</span>
        </div>
      </div>

      {/* Lead List */}
      <div className="divide-y divide-stone-100">
        {displayLeads.map((lead) => (
          <div key={lead.id} className="px-4 hover:bg-stone-50 transition-colors">
            <LeadSummaryCard lead={lead} onView={onViewLead} compact />
          </div>
        ))}
      </div>

      {/* Show More */}
      {remaining > 0 && (
        <div className="bg-stone-50 px-4 py-2 border-t border-stone-200 text-center">
          <span className="text-xs text-stone-500">
            + {remaining} more lead{remaining !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {leads.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-stone-500">
          No leads found
        </div>
      )}
    </div>
  );
}
