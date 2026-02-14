/**
 * Facebook Lead Card Component
 *
 * Displays lead information captured from Facebook Lead Generation ads
 * Shows campaign metadata, form details, and contact information
 */

import { ContactInfoField, CardActions, MetricBar, StatusBadge, FieldGrid } from './shared';

export interface FacebookLeadData {
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

interface FacebookLeadCardProps {
  lead: FacebookLeadData;
  onQualify?: (leadId: string) => void;
  onContact?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
  // MCP Apps pattern - direct tool invocation
  onInvokeTool?: (toolId: string, params: Record<string, any>) => Promise<ToolInvokeResult>;
}

export function FacebookLeadCard({
  lead,
  onQualify,
  onContact,
  onViewDetails,
  onInvokeTool,
}: FacebookLeadCardProps) {
  const formattedDate = new Date(lead.createdTime).toLocaleString();

  // MCP Apps pattern - handle qualify action with direct tool invocation
  const handleQualify = async () => {
    if (onInvokeTool) {
      try {
        await onInvokeTool('server.qualifyLead', {
          leadId: lead.leadId,
          source: 'facebook',
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
          source: 'facebook',
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
    { label: 'Form', value: lead.formName || lead.formId },
  ];

  if (lead.adsetName) {
    campaignFields.push({ label: 'Ad Set', value: lead.adsetName });
  }

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
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">
              {lead.userDetails.name || 'Unknown Lead'}
            </h3>
            <p className="text-sm text-stone-500">
              via Facebook • {formattedDate}
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

        {lead.userDetails.city && (
          <ContactInfoField
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            value={[lead.userDetails.city, lead.userDetails.state, lead.userDetails.country]
              .filter(Boolean)
              .join(', ')}
          />
        )}
      </div>

      {/* Campaign Info - using FieldGrid */}
      <div className="border-t border-stone-200 pt-3 mb-3">
        <FieldGrid fields={campaignFields} columns={2} />
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
 * Facebook Lead List Component
 *
 * Displays a list of Facebook leads with filtering and sorting
 */
interface FacebookLeadListProps {
  leads: FacebookLeadData[];
  onQualify?: (leadId: string) => void;
  onContact?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
  emptyMessage?: string;
}

export function FacebookLeadList({
  leads,
  onQualify,
  onContact,
  onViewDetails,
  emptyMessage = 'No Facebook leads yet',
}: FacebookLeadListProps) {
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
        <FacebookLeadCard
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
