/**
 * Instagram Lead Card Component
 *
 * Displays lead information captured from Instagram Lead Generation ads
 * Shows campaign metadata, form details, and contact information
 */

export interface InstagramLeadData {
  leadId: string;
  leadgenId: string;
  formName?: string;
  formId: string;
  campaignName?: string;
  campaignId: string;
  adsetName?: string;
  adsetId: string;
  adName?: string;
  adId: string;
  pageName?: string;
  pageId?: string;
  createdTime: string;
  userDetails: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
    customFields?: Record<string, string>;
  };
  qualificationScore?: number;
  classification?: 'hot' | 'warm' | 'cold' | 'unqualified';
}

// MCP Apps pattern - Tool invocation result
interface ToolInvokeResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface InstagramLeadCardProps {
  lead: InstagramLeadData;
  onQualify?: (leadId: string) => void;
  onContact?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
  // MCP Apps pattern - direct tool invocation
  onInvokeTool?: (toolId: string, params: Record<string, any>) => Promise<ToolInvokeResult>;
}

export function InstagramLeadCard({
  lead,
  onQualify,
  onContact,
  onViewDetails,
  onInvokeTool,
}: InstagramLeadCardProps) {
  const formattedDate = new Date(lead.createdTime).toLocaleString();

  // MCP Apps pattern - handle qualify action with direct tool invocation
  const handleQualify = async () => {
    if (onInvokeTool) {
      try {
        await onInvokeTool('server.qualifyLead', {
          leadId: lead.leadId,
          source: 'instagram',
          classification: 'qualified',
        });
      } catch (error) {
        console.error('Failed to qualify lead:', error);
      }
    } else if (onQualify) {
      onQualify(lead.leadId);
    }
  };

  // MCP Apps pattern - handle contact action with direct tool invocation
  const handleContact = async () => {
    if (onInvokeTool) {
      try {
        await onInvokeTool('server.contactLead', {
          leadId: lead.leadId,
          source: 'instagram',
          contactMethod: 'email',
          email: lead.userDetails.email,
          phone: lead.userDetails.phone,
        });
      } catch (error) {
        console.error('Failed to contact lead:', error);
      }
    } else if (onContact) {
      onContact(lead.leadId);
    }
  };

  // Get classification color (following design system)
  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'hot':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warm':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'cold':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'unqualified':
        return 'bg-gray-100 text-stone-600 border-gray-200';
      default:
        return 'bg-gray-50 text-stone-500 border-gray-200';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">
              {lead.userDetails.name || 'Unknown Lead'}
            </h3>
            <p className="text-sm text-stone-500">
              via Instagram • {formattedDate}
            </p>
          </div>
        </div>

        {lead.classification && (
          <span className={`px-2 py-1 rounded border text-xs font-medium ${getClassificationColor(lead.classification)}`}>
            {lead.classification.toUpperCase()}
          </span>
        )}
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-3">
        {lead.userDetails.email && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-stone-700">{lead.userDetails.email}</span>
          </div>
        )}

        {lead.userDetails.phone && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-stone-700">{lead.userDetails.phone}</span>
          </div>
        )}

        {lead.userDetails.company && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-stone-700">{lead.userDetails.company}</span>
          </div>
        )}

        {lead.userDetails.city && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-stone-700">
              {[lead.userDetails.city, lead.userDetails.state, lead.userDetails.country]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Campaign Info */}
      <div className="border-t border-gray-200 pt-3 mb-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-stone-500">Campaign:</span>
            <p className="text-stone-900 font-medium truncate">
              {lead.campaignName || lead.campaignId}
            </p>
          </div>
          <div>
            <span className="text-stone-500">Form:</span>
            <p className="text-stone-900 font-medium truncate">
              {lead.formName || lead.formId}
            </p>
          </div>
        </div>

        {lead.adsetName && (
          <div className="mt-2 text-sm">
            <span className="text-stone-500">Ad Set:</span>
            <span className="text-stone-900 ml-2">{lead.adsetName}</span>
          </div>
        )}

        {lead.adName && (
          <div className="mt-2 text-sm">
            <span className="text-stone-500">Ad:</span>
            <span className="text-stone-900 ml-2">{lead.adName}</span>
          </div>
        )}
      </div>

      {/* Custom Fields */}
      {lead.userDetails.customFields && Object.keys(lead.userDetails.customFields).length > 0 && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <p className="text-xs font-medium text-stone-500 mb-2">Additional Info</p>
          <div className="space-y-1">
            {Object.entries(lead.userDetails.customFields).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-stone-600 capitalize">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="text-stone-900 font-medium">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualification Score */}
      {lead.qualificationScore !== undefined && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Qualification Score</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${lead.qualificationScore}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-stone-900">
                {lead.qualificationScore}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(lead.leadId)}
            className="flex-1 px-3 py-2 text-sm font-medium text-stone-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            View Details
          </button>
        )}
        {(onQualify || onInvokeTool) && (
          <button
            onClick={handleQualify}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors"
          >
            Qualify Lead
          </button>
        )}
        {(onContact || onInvokeTool) && (
          <button
            onClick={handleContact}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            Contact
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Instagram Lead List Component
 *
 * Displays a list of Instagram leads with filtering and sorting
 */
interface InstagramLeadListProps {
  leads: InstagramLeadData[];
  onQualify?: (leadId: string) => void;
  onContact?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
  emptyMessage?: string;
}

export function InstagramLeadList({
  leads,
  onQualify,
  onContact,
  onViewDetails,
  emptyMessage = 'No Instagram leads yet',
}: InstagramLeadListProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-stone-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-stone-900">
          {emptyMessage}
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <InstagramLeadCard
          key={lead.leadId}
          lead={lead}
          onQualify={onQualify}
          onContact={onContact}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
