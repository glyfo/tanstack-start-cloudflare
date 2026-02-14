/**
 * TikTok Lead Card Component
 *
 * Displays lead information captured from TikTok Lead Generation ads
 * Shows campaign metadata, creative details, and contact information
 */

import { ContactInfoField, CardActions, MetricBar, StatusBadge, FieldGrid } from './shared';

export interface TikTokLeadData {
  leadId: string;
  eventId: string;
  formName: string;
  formId: string;
  campaignName?: string;
  campaignId: string;
  adName?: string;
  adId: string;
  creativeId: string;
  pageName?: string;
  pageId: string;
  eventTime: number;
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

interface TikTokLeadCardProps {
  lead: TikTokLeadData;
  onQualify?: (leadId: string) => void;
  onContact?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
  // MCP Apps pattern - direct tool invocation
  onInvokeTool?: (toolId: string, params: Record<string, any>) => Promise<ToolInvokeResult>;
}

export function TikTokLeadCard({
  lead,
  onQualify,
  onContact,
  onViewDetails,
  onInvokeTool,
}: TikTokLeadCardProps) {
  const formattedDate = new Date(lead.eventTime * 1000).toLocaleString();

  // MCP Apps pattern - handle qualify action with direct tool invocation
  const handleQualify = async () => {
    if (onInvokeTool) {
      try {
        await onInvokeTool('server.qualifyLead', {
          leadId: lead.leadId,
          source: 'tiktok',
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
          source: 'tiktok',
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

  // Get classification badge color
  const getClassificationColor = (classification?: string): 'red' | 'amber' | 'sky' | 'stone' => {
    switch (classification) {
      case 'hot': return 'red';
      case 'warm': return 'amber';
      case 'cold': return 'sky';
      default: return 'stone';
    }
  };

  // Build campaign info fields
  const campaignFields = [
    { label: 'Campaign', value: lead.campaignName || lead.campaignId },
    { label: 'Form', value: lead.formName },
  ];

  if (lead.adName) {
    campaignFields.push({ label: 'Ad', value: lead.adName });
  }

  // Build action buttons
  const actions = [
    onViewDetails && {
      label: 'View Details',
      onClick: () => onViewDetails(lead.leadId),
      variant: 'secondary' as const,
    },
    (onQualify || onInvokeTool) && {
      label: 'Qualify Lead',
      onClick: handleQualify,
      variant: 'primary' as const,
    },
    (onContact || onInvokeTool) && {
      label: 'Contact',
      onClick: handleContact,
      variant: 'primary' as const,
    },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void; variant: 'primary' | 'secondary' }>;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">
              {lead.userDetails.name || 'Unknown Lead'}
            </h3>
            <p className="text-sm text-stone-500">
              via TikTok • {formattedDate}
            </p>
          </div>
        </div>

        {lead.classification && (
          <StatusBadge
            label={lead.classification.toUpperCase()}
            color={getClassificationColor(lead.classification)}
          />
        )}
      </div>

      {/* Contact Info - using ContactInfoField */}
      <div className="space-y-2 mb-3">
        {lead.userDetails.email && (
          <ContactInfoField
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            value={lead.userDetails.email}
          />
        )}

        {lead.userDetails.phone && (
          <ContactInfoField
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            }
            value={lead.userDetails.phone}
          />
        )}

        {lead.userDetails.company && (
          <ContactInfoField
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            value={lead.userDetails.company}
          />
        )}
      </div>

      {/* Campaign Info - using FieldGrid */}
      <div className="border-t border-stone-200 pt-3 mb-3">
        <FieldGrid fields={campaignFields} columns={2} />
      </div>

      {/* Custom Fields */}
      {lead.userDetails.customFields && Object.keys(lead.userDetails.customFields).length > 0 && (
        <div className="border-t border-stone-200 pt-3 mb-3">
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

      {/* Qualification Score - using MetricBar */}
      {lead.qualificationScore !== undefined && (
        <div className="border-t border-stone-200 pt-3 mb-3">
          <MetricBar
            label="Qualification Score"
            value={lead.qualificationScore}
            color="sky"
          />
        </div>
      )}

      {/* Actions - using CardActions */}
      {actions.length > 0 && <CardActions actions={actions} />}
    </div>
  );
}

/**
 * TikTok Lead List Component
 *
 * Displays a list of TikTok leads with filtering and sorting
 */
interface TikTokLeadListProps {
  leads: TikTokLeadData[];
  onQualify?: (leadId: string) => void;
  onContact?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
  emptyMessage?: string;
}

export function TikTokLeadList({
  leads,
  onQualify,
  onContact,
  onViewDetails,
  emptyMessage = 'No TikTok leads yet',
}: TikTokLeadListProps) {
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
        <TikTokLeadCard
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
