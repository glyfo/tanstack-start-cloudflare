/**
 * CreateOpportunityCard - Wrapper for composable opportunity form with contact selector
 *
 * This is a thin wrapper that maintains backward compatibility while using
 * the new OpportunityFormWithContact component which embeds contact selection.
 */

import { OpportunityFormWithContact, type OpportunityFormData as ComposableOpportunityFormData } from './OpportunityFormWithContact';

// Re-export the type for backward compatibility
export interface OpportunityFormData {
  title: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  company?: string;
  dealValue?: number;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability?: number;
  expectedCloseDate?: string;
  description?: string;
  source?: string;
  tags?: string[];
}

interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface CreateOpportunityCardProps {
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

// Map legacy stage format (with hyphens) to new format (with underscores)
function mapStageToNew(stage?: string): ComposableOpportunityFormData['stage'] {
  if (!stage) return 'lead';
  return stage.replace(/-/g, '_') as ComposableOpportunityFormData['stage'];
}

// Map new stage format back to legacy
function mapStageToLegacy(stage?: string): OpportunityFormData['stage'] {
  if (!stage) return 'lead';
  return stage.replace(/_/g, '-') as OpportunityFormData['stage'];
}

export function CreateOpportunityCard({
  initialData = {},
  onSubmit,
  onCancel,
  onContextUpdate,
  onSearchContacts,
}: CreateOpportunityCardProps) {

  const handleSubmit = (data: ComposableOpportunityFormData) => {
    // Notify context update
    onContextUpdate?.({
      type: "form-submit",
      formId: "create-opportunity",
      formState: data,
      action: "submit",
    });

    // Map to legacy format and submit
    onSubmit({
      title: data.title,
      contactId: data.contactId,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      company: data.company,
      dealValue: data.dealValue,
      stage: mapStageToLegacy(data.stage),
      probability: data.probability,
      expectedCloseDate: data.expectedCloseDate,
      description: data.description,
      source: data.source,
    });
  };

  return (
    <OpportunityFormWithContact
      initialData={{
        title: initialData.title || '',
        contactId: initialData.contactId,
        contactName: initialData.contactName,
        contactEmail: initialData.contactEmail,
        company: initialData.company,
        dealValue: initialData.dealValue,
        stage: mapStageToNew(initialData.stage),
        probability: initialData.probability,
        expectedCloseDate: initialData.expectedCloseDate,
        description: initialData.description,
        source: initialData.source,
      }}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      onContextUpdate={onContextUpdate}
      onSearchContacts={onSearchContacts}
    />
  );
}
