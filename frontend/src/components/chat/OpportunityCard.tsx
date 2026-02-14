import { formatCurrency, getStageBadge } from './utils';
import { MetricBar, StatusBadge } from './shared';

interface OpportunityData {
  id?: string;
  title: string;
  contactName?: string;
  company?: string;
  value?: number;
  dealValue?: number;
  stage?: string;
  probability?: number;
  expectedCloseDate?: string;
  description?: string;
  source?: string;
  tags?: string[];
}

interface OpportunityCardProps {
  opportunity: OpportunityData;
  action?: 'create' | 'update' | 'view';
}

export function OpportunityCard({ opportunity, action }: OpportunityCardProps) {
  const value = opportunity.value || opportunity.dealValue;
  const actionLabel = action === 'create' ? 'New Deal' : action === 'update' ? 'Updated' : undefined;

  // Determine probability color
  const getProbabilityColor = (prob?: number) => {
    if (prob === undefined) return 'stone';
    if (prob >= 75) return 'emerald';
    if (prob >= 50) return 'amber';
    return 'stone';
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 my-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Deal icon */}
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-stone-900">{opportunity.title}</h4>
              {getStageBadge(opportunity.stage)}
              {actionLabel && <StatusBadge label={actionLabel} color="emerald" />}
            </div>
            {opportunity.contactName && (
              <p className="text-sm text-stone-500 mt-0.5">{opportunity.contactName}{opportunity.company ? ` at ${opportunity.company}` : ''}</p>
            )}
          </div>
        </div>

        {/* Deal value callout */}
        {value ? (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(value)}</p>
          </div>
        ) : null}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3 py-3 border-t border-stone-100">
        {opportunity.probability !== undefined && (
          <MetricBar
            label="Probability"
            value={opportunity.probability}
            color={getProbabilityColor(opportunity.probability)}
          />
        )}
        {opportunity.expectedCloseDate && (
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider">Close Date</p>
            <p className="text-xs font-medium text-stone-700 mt-0.5">{opportunity.expectedCloseDate}</p>
          </div>
        )}
        {opportunity.source && (
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider">Source</p>
            <p className="text-xs font-medium text-stone-700 mt-0.5 capitalize">{opportunity.source}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {opportunity.description && (
        <p className="text-xs text-stone-500 mt-2 line-clamp-2">{opportunity.description}</p>
      )}

      {/* Tags */}
      {opportunity.tags && opportunity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {opportunity.tags.map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-medium rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ID footer */}
      {opportunity.id && (
        <div className="mt-3 pt-2 border-t border-stone-100 text-[10px] text-stone-400 font-mono truncate">
          ID: {opportunity.id}
        </div>
      )}
    </div>
  );
}
