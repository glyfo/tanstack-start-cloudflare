import { useState } from 'react';
import { formatCurrency, getStageInfo } from './utils';

interface Opportunity {
  id?: string;
  title: string;
  contactName?: string;
  company?: string;
  dealValue?: number;
  stage?: string;
  probability?: number;
  expectedCloseDate?: number | string;
  description?: string;
  source?: string;
  tags?: string[];
}

interface OpportunityListProps {
  opportunities: Opportunity[];
  emptyMessage?: string;
}

const formatDate = (date?: number | string) => {
  if (!date) return '';
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

function OpportunityItem({ opportunity }: { opportunity: Opportunity }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const stage = getStageInfo(opportunity.stage);

  return (
    <div className={`px-4 py-3 transition-colors ${isExpanded ? 'bg-stone-50' : 'hover:bg-stone-50/50'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-center gap-3 cursor-pointer"
      >
        {/* Stage dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage?.dot || 'bg-stone-300'}`} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-900 truncate">{opportunity.title}</span>
            {stage && (
              <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${stage.bg} ${stage.text}`}>
                {stage.label}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 truncate">
            {opportunity.contactName || 'No contact'}
            {opportunity.company ? ` - ${opportunity.company}` : ''}
          </p>
        </div>

        {/* Value */}
        {opportunity.dealValue ? (
          <span className="text-sm font-bold text-emerald-600 shrink-0">{formatCurrency(opportunity.dealValue)}</span>
        ) : null}

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
        <div className="mt-3 ml-[22px] grid grid-cols-3 gap-x-4 gap-y-2">
          {opportunity.probability !== undefined && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Probability</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      opportunity.probability >= 75 ? 'bg-emerald-500' :
                      opportunity.probability >= 50 ? 'bg-amber-500' : 'bg-stone-400'
                    }`}
                    style={{ width: `${opportunity.probability}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-stone-700">{opportunity.probability}%</span>
              </div>
            </div>
          )}
          {opportunity.expectedCloseDate && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Close Date</p>
              <p className="text-xs text-stone-700 font-medium mt-0.5">{formatDate(opportunity.expectedCloseDate)}</p>
            </div>
          )}
          {opportunity.source && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Source</p>
              <p className="text-xs text-stone-700 font-medium mt-0.5 capitalize">{opportunity.source}</p>
            </div>
          )}
          {opportunity.description && (
            <div className="col-span-3">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider">Description</p>
              <p className="text-xs text-stone-600 mt-0.5">{opportunity.description}</p>
            </div>
          )}
          {opportunity.tags && opportunity.tags.length > 0 && (
            <div className="col-span-3">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {opportunity.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[10px] font-medium rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {opportunity.id && (
            <div className="col-span-3">
              <p className="text-[10px] text-stone-300 font-mono">ID: {opportunity.id}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OpportunityList({ opportunities, emptyMessage = "No opportunities yet." }: OpportunityListProps) {
  // Calculate total pipeline value
  const totalValue = opportunities.reduce((sum, o) => sum + (o.dealValue || 0), 0);

  if (opportunities.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-6 my-3 text-center">
        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-2">
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-semibold text-stone-900">
            {opportunities.length} Opportunit{opportunities.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-sm font-bold text-emerald-600">{formatCurrency(totalValue)}</span>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-stone-100">
        {opportunities.map((opportunity, idx) => (
          <OpportunityItem key={opportunity.id || idx} opportunity={opportunity} />
        ))}
      </div>
    </div>
  );
}
